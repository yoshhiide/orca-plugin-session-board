import { copy, display, joinCopy, language, replyMessages, type Copy, type Language } from './language'
import type { OrcaWorkerApi, PluginEvents } from 'orca/worker'
import type {} from './protocol'
import { execFile } from 'node:child_process'
import { botDetail, pendingQuestionId, readItemReplyTarget, sessionDetail, terminalMatches, uniqueLocalBot, workerConversation } from './conversation'
import { nativeReply, type ReplyStage } from './native-reply'
import { activityWindow, sessionState, sourceNames, states, transition, visibleRows, withinActivityWindow, type Batch, type Board, type Detail, type Row, type Transition } from './model'
import { cli, collect, itemHistory, itemPage, list, optional, terminalStillMatches, time, type Cli } from './sources'

type Snapshot = Awaited<ReturnType<typeof collect>>
type SourceCache = Batch & { at?: number }
type AgentEvent = PluginEvents['agent.status.changed']

export function createMonitor(run: Cli, notify: (row: Row, move: Transition) => Promise<boolean>, clock = Date.now) {
  const cache = new Map<string, SourceCache>()
  const history = new Map<string, Transition[]>()
  const eventAt = new Map<string, number>()
  let notificationIssue: Copy | undefined

  function allRows(): Board['rows'] {
    const now = clock()
    return visibleRows([...cache.values()].flatMap(source => source.rows.filter(row =>
      withinActivityWindow(row.at, now)).map(row =>
      ({...row, stale: !source.ok})))) as Board['rows']
  }

  function expiresIn() {
    const rows = allRows()
    if (!rows.length) return undefined
    return rows.reduce((oldest, row) => Math.min(oldest, row.at), Infinity) + activityWindow + 1 - clock()
  }

  function board(): Board {
    const records = [...cache.values()]
    const sorted = allRows().sort((a, b) =>
      Number(b.state === 'input') - Number(a.state === 'input') ||
      b.at - a.at || display(a.title, 'en').localeCompare(display(b.title, 'en'), 'ja'))
    const rows: Board['rows'] = []
    let size = 0
    for (const row of sorted) {
      size += Buffer.byteLength(JSON.stringify(row), 'utf8') + 1
      if (size >= 180_000) break
      rows.push(row)
    }
    const snapshot: Board = {
      rows, hiddenRows: sorted.length - rows.length,
      sources: records.map(({label, at, issue}) => ({ label, at, issue })),
      notificationIssue
    }
    // The native request bridge rejects optional properties present with value undefined.
    return JSON.parse(JSON.stringify(snapshot)) as Board
  }

  async function report(row: Row, move: Transition) {
    const entries = history.get(row.id) ?? []
    history.set(row.id, [...entries.slice(-99), move])
    try {
      if (!await notify(row, move)) notificationIssue = copy('Orca could not deliver the notification.', 'Orcaが通知を配信できませんでした')
    } catch {
      notificationIssue = copy('The Orca notification request failed.', 'Orcaの通知呼び出しに失敗しました')
    }
  }

  async function ingest({ batches, complete }: Snapshot) {
    const before = new Map(allRows().map(row => [row.id, row]))
    const touched = new Set(batches.map(batch => batch.key))
    for (const batch of batches) {
      const old = cache.get(batch.key)
      const rows = batch.ok ? batch.rows.map(row => {
        const previous = old?.rows.find(entry => entry.id === row.id)
        return previous && (eventAt.get(row.id) ?? 0) > (row.stateAt ?? row.at) ?
          {...row, state: previous.state, stateAt: previous.stateAt, at: Math.max(previous.at, row.at)} : row
      }) : old?.rows ?? []
      cache.set(batch.key, {...batch, rows, at: batch.ok ? clock() : old?.at})
    }
    for (const [key, source] of cache) {
      if (touched.has(key)) continue
      if (complete) cache.delete(key)
      else cache.set(key, {...source, ok:false, issue:copy('Could not refresh', '再取得できません')})
    }
    const current = allRows()
    const present = new Set([...cache.values()].flatMap(source => source.rows.map(row => row.id)))
    for (const id of history.keys()) if (!present.has(id)) history.delete(id)
    for (const id of eventAt.keys()) if (!present.has(id)) eventAt.delete(id)

    const changes = await Promise.all(current.map(async row => {
      const previous = before.get(row.id)
      if (!previous || previous.stale || row.stale || (previous.at && row.at && row.at < previous.at)) return []
      if (withinActivityWindow(row.at, clock()) &&
        row.source === 'Bot Item' && previous.cursor && row.cursor && previous.cursor !== row.cursor) {
        try {
          const official = await itemHistory(run, row, previous.cursor)
          const moves = official.entries.map(entry => entry.transition)
          let state = previous.state
          const continuous = moves.every(move => {
            if (move.from !== state) return false
            state = move.to
            return true
          })
          if (official.cursor === row.cursor && continuous && state === row.state) return moves
        } catch {
          // The current snapshot still supports a directly observed difference.
        }
      }
      return previous.state !== row.state ? [
        transition(previous, row.state, row.at > previous.at ? row.at : clock(),
          joinCopy([sourceNames[row.source], copy('refresh', '取得差分')], ' '))
      ] : []
    }))
    for (const [index, row] of current.entries()) {
      for (const move of changes[index]) {
        if (withinActivityWindow(row.at, clock())) await report(row, move)
      }
    }
  }

  async function event(payload: AgentEvent, verify?: (row: Row) => Promise<boolean>) {
    const source = cache.get('agents')
    if (!source?.ok) return false
    const matches = source.rows.filter(row => row.source === 'Orca ターミナル' && row.pane === payload.paneKey)
    if (matches.length !== 1) return false
    const row = matches[0]
    const main = payload.mainAgent
    if (!main || !withinActivityWindow(main.stateStartedAt, clock()) ||
      main.stateStartedAt <= Math.max(row.stateAt ?? row.at, eventAt.get(row.id) ?? 0)) return false
    if (!payload.sessionId || !row.ref.startsWith('orca_session_id:') ||
      row.ref.replace(/^orca_session_id:/, '') !== payload.sessionId.replace(/^orca_session_id:/, '')) {
      if (!verify || !await verify(row)) return false
    }
    if (!withinActivityWindow(main.stateStartedAt, clock())) return false
    const to = sessionState(main.state, main.outcome)
    if (to === row.state) return false
    const wasVisible = withinActivityWindow(row.at, clock())
    const move = transition(row, to, main.stateStartedAt, copy('Orca event', 'Orca イベント'))
    eventAt.set(row.id, move.at)
    row.state = to
    row.at = Math.max(row.at, move.at)
    row.stateAt = move.at
    if (wasVisible) await report(row, move)
    return true
  }

  async function detail(id: string, questionId?: string): Promise<Detail> {
    const missing = { transitions: [], issue: copy('Session unavailable', '対象を取得できません') }
    const find = () => allRows().find(item => item.id === id)
    const row = find()
    if (!row) return missing
    const transitions = [...(history.get(id) ?? [])].reverse()
    if (row.stale) return { transitions, issue: copy('Could not load the latest details. Select Refresh to try again.', '対象の最新情報を取得できません。更新して再試行してください。') }
    const current = () => withinActivityWindow(row.at, clock()) && find()?.stale === false
    const guarded: Cli = (...args) => current() ? run(...args) : Promise.reject(new Error('outside_activity_window'))
    try {
      const result = row.source === 'Bot ワーカー' ? {transitions, activity:await workerConversation(guarded, row)} :
        row.source === 'Bot Item' ? await botDetail(guarded, row, transitions, questionId, current) :
        {transitions, ...await sessionDetail(guarded, row)}
      return current() ? result : missing
    } catch {
      if (!current()) return missing
      return {
        transitions, issue: copy('Could not load Bot Item details. Select Refresh to try again.', 'Bot Itemの詳細を取得できません。更新して再試行してください。'),
        questionStatus:row.state === 'input' ? 'unverified' : undefined
      }
    }
  }

  return { board, expiresIn, ingest, event, detail }
}

