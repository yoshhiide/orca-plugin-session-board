import { copy, display, joinCopy, type Copy } from './language'
import { itemState, sourceNames, type Activity, type Detail, type Question, type Row } from './model'
import { errorLabel, identifier, itemPage, itemTransitions, list, optional, record, text, time, type Cli } from './sources'
import { itemImage } from './item-images'
import type { ItemReplyTarget, ReplyQuestion, ReplyTarget } from './native-reply'

type Fields = ReturnType<typeof record>
type Entry = Activity['entries'][number]
const commentSource = copy('Bot Item comments', 'Bot Item のコメント')
const bodiesLimit = 32_000

function body(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value : ''
}

function timestamp(value: unknown): number | undefined {
  const at = time(value)
  return at && at <= 8.64e15 ? at : undefined
}

function recent(source: Copy, entries: Activity['entries'], limited: boolean): Activity {
  let remaining = bodiesLimit
  const visible: Activity['entries'] = []
  for (const entry of entries.slice(-30).reverse()) {
    if (remaining <= 0) break
    visible.push({ ...entry, body: entry.body.slice(-remaining) })
    remaining -= entry.body.length
  }
  return {
    source, entries: visible.reverse(),
    issue: limited || entries.length > visible.length || remaining < 0 ? copy('Showing part of the retrieved history.', '取得した履歴の一部を表示しています。') : undefined
  }
}

function decisions(value: unknown, isAsk: boolean) {
  return (value == null ? [] : list(value)).flatMap(decision => {
    const prompt = text(isAsk ? decision.prompt : decision.question, Infinity)
    const options = list((isAsk ? decision.options : decision.replies) ?? []).flatMap(option => {
      const label = text(option.label, Infinity)
      const detail = text(option.detail, Infinity)
      return label ? [detail ? label + ' — ' + detail : label] : []
    })
    return prompt ? [{prompt, options}] : []
  })
}

function currentQuestion(item: Fields, events: Fields[]): Question | undefined {
  const current = optional(item.question)
  const questionEvent = item.status === 'needs_you' ? text(current.eventId) : ''
  const eventId = pendingQuestionId(item)
  if (!eventId) return
  const event = events.find(entry => entry.id === eventId && entry.kind === 'commented' &&
    optional(entry.actor).kind !== 'owner')
  const data = optional(event?.data)
  const ask = optional(data.ask)
  const source = eventId === questionEvent ? current : {}
  const lines = decisions(source.decisions ?? ask.questions, source.decisions == null)
  const context = text(ask.context, Infinity)
  const prompt = context || (lines.length ? '' : text(source.text ?? data.text, Infinity))
  if (!prompt && !lines.length) return
  if (!context && lines.length === 1) return {eventId, ...lines[0]}
  return {eventId, prompt, options:[], ...(lines.length ? {decisions:lines} : {})}
}

function replyQuestions(item: Fields, event?: Fields): (ReplyQuestion | undefined)[] {
  const owner = optional(item.owner)
  const question = optional(item.question)
  const data = optional(event?.data)
  if (item.status !== 'needs_you' || time(item.snoozedUntil) > Date.now() || question.eventId !== event?.id ||
    event?.kind !== 'commented' || optional(event.actor).kind !== 'bot' ||
    optional(event.actor).botId !== owner.botId || data.answers != null ||
    !time(event.at) || time(event.at) > 8.64e15 ||
    !Array.isArray(question.decisions) || !Array.isArray(optional(data.ask).questions)) return []
  const normalized = (value: unknown) => text(value, Infinity)
  const singleLine = (value: string) => !!value && !/[\r\n\t]/.test(value)
  const fromSnapshot = list(question.decisions)
  const fromEvent = list(optional(data.ask).questions)
  if (fromEvent.length !== fromSnapshot.length) return []
  const prompts = fromSnapshot.map(value => normalized(value.question))
  if (prompts.some(prompt => !singleLine(prompt)) || new Set(prompts).size !== prompts.length) return []
  return fromSnapshot.map((decision, index) => {
    const eventLine = fromEvent[index]
    const prompt = prompts[index]
    if (prompt !== normalized(eventLine.prompt)) return
    const choices = (options: unknown) => list(options).map(option => {
      const label = normalized(option.label)
      const detail = normalized(option.detail)
      return detail ? {label, detail} : {label}
    })
    const expected = choices(decision.replies ?? [])
    if (expected.some(choice => !singleLine(choice.label) ||
      (choice.detail && !singleLine(choice.detail))) || new Set(expected.map(choice => choice.label)).size !== expected.length ||
      JSON.stringify(expected) !== JSON.stringify(choices(eventLine.options ?? []))) return
    return {prompt, choices:expected}
  })
}

