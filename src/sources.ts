import { execFile } from 'node:child_process'
import { accessSync, constants } from 'node:fs'
import { activityWindow, itemState, sessionState, withinActivityWindow, type Batch, type Row, type Transition } from './model'

type RecordData = Record<string, unknown>
export type Cli = (...args: string[]) => Promise<RecordData>

export function record(value: unknown): RecordData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_response')
  return value as RecordData
}
export function optional(value: unknown): RecordData {
  return value == null ? {} : record(value)
}
export function list(value: unknown): RecordData[] {
  if (!Array.isArray(value)) throw new Error('invalid_response')
  return value.map(record)
}
export function text(value: unknown, limit = 240): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}
export function identifier(value: unknown): string {
  const id = text(value)
  if (!/^[a-zA-Z0-9_][a-zA-Z0-9_:.~-]{0,239}$/.test(id)) throw new Error('invalid_identifier')
  return id
}
export function time(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}
function executable(): string {
  const bundled = '/Applications/Orca.app/Contents/Resources/bin/orca'
  try {
    accessSync(bundled, constants.X_OK)
    return bundled
  } catch {
    if (process.platform !== 'darwin') throw new Error('local_macos_required')
    return 'orca'
  }
}
export const cli: Cli = (...args) => new Promise((resolve, reject) => {
  // The worker is a local dashboard, independent of the invoking agent or pair.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !key.startsWith('ORCA_')
  ))
  execFile(executable(), [...args, '--environment', 'local', '--json'], {
    env, timeout: 5500, maxBuffer: 16 * 1024 * 1024, encoding: 'utf8'
  }, (error, stdout) => {
    try {
      const response = record(JSON.parse(stdout))
      if (response.ok !== true) throw new Error(text(optional(response.error).code) || 'cli_failure')
      if (error) throw new Error('cli_failure')
      resolve(record(response.result))
    } catch (cause) {
      reject(cause instanceof SyntaxError ? new Error(error?.killed ? 'timeout' : 'cli_unavailable') : cause)
    }
  })
})

export function errorLabel(error: unknown): string {
  const code = error instanceof Error ? error.message : ''
  if (code === 'timeout') return '取得がタイムアウトしました'
  if (/^[a-z][a-z0-9_]{1,63}$/.test(code)) return '取得できません（' + code + '）'
  return '取得できません'
}

async function capture(key: string, label: string, get: () => Promise<Row[]>): Promise<Batch> {
  try {
    return { key, label, ok: true, rows: await get() }
  } catch (error) {
    return { key, label, ok: false, rows: [], issue: errorLabel(error) }
  }
}

function dispatch(value: unknown): string {
  return identifier(value).replace(/^dispatch:/, '')
}
function session(value: unknown): string {
  return identifier(value).replace(/^orca_session_id:/, '')
}

async function items(run: Cli, bot: string, origin: string, clock: () => number,
  settlements: Map<string, number>, hasWorkers: Promise<boolean>): Promise<Row[]> {
  const rows: Row[] = []
  const seen = new Set<string>()
  const cursors = new Set<string>()
  let cursor = ''
  for (;;) {
    const data = await run('bot', 'item', 'list', '--bot', bot, '--all', '--limit', '100',
      ...(cursor ? ['--cursor', cursor] : []))
    if (data.botId !== bot) throw new Error('source_mismatch')
    const now = clock()
    const page = list(data.items)
    for (const item of page) {
      const uid = identifier(item.uid)
      if (seen.has(uid)) throw new Error('pagination_changed')
      seen.add(uid)
      const links = list(item.links).filter(link => link.kind === 'dispatch')
      for (const link of links) {
        const ref = dispatch(link.latest ?? link.ref)
        if (withinActivityWindow(link.settledAt, now)) {
          settlements.set(ref, Math.max(settlements.get(ref) ?? 0, link.settledAt))
        }
      }
      const updated = time(item.updatedAt)
      const at = Number.isSafeInteger(updated) && updated > 0 && updated <= now
        ? updated : time(item.lastActivityAt)
      if (!withinActivityWindow(at, now)) continue
      const state = itemState(item.status)
      const reason = state === 'input' ? text(optional(item.question).gist, Infinity) :
        state === 'external' ? text(optional(item.wait).text ?? optional(item.wait).reason, Infinity) : ''
      rows.push({
        id: 'item:' + bot + ':' + uid, source: 'Bot Item', title: text(item.title) || 'Item',
        origin: origin + ' · #' + String(item.number ?? uid), state, at,
        ref: uid, bot,
        questionId: text(item.waitingAsk) || (state === 'input' ? text(optional(item.question).eventId) : '') || undefined,
        workers: links
          .flatMap(link => link.latest ? [dispatch(link.ref), dispatch(link.latest)] : [dispatch(link.ref)]),
        cursor: text(item.lastEventId) || undefined, reason: reason || undefined
      })
    }
    const next = text(data.nextCursor ?? data.cursor)
    if (!next) return rows
    // Orca orders by the same event clock as updatedAt. Old links can still
    // establish a recent settlement when this Bot has workers.
    const lastActivity = time(page.at(-1)?.lastActivityAt)
    if (lastActivity && lastActivity < now - activityWindow && !await hasWorkers) return rows
    if (cursors.has(next)) throw new Error('pagination_changed')
    cursors.add(next)
    cursor = next
  }
}