let stop: (() => void) | undefined
function openBotHome(bot: string, signal: AbortSignal): Promise<boolean> {
  if (process.platform !== 'darwin' || signal.aborted) return Promise.resolve(false)
  return new Promise(resolve => {
    execFile('/usr/bin/open', ['-g', '-b', 'com.stablyai.orca', 'orca://bot/' + bot], {
      timeout:3000, signal
    }, error => resolve(!error))
  })
}

export async function openBoard(run: Cli, signal: AbortSignal, currentLanguage = () => 'en' as Language): Promise<string> {
  if (signal.aborted) return display(copy('Could not open Session Board.', 'セッションボードを開けませんでした。'), currentLanguage())
  try {
    const data = await run('plugin', 'list')
    const pluginKey = 'yoshhiide.session-board'
    const plugins = list(data.plugins).filter(plugin =>
      plugin.pluginKey === pluginKey && plugin.status === 'running' &&
      list(plugin.commands).some(command => command.id === 'open-board') &&
      list(plugin.panels).some(panel => panel.id === 'session-board'))
    if (plugins.length === 1 && !signal.aborted) {
      const result = await run('plugin', 'open', pluginKey, '--panel', 'session-board')
      if (result.kind === 'panel' && result.pluginKey === pluginKey && result.panelId === 'session-board') {
        return display(copy('Opened Session Board.', 'セッションボードを開きました。'), currentLanguage())
      }
    }
  } catch {
    // The right-sidebar tool remains available if the runtime cannot open a panel from a command.
  }
  return display(copy('Could not open Session Board. Open it from the right sidebar.',
    'セッションボードを開けませんでした。右側ツールから開いてください。'), currentLanguage())
}