export async function readReplyTarget(run: Cli, row: Row, questionId: string, index: number): Promise<ReplyTarget | undefined> {
  if (!row.bot || row.source !== 'Bot Item' || !/^e[1-9]\d{0,14}$/.test(questionId) ||
    !Number.isSafeInteger(index) || index < 0) return
  const {item, events} = await itemPage(run, row, 'e' + (Number(questionId.slice(1)) - 1))
  if (pendingQuestionId(item) !== questionId) return
  const event = events.find(entry => entry.id === questionId)
  const question = replyQuestions(item, event)[index]
  if (!event || !question || events.some(entry => optional(entry.data).answers === questionId)) return
  const bot = text(optional(item.owner).name, Infinity)
  const title = text(item.title, Infinity)
  const number = item.number
  if (!bot || !title || typeof number !== 'number' || !Number.isSafeInteger(number) || number < 1) return
  return {bot, title, number, at:time(event.at), question}
}

export async function readItemReplyTarget(
  run: Cli, row: Row, questionId?: string, index?: number
): Promise<ReplyTarget | ItemReplyTarget | 'choose' | 'changed' | undefined> {
  if (!row.bot || row.source !== 'Bot Item' || (questionId === undefined) !== (index === undefined)) return
  const {item} = await itemPage(run, row)
  const state = itemState(item.status)
  const active = pendingQuestionId(item)
  if (questionId !== undefined && index !== undefined) {
    if (questionId !== active) return 'changed'
    return await readReplyTarget(run, row, questionId, index) ?? 'changed'
  }
  if (state !== row.state || active !== (row.questionId ?? '')) return 'changed'
  if (state === 'input' || active) {
    const decisions = optional(item.question).decisions
    if (!active || !Array.isArray(decisions) || decisions.length !== 1) return 'choose'
    return await readReplyTarget(run, row, active, 0) ?? 'choose'
  }
  if (state === 'unknown') return
  const bot = text(optional(item.owner).name, Infinity)
  const title = text(item.title, Infinity)
  const number = item.number
  if (!bot || !title || typeof number !== 'number' || !Number.isSafeInteger(number) || number < 1) return
  return {bot, title, number, state, snoozed:time(item.snoozedUntil) > Date.now()}
}

export function pendingQuestionId(item: Fields): string {
  return text(item.waitingAsk) || (item.status === 'needs_you' ? text(optional(item.question).eventId) : '')
}

async function itemActivity(events: Fields[], snapshot: Fields, partial: boolean): Promise<Activity> {
  const comments = events.filter(event => event.kind === 'commented')
  const newest = comments.slice(-30)
  const attachments = newest.flatMap((event, index) => {
    const images = optional(event.data).images
    return Array.isArray(images) ? images.map(value => ({index,value})) : []
  })
  const visible = await Promise.all(attachments.slice(-4).map(async ({index,value}) =>
    ({index, preview:await itemImage(value)})))
  const entries = newest.flatMap((event, index): Entry[] => {
    const message = body(optional(event.data).text)
    const images = visible.flatMap(entry => entry.index === index && entry.preview ? [entry.preview] : [])
    return message || images.length ? [{
      ...itemSpeaker(optional(event.actor), snapshot), body:message, at:timestamp(event.at),
      ...(images.length ? {images} : {})
    }] : []
  })
  const activity = recent(commentSource, entries, partial || newest.length < comments.length)
  if (attachments.length !== visible.filter(entry => entry.preview).length) {
    activity.issue = joinCopy([...(activity.issue ? [activity.issue] : []),
      copy('Open the Item in Orca to see the remaining attachments.', '一部の添付画像はOrca標準の項目で確認してください。')], ' ')
  }
  return activity
}

function itemSpeaker(actor: Fields, item: Fields): Pick<Entry, 'author' | 'speaker' | 'kind'> {
  const owner = optional(item.owner)
  const maker = optional(item.madeBy)
  switch (actor.kind) {
    case 'owner': return {author:copy('You', 'あなた'), speaker:{side:'owner', id:'owner'}}
    case 'orca': return {author:'Orca', kind:'system'}
    case 'bot': {
      const id = typeof actor.botId === 'string' && actor.botId
      if (!id) return {author:copy('Bot', '対象Bot')}
      const author = id === owner.botId ? text(owner.name) || copy('Bot', '対象Bot') :
        id === maker.botId ? text(maker.name) || copy('Bot', '対象Bot') : copy('Another Bot', '別のBot')
      return {author, speaker:{side:'agent', id}}
    }
    default: return {author:copy('Unknown speaker', '発言者不明')}
  }
}