async function workerInventory(run: Cli) {
  const entries = new Map<string, RecordData>()
  const cursors = new Set<string>()
  let cursor = ''
  for (;;) {
    const data = await run('orchestration', 'worker-list', '--full', '--limit', '100',
      ...(cursor ? ['--cursor', cursor] : []))
    for (const entry of list(data.workers)) entries.set(dispatch(entry.dispatchId), entry)
    const next = text(optional(data.page).nextCursor, Infinity)
    if (!next) return entries
    if (cursors.has(next)) throw new Error('pagination_changed')
    cursors.add(next)
    cursor = next
  }
}

type Workers = { rows: Row[]; panes: Set<string>; handles: Set<string>; sessions: Set<string>; uncertainWorkspaces: Set<string>; incomplete: boolean }
async function workers(run: Cli, work: RecordData[], bot: string, origin: string, now: number,
  inventory: Map<string, RecordData>, settlements: Map<string, number>): Promise<Workers> {
  const rows: Row[] = []
  const panes = new Set<string>()
  const handles = new Set<string>()
  const sessions = new Set<string>()
  const uncertainWorkspaces = new Set<string>()
  let incomplete = false
  for (const entry of work) {
    const ref = dispatch(entry.dispatchId ?? entry.id)
    const info = inventory.get(ref)
    const projection = optional(info?.projection)
    const evidence = optional(projection.evidence)
    const handle = text(info?.agentTerminalHandle ?? optional(info?.resource).terminalHandle)
    if (handle) handles.add(identifier(handle))
    const workspace = text(optional(projection.workspace).id, Infinity)
    const state = sessionState(entry.state)
    const uncertain = () => {
      if (workspace && (!handle || handle.startsWith('structworker_'))) uncertainWorkspaces.add(workspace)
      else if (!handle && ['working', 'blocked', 'waiting'].includes(state)) incomplete = true
    }
    const at = Math.max(
      withinActivityWindow(evidence.lastObservedAt, now) && evidence.liveStatus !== 'redacted_restore'
        ? evidence.lastObservedAt : 0,
      settlements.get(ref) ?? 0
    )
    if (!withinActivityWindow(at, now)) {
      uncertain()
      continue
    }
    const row: Row = {
      id: 'worker:' + bot + ':' + ref, source: 'Bot ワーカー', title: text(entry.title) || 'ワーカー',
      origin, state, at, ref
    }
    let verified = false
    try {
      const detail = await run('orchestration', 'worker-show', '--dispatch', ref, '--full')
      const info = record(detail.dispatch)
      const observed = optional(detail.observation)
      verified = info.id === ref && observed.exactWorker === true
      if (verified) {
        if (info.assigneePaneKey) panes.add(String(info.assigneePaneKey))
        if (info.assigneeHandle) handles.add(identifier(info.assigneeHandle))
        if (info.assigneeSessionId) sessions.add(session(info.assigneeSessionId))
        if (observed.agentWait && ['working', 'blocked', 'waiting'].includes(row.state)) {
          row.state = 'input'
        }
      }
    } catch {
      verified = false
    }
    if (!verified) uncertain()
    rows.push(row)
  }
  return { rows, panes, handles, sessions, uncertainWorkspaces, incomplete }
}