export function setupWorker(orca: OrcaWorkerApi, run: Cli, interval = 15_000, openBot = openBotHome, clock = Date.now) {
  let locale: Language = 'en'
  const label = (value: Copy) => display(value, locale)
  const monitor = createMonitor(run, async (row, move) => {
    const result = await orca.host.call('notifications.show', {
      title: label(states[move.to]) + ' · ' + label(row.title),
      body: label(states[move.from]) + ' → ' + label(states[move.to]) + ' · ' + label(row.origin)
    })
    return result.delivered
  }, clock)
  let timer: ReturnType<typeof setInterval> | undefined
  let expiry: ReturnType<typeof setTimeout> | undefined
  let refresh: Promise<Board> | undefined
  let queue = Promise.resolve()
  let stopped = false
  let replying = false
  const post = () => {
    const value = monitor.board()
    if (!stopped) {
      orca.panels.post('board.changed', value)
      clearTimeout(expiry)
      const delay = monitor.expiresIn()
      if (delay !== undefined) {
        expiry = setTimeout(post, Math.max(1, delay))
        expiry.unref()
      }
    }
    return value
  }
  function serialize<T>(fn: () => Promise<T>) {
    const next = queue.then(fn)
    queue = next.then(() => undefined, () => undefined)
    return next
  }
  function poll() {
    if (refresh) return refresh
    // CLI I/O runs outside the state queue so terminal events can be applied immediately.
    refresh = collect(run, clock).then(snapshot => serialize(async () => {
      if (!stopped) await monitor.ingest(snapshot)
      return post()
    })).finally(() => { refresh = undefined })
    return refresh
  }
  function background() {
    void poll().catch(() => orca.log(label(copy('Session Board refresh failed', 'セッションボードの取得処理に失敗しました'))))
  }
  function start() {
    if (!timer && interval > 0) {
      timer = setInterval(background, interval)
      timer.unref()
    }
  }
  const events = orca.events.on('agent.status.changed', async payload => {
    start()
    const applied = await serialize(async () => {
      if (stopped) return
      const changed = await monitor.event(payload, async row => {
        if (!payload.workspaceListId || !payload.terminalId) return false
        try {
          const {agents} = await orca.host.call('agents.list', {workspaceId:payload.workspaceListId})
          const matches = agents.filter(agent =>
            agent.terminalId === payload.terminalId && agent.sessionId === payload.sessionId)
          return matches.length === 1 && await terminalStillMatches(run, row)
        } catch {
          return false
        }
      })
      post()
      return changed
    })
    if (!applied && (!monitor.board().sources.length ||
      withinActivityWindow(payload.mainAgent?.stateStartedAt, clock()))) background()
  })
  orca.panels.handle('board.start', input => {
    locale = language(input?.locale)
    start()
    background()
    return monitor.board()
  })
  orca.panels.handle('board.refresh', input => {
    locale = language(input?.locale)
    start()
    return poll()
  })
  const command = orca.commands.register('open-board', (_args, {signal}) => openBoard(run, signal, () => locale))
  orca.panels.handle('board.detail', async ({id, questionId}) =>
    JSON.parse(JSON.stringify(await monitor.detail(id, questionId))) as Detail)
  orca.panels.handle('board.reply', async ({id, questionId, index}, {signal}) => {
    const row = monitor.board().rows.find(item => item.id === id)
    const botId = row?.bot
    if (replying || stopped || signal.aborted || !row || row.stale || !botId) return {opened:false}
    replying = true
    const start = performance.now()
    let phase: ReplyStage | 'target' = 'target'
    let phaseStart = start
    const timings: Partial<Record<typeof phase | ReplyStage, number>> = {}
    let outcome = 'not-verified'
    const mark = (next: ReplyStage) => {
      const now = performance.now()
      timings[phase] = Math.round(now - phaseStart)
      phase = next
      phaseStart = now
    }
    try {
      const [data, target] = await Promise.all([run('bot', 'list'), readItemReplyTarget(run, row, questionId, index)])
      const bots = list(data.bots)
      if (target === 'choose' || target === 'changed') {
        outcome = target
        return {opened:false,reason:target}
      }
      if (!target || !Array.isArray(data.unreachable) || data.unreachable.length ||
        bots.filter(bot => bot.name === target.bot || bot.id === botId).length !== 1 ||
        !bots.some(bot => bot.id === botId && bot.name === target.bot && bot.server == null)) {
        outcome = 'target-unavailable'
        return {opened:false,reason:'target-unavailable' as const}
      }
      const stillCurrent = async () => !stopped && !signal.aborted && withinActivityWindow(row.at, clock()) &&
        JSON.stringify(await readItemReplyTarget(run, row, questionId, index)) === JSON.stringify(target)
      const result = await nativeReply(run, target, stillCurrent, signal, () => openBot(botId, signal), mark)
      if (typeof result === 'string') {
        outcome = result
        if (!signal.aborted && (result === 'item-unavailable' || result === 'question-unavailable' || result === 'composer-unavailable')) {
          void orca.host.call('notifications.show', {
            title:label(copy('Reply did not open', '返信欄を開けませんでした')), body:label(replyMessages[result])
          }).catch(() => {})
        }
        return {opened:result === 'read-only',reason:result}
      }
      if (result) outcome = 'focused'
      return {opened:result}
    } catch (error) {
      orca.log(label(copy('Could not verify the reply destination in Orca: ', '標準の回答先を照合できませんでした: ')) +
        (error instanceof Error && /^[a-z][a-z0-9_]{1,63}$/.test(error.message) ? error.message : 'navigation_failed'))
      return {opened:false}
    } finally {
      const end = performance.now()
      timings[phase] = Math.round(end - phaseStart)
      orca.log('board.reply: ' + JSON.stringify({outcome:signal.aborted ? 'cancelled' : outcome,
        stage:phase, elapsedMs:Math.round(end - start), stageMs:timings}))
      replying = false
    }
  })
  orca.panels.handle('board.focus', async ({id, questionId}, {signal}) => {
    const original = monitor.board().rows.find(row => row.id === id)
    if (!original || original.stale || signal.aborted) return false
    try {
      if (original.bot && original.source === 'Bot Item') {
        if (!await uniqueLocalBot(run, original.bot)) return false
        const {item} = await itemPage(run, original)
        if (signal.aborted || !withinActivityWindow(original.at, clock()) || time(item.snoozedUntil) > clock() ||
          (questionId && questionId !== pendingQuestionId(item))) return false
        return await openBot(original.bot, signal)
      }
      if (!original.target) return false
      const fresh = (await collect(run, clock)).batches
      const row = fresh.filter(batch => batch.ok).flatMap(batch => batch.rows).find(row => row.id === id)
      if (signal.aborted || !row?.target || row.target !== original.target ||
        row.targetIncarnation !== original.targetIncarnation || row.pane !== original.pane ||
        row.workspace !== original.workspace || !await terminalMatches(run, row) || signal.aborted ||
        !withinActivityWindow(row.at, clock())) return false
      const result = optional((await run('terminal', 'switch', '--terminal', row.target)).focus)
      return result.handle === row.target && result.worktreeId === row.workspace && result.navigated === true
    } catch {
      return false
    }
  })
  return () => {
    stopped = true
    clearInterval(timer)
    clearTimeout(expiry)
    events.dispose()
    command.dispose()
  }
}

export default function activate(orca: OrcaWorkerApi) {
  stop = setupWorker(orca, cli)
}

export function deactivate() {
  stop?.()
}