export async function botDetail(run: Cli, row: Row, observed: Detail['transitions'], shownQuestion?: string,
  current = () => true): Promise<Detail> {
  let page = await itemPage(run, row)
  const snapshot = page.item
  const events = [...page.events]
  const cursors = new Set<string>()
  const sameItem = (current: Fields) => current.lastEventId === snapshot.lastEventId &&
    current.version === snapshot.version
  // The public command reads up to 50 events per page, oldest first.
  while (page.next && cursors.size < 4) {
    if (cursors.has(page.next)) throw new Error('pagination_changed')
    cursors.add(page.next)
    page = await itemPage(run, row, page.next)
    if (!sameItem(page.item)) throw new Error('pagination_changed')
    events.push(...page.events)
  }
  const activeId = pendingQuestionId(snapshot)
  if (page.next && /^e[1-9]\d{0,14}$/.test(activeId) && !events.some(event => event.id === activeId)) {
    const activePage = await itemPage(run, row, 'e' + (Number(activeId.slice(1)) - 1))
    if (!sameItem(activePage.item)) throw new Error('pagination_changed')
    events.push(...activePage.events)
  }
  const unique = [...new Map(events.map(event => [event.id, event])).values()]
  const state = itemState(snapshot.status)
  const question = currentQuestion(snapshot, unique)
  const targets = replyQuestions(snapshot, unique.find(event => event.id === activeId))
    .flatMap((entry, index) => entry ? [index] : [])
  const previous = shownQuestion || row.questionId
  const changed = previous && previous !== question?.eventId
  const answered = previous && unique.some(event => event.kind === 'commented' &&
    optional(event.actor).kind === 'owner' && optional(event.data).answers === previous)
  const questionStatus = changed && question ? 'replaced' : changed && answered && state !== 'input'
    ? 'answered' : !question && (state === 'input' || previous) ? 'unverified' : undefined
  if (question && targets.length && !answered && process.platform === 'darwin') question.targets = targets
  const botName = text(optional(snapshot.owner).name) || row.bot || copy('Bot', '対象Bot')
  const itemName = typeof snapshot.number === 'number' ? '#' + String(snapshot.number) : row.ref
  const home = copy('Bot “' + botName + '” Home', 'Bot「' + botName + '」の Home')
  const step = state === 'input' ? copy('Needs you', '入力待ち') : copy('Items', '項目')
  const itemTitle = text(snapshot.title)
  const snoozed = time(snapshot.snoozedUntil) > Date.now()
  if (!current()) throw new Error('outside_activity_window')
  const [canOpen, relatedActivity, activity] = await Promise.all([
    row.bot && !snoozed ? uniqueLocalBot(run, row.bot).catch(() => false) : false,
    relatedBotConversation(run, row, optional(snapshot.chat), display(botName, 'en')),
    itemActivity(unique, snapshot, Boolean(page.next))
  ])
  const transitions = itemTransitions(unique).map(entry => entry.transition).sort((a, b) => b.at - a.at)
  if (page.next) {
    for (const move of observed) {
      if (!transitions.some(entry => entry.at === move.at && entry.from === move.from && entry.to === move.to)) {
        transitions.push(move)
      }
    }
    transitions.sort((a,b) => b.at - a.at)
  }
  return {
    state, question, questionStatus, transitions:transitions.slice(0, 100),
    reason:state === 'external' ? text(optional(snapshot.wait).text ?? optional(snapshot.wait).reason, Infinity) || undefined : undefined,
    activity,
    relatedActivity,
    issue:page.next ? copy('Showing part of the Bot Item history.', 'Bot Item履歴の一部を表示しています。') : undefined,
    action:canOpen ? 'bot-home' : undefined,
    navigationHint:snoozed ? copy('Open ' + display(home, 'en') + ' and check whether ' + itemName + ' is still snoozed.',
      display(home, 'ja') + ' の項目で ' + itemName + ' のスヌーズ状態を確認してください。') :
      joinCopy([home, step, copy(itemName + ' “' + itemTitle + '”', itemName + '「' + itemTitle + '」'),
        ...(question ? [copy('Question card', '質問カード')] : [])], ' → ')
  }
}

export async function uniqueLocalBot(run: Cli, botId: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(botId) || botId === 'access-request') return false
  const data = await run('bot', 'list')
  const matches = list(data.bots).filter(bot => bot.id === botId)
  return Array.isArray(data.unreachable) && data.unreachable.length === 0 &&
    matches.length === 1 && matches[0].server == null
}