export async function collect(run: Cli, clock = Date.now): Promise<{ batches: Batch[]; complete: boolean }> {
  const batches: Batch[] = []
  const botSessions = new Set<string>()
  const botPanes = new Set<string>()
  const botHandles = new Set<string>()
  const uncertainWorkspaces = new Set<string>()
  let inventory: ReturnType<typeof workerInventory> | undefined
  let complete = false
  let membership = false
  let terminalIssue: string | undefined
  const agentResult = capture('agents', '通常セッション', async () => {
    const [data, terminals] = await Promise.all([
      run('agent', 'list'),
      run('terminal', 'list').then(async value => {
        if (value.truncated && typeof value.totalCount === 'number' && Number.isSafeInteger(value.totalCount) &&
          value.totalCount > 0) value = await run('terminal', 'list', '--limit', String(value.totalCount))
        if (value.truncated) throw new Error('list_truncated')
        return list(value.terminals).filter(terminal => terminal.executionHostId === 'local' &&
          terminal.connected === true && terminal.orphaned === false &&
          text(terminal.worktreeId)).flatMap(terminal => {
          const tab = text(terminal.tabId)
          const leaf = text(terminal.leafId)
          const paneKey = tab && leaf ? tab + ':' + leaf : text(terminal.recordedPaneKey)
          return paneKey ? [{...terminal, paneKey} as RecordData & { paneKey: string }] : []
        })
      }).catch(error => {
        terminalIssue = errorLabel(error)
        return []
      })
    ])
    if (data.truncated) throw new Error('list_truncated')
    const now = clock()
    const agents = list(data.agents)
    const occupied = new Set<string>()
    const rows: Row[] = agents.flatMap(agent => {
      if (agent.kind !== 'chat' && agent.kind !== 'terminal') throw new Error('unknown_session_kind')
      const pane = text(agent.paneKey)
      const id = agent.orcaSessionId ? session(agent.orcaSessionId) : ''
      const host = agent.hostId === 'local' ? 'local' : text(agent.hostId)
      if (host !== 'local' || (!id && !pane)) throw new Error('source_mismatch')
      const targets = terminals.filter(terminal => terminal.paneKey === pane &&
        terminal.worktreeId === agent.worktreeId)
      const target = agent.kind === 'terminal' && pane && targets.length === 1 ? targets[0] : undefined
      if (agent.kind === 'terminal') targets.forEach(target => occupied.add(identifier(target.handle)))
      const at = Math.max(...[agent.updatedAt, target?.lastOutputAt].filter(value => withinActivityWindow(value, now)), 0)
      if (!at) return []
      return [{
        id: agent.kind === 'chat' ? 'chat:' + id : 'terminal:' + JSON.stringify([id, pane]),
        source: agent.kind === 'chat' ? 'Orca チャット' : 'Orca ターミナル',
        title: text(agent.title) || text(agent.agent) || 'セッション',
        origin: text(agent.workspace) || text(agent.repo) || 'このMac',
        state: sessionState(agent.state), at, ref: id ? 'orca_session_id:' + id : pane,
        pane, workspace: text(agent.worktreeId), target: target ? identifier(target.handle) : undefined,
        stateAt: agent.kind === 'terminal' && time(agent.updatedAt) <= now ? time(agent.updatedAt) : undefined,
        targetIncarnation: text(target?.incarnationId) || undefined
      }]
    })
    for (const terminal of terminals) {
      const handle = identifier(terminal.handle)
      if (occupied.has(handle) || !withinActivityWindow(terminal.lastOutputAt, now)) continue
      rows.push({
        id: 'terminal-ui:' + handle, source: 'Orca ターミナル',
        title: text(terminal.title) || 'ターミナル', origin: text(terminal.branch) || 'このMac',
        state: 'unknown', at: terminal.lastOutputAt, ref: handle, pane: terminal.paneKey, target: handle, workspace: text(terminal.worktreeId),
        targetIncarnation: text(terminal.incarnationId) || undefined
      })
    }
    return rows
  })
  try {
    const root = await run('bot', 'list')
    const bots = list(root.bots).filter(bot => bot.server == null)
    complete = Array.isArray(root.unreachable) && root.unreachable.length === 0
    membership = complete
    if (!complete) batches.push({key:'bots',label:'Bot一覧',ok:false,rows:[],issue:'一部のBotに接続できません'})
    for (let i = 0; i < bots.length; i += 3) {
      await Promise.all(bots.slice(i, i + 3).map(async entry => {
        const bot = identifier(entry.id)
        const origin = text(entry.name) || bot
        const settlements = new Map<string, number>()
        const workResult = run('bot', 'work', 'list', '--bot', bot).then(data => list(data.items))
        const hasWorkers = workResult.then(work => work.length > 0, () => false)
        const itemResult = capture(bot + ':items', origin + ' / Item',
          () => items(run, bot, origin, clock, settlements, hasWorkers))
        const [itemBatch, workerBatch, chats] = await Promise.all([
          itemResult,
          capture(bot + ':workers', origin + ' / ワーカー', async () => {
            const work = await workResult
            if (!work.length) return []
            inventory ??= workerInventory(run)
            const [entries] = await Promise.all([inventory, itemResult])
            const result = await workers(run, work, bot, origin, clock(), entries, settlements)
            result.panes.forEach(pane => botPanes.add(pane))
            result.handles.forEach(handle => botHandles.add(handle))
            result.sessions.forEach(id => botSessions.add(id))
            result.uncertainWorkspaces.forEach(id => uncertainWorkspaces.add(id))
            if (result.incomplete) membership = false
            return result.rows
          }),
          run('bot', 'chats', '--bot', bot, '--all').then(data => {
            if (entry.name && data.bot !== entry.name) throw new Error('source_mismatch')
            return list(data.chats)
          }).catch(() => null)
        ])
        batches.push(itemBatch, workerBatch)
        if (!workerBatch.ok || !chats) membership = false
        else chats.forEach(chat => botSessions.add(session(chat.id)))
      }))
    }
  } catch (error) {
    complete = false
    membership = false
    batches.push({ key: 'bots', label: 'Bot一覧', ok: false, rows: [], issue: errorLabel(error) })
  }
  const agents = await agentResult
  // Exact ownership is required before publishing a new set of normal sessions.
  if (!membership && agents.ok) {
    agents.ok = false
    agents.issue = 'Botへの所属を確認できません'
  }
  agents.rows = agents.rows.filter(row => !botSessions.has(row.ref.replace(/^orca_session_id:/, '')) &&
    !(row.workspace && uncertainWorkspaces.has(row.workspace) && row.pane?.startsWith('structured-agent-session-')) &&
    !(row.pane && botPanes.has(row.pane)) && !(row.target && botHandles.has(row.target)))
  const plain = agents.rows.filter(row => row.id.startsWith('terminal-ui:'))
  agents.rows = agents.rows.filter(row => !row.id.startsWith('terminal-ui:'))
  batches.push(agents, {
    key:'terminal-list', label:'ターミナル一覧', ok:agents.ok && !terminalIssue, rows:plain,
    issue:terminalIssue ?? agents.issue
  })
  return { batches, complete }
}