async function relatedBotConversation(run: Cli, row: Row, chat: Fields, botName: string): Promise<Activity | undefined> {
  const id = text(chat.id, 256)
  if (!row.bot || !id || chat.gone === true) return
  const source = copy('Bot chat', 'Bot チャット')
  try {
    const data = await run('bot', 'chats', '--bot', row.bot, '--all')
    const matches = list(data.chats).filter(entry => entry.id === id)
    if (data.bot !== botName || matches.length !== 1) throw new Error('source_mismatch')
    const conversation = matches[0]
    const activity = await agentConversation(run, 'orca_session_id:' + identifier(id), 'chat', source)
    const title = text(conversation.title)
    if (conversation.closed === false) {
      const home = copy('Bot “' + botName + '”', 'Bot「' + botName + '」')
      if (conversation.home === true) activity.navigationHint = joinCopy([home, 'Home Chat'], ' → ')
      else if (title && list(data.chats).filter(entry => text(entry.title) === title && entry.closed === false).length === 1) {
        activity.navigationHint = joinCopy([home, 'Chats', copy('“' + title + '”', '「' + title + '」')], ' → ')
      }
    }
    return activity
  } catch (error) {
    return {source, entries:[], issue:errorLabel(error)}
  }
}

function chatSpeaker(value: unknown): Pick<Entry, 'author' | 'speaker' | 'kind'> {
  switch (value) {
    case 'user': return {author:copy('You', 'あなた'), speaker:{side:'owner', id:'user'}}
    case 'assistant': return {author:copy('Agent', 'エージェント'), speaker:{side:'agent', id:'assistant'}}
    case 'system': return {author:copy('System', 'システム'), kind:'system'}
    default: return {author:copy('Unknown speaker', '発言者不明')}
  }
}

function sameSession(value: unknown, ref: string): boolean {
  const prefix = /^orca_session_id:/
  return typeof value === 'string' && Boolean(value) && value.replace(prefix, '') === ref.replace(prefix, '')
}

function sameDay(first: number | undefined, next: number | undefined): boolean {
  if (first === undefined || next === undefined) return first === next
  return new Date(first).toDateString() === new Date(next).toDateString()
}

async function agentConversation(run: Cli, ref: string, kind: 'chat' | 'terminal', source: Copy): Promise<Activity> {
  // Tool activity consumes the CLI window before the panel can group it.
  const data = await run('agent', 'read', ref, '--limit', '100')
  if (!sameSession(data.orcaSessionId, ref) || data.kind !== kind ||
    data.source !== (kind === 'chat' ? 'chat' : 'transcript')) throw new Error('source_mismatch')
  const entries = list(data.entries)
  const messages: Entry[] = []
  let consecutive = false
  for (const entry of entries) {
    const message = body(entry.text)
    const at = timestamp(entry.at)
    // In Orca 1.4.277 the Codex imageView presentation becomes an assistant message
    // with exactly this text. Any surrounding prose or a user message keeps its text.
    const legacyView = kind === 'chat' && data.agent === 'codex' && entry.kind === 'message' &&
      entry.role === 'assistant' && /^(?:Viewed image\r?\n\[image\]|Image view: preview unavailable)$/.test(message.trim())
    if (legacyView || (entry.kind === 'tool' && entry.name === 'view_image')) {
      const previous = messages.at(-1)
      if (consecutive && previous?.kind === 'image-view' && sameDay(previous.at, at)) {
        previous.count = (previous.count ?? 1) + 1
      } else {
        messages.push({author:copy('Image viewed', '画像閲覧'), body:'', at, kind:'image-view', count:1})
      }
      consecutive = true
      continue
    }
    consecutive = false
    if (!message) continue
    if (entry.kind === 'message') messages.push({...chatSpeaker(entry.role), body:message, at})
    if (entry.kind === 'question') messages.push({
      ...chatSpeaker('assistant'), author:copy('Agent question', 'エージェントの質問'), body:message, at
    })
  }
  return recent(source, messages, data.limited === true || entries.some(entry => entry.shortened === true))
}

export async function sessionDetail(run: Cli, row: Row): Promise<Omit<Detail, 'transitions'>> {
  const chat = row.source === 'Orca チャット'
  const terminalOutput = !chat && row.target === row.ref
  const source = chat ? sourceNames[row.source] : terminalOutput ? copy('Terminal output', '端末出力') : copy('Terminal agent conversation', '端末エージェントの会話')
  const detail: Omit<Detail, 'transitions'> = {}
  if (chat && row.ref.startsWith('orca_session_id:')) {
    const unverified = copy('Could not verify the matching chat tab. Look for the existing tab in Orca using its workspace and title.', '同じチャットのタブを確認できません。所属とタイトルを確認してOrcaの既存タブを探してください。')
    detail.navigationHint = unverified
    try {
      const session = await run('agent', 'show', row.ref)
      if (!sameSession(session.orcaSessionId, row.ref) || session.kind !== 'chat') throw new Error('source_mismatch')
      const matches = list(session.places).filter(place => sameSession(place.orcaSessionId, row.ref) &&
        place.kind === 'chat' && place.hostId === 'local' && place.paneKey === row.pane &&
        place.worktreeId === row.workspace)
      if (matches.length === 1 && row.pane && row.workspace) {
        const tab = text(matches[0].title) || row.title
        const where = [text(matches[0].repo), text(matches[0].workspace)].filter(Boolean).join(' / ') || row.origin
        detail.navigationHint = copy(
          'Search for “' + display(tab, 'en') + '” in the Orca jump palette (⌘J by default) and open the existing chat in “' + display(where, 'en') + '” on this Mac.',
          'Orcaのジャンプパレット（既定 ⌘J）で「' + display(tab, 'ja') + '」を検索し、このMacの「' + display(where, 'ja') + '」にある既存チャットを開きます。')
      }
    } catch {
      // A saved session can have a readable conversation even when its open tab cannot be located.
    }
  }
  try {
    if (row.target && await terminalMatches(run, row).catch(() => false)) detail.action = 'terminal'
    if (row.ref.startsWith('orca_session_id:')) {
      detail.activity = await agentConversation(run, row.ref, chat ? 'chat' : 'terminal', source)
    } else if (terminalOutput && detail.action) {
      const data = record((await run('terminal', 'read', '--terminal', row.ref, '--limit', '40')).terminal)
      if (data.handle !== row.ref || data.source !== 'stream' || !Array.isArray(data.tail) ||
        data.tail.some(line => typeof line !== 'string') || !await terminalMatches(run, row)) {
        throw new Error('source_mismatch')
      }
      detail.activity = recent(source, data.tail.length ? [{
        author:copy('Terminal output', '端末出力'), kind:'terminal-output', body:data.tail.join('\n')
      }] : [],
        data.truncated === true || data.limited === true)
    } else throw new Error('source_unavailable')
  } catch (error) {
    detail.activity = {source, entries:[], issue:errorLabel(error)}
  }
  return detail
}

export async function workerConversation(run: Cli, row: Row): Promise<Activity> {
  const source = copy('Bot worker conversation', 'Bot ワーカーの会話')
  try {
    const data = await run('orchestration', 'worker-show', '--dispatch', row.ref, '--full')
    const worker = record(data.dispatch)
    if (worker.id !== row.ref || optional(data.observation).exactWorker !== true) throw new Error('source_mismatch')
    const ref = 'orca_session_id:' + identifier(worker.assigneeSessionId).replace(/^orca_session_id:/, '')
    const result = await run('agent', 'show', ref)
    if (!sameSession(result.orcaSessionId, ref) || (result.kind !== 'chat' && result.kind !== 'terminal')) {
      throw new Error('source_mismatch')
    }
    const activity = await agentConversation(run, ref, result.kind, source)
    const places = list(result.places ?? []).filter(place => place.hostId === 'local' && place.kind === result.kind &&
      sameSession(place.orcaSessionId, ref) && text(place.title) && text(place.workspace))
    if (places.length === 1) {
      const place = places[0]
      activity.navigationHint = copy('Reply in the existing ' + (result.kind === 'chat' ? 'chat' : 'terminal') +
        ' “' + text(place.title) + '” in “' + text(place.workspace) + '”.',
        '「' + text(place.workspace) + '」にある既存の' + (result.kind === 'chat' ? 'チャット' : 'ターミナル') +
        '「' + text(place.title) + '」がワーカーの入力先です。')
    }
    return activity
  } catch (error) {
    return {source, entries:[], issue:errorLabel(error)}
  }
}

export async function terminalMatches(run: Cli, row: Row): Promise<boolean> {
  if (!row.target || !row.pane || !row.workspace) return false
  const info = record((await run('terminal', 'show', '--terminal', row.target)).terminal)
  const pane = info.tabId && info.leafId ? info.tabId + ':' + info.leafId : info.recordedPaneKey
  return info.handle === row.target && info.connected === true && info.orphaned === false &&
    info.executionHostId === 'local' && info.worktreeId === row.workspace && pane === row.pane &&
    (text(info.incarnationId) || undefined) === row.targetIncarnation
}