export async function terminalStillMatches(run: Cli, row: Row): Promise<boolean> {
  const data = await run('agent', 'list')
  if (data.truncated) return false
  const matches = list(data.agents).filter(agent => agent.kind === 'terminal' &&
    agent.hostId === 'local' && agent.paneKey === row.pane)
  return matches.length === 1 && Boolean(matches[0].orcaSessionId) &&
    row.ref === 'orca_session_id:' + session(matches[0].orcaSessionId)
}

export async function itemPage(run: Cli, row: Row, after?: string) {
  const data = await run('bot', 'item', 'show', identifier(row.ref),
    ...(after ? ['--after', identifier(after)] : []))
  const item = record(data.item)
  if (item.uid !== row.ref || (row.bot && optional(item.owner).botId !== row.bot)) {
    throw new Error('source_mismatch')
  }
  return { item, events: list(data.events), next: text(data.nextCursor) }
}

export function itemTransitions(events: RecordData[], after?: string) {
  const seen = new Set<string>()
  const entries: { id: string; transition: Transition }[] = []
  for (const event of events) {
    if (event.kind !== 'status') continue
    const id = identifier(event.id)
    if (seen.has(id)) continue
    seen.add(id)
    const fields = record(event.data)
    const from = itemState(fields.from)
    const to = itemState(fields.to)
    const at = time(event.at)
    if (at && from !== to && id !== after) entries.push({
      id, transition: { from, to, at, via: 'Bot Item 履歴' }
    })
  }
  return entries
}

export async function itemHistory(run: Cli, row: Row, after?: string) {
  const {item, events, next} = await itemPage(run, row, after)
  if (next) throw new Error('history_incomplete')
  return { entries: itemTransitions(events, after), cursor: text(item.lastEventId) }
}
