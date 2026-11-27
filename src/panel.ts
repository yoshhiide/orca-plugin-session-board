import { display, language, type Copy } from './language'
import { isBot, sourceNames, states, type Board, type Detail, type Source, type State } from './model'
import type {} from './protocol'
import { renderActivity } from './activity-view'

const doc = document
const locale = language(orca.locale)
const label = (value: Copy) => display(value, locale)
const t = (en: string, ja: string) => locale === 'ja' ? ja : en
const date = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' })
const stamp = (at: number) => at ? date.format(at) : t('Unknown time', '日時不明')
const relativeTime = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
const number = new Intl.NumberFormat(locale)
const kinds: Record<Source, string> = {
  'Bot Item': 'Bot', 'Bot ワーカー': t('Worker', 'ワーカー'), 'Orca チャット': t('Chat', 'チャット'),
  'Orca ターミナル': t('Terminal', '端末')
}

function age(at: number, now: number) {
  const minutes = Math.trunc((at - now) / 60_000)
  if (!minutes) return t('just now', 'たった今')
  if (Math.abs(minutes) < 60) return relativeTime.format(minutes, 'minute')
  if (Math.abs(minutes) < 1440) return relativeTime.format(Math.trunc(minutes / 60), 'hour')
  return relativeTime.format(Math.trunc(minutes / 1440), 'day')
}

function node<K extends keyof HTMLElementTagNameMap>(tag: K, content = '', className = '') {
  const element = doc.createElement(tag)
  element.textContent = content
  if (className) element.className = className
  return element
}
function button(label: string, run: () => void, className = '') {
  const element = node('button', label, className)
  element.type = 'button'
  element.addEventListener('click', run)
  return element
}

const style = doc.createElement('link')
style.rel = 'stylesheet'
style.href = new URL('./panel.css', import.meta.url).href
doc.head.append(style)
doc.documentElement.lang = locale
doc.title = t('Session Board', 'セッションボード')

const root = node('main')
const header = node('header')
const heading = node('div', '', 'bar top')
const title = node('h1', t('Sessions', 'セッション'))
const refresh = button(t('Refresh', '更新'), async () => {
  refresh.disabled = true
  try { accept(await orca.plugin.request('board.refresh', {locale})) }
  catch { status.textContent = t('Could not connect to the worker. Select Refresh to try again.', 'ワーカーに接続できません。更新で再試行できます。') }
  finally { refresh.disabled = false }
})
heading.append(title, refresh)
const tabbar = node('div', '', 'bar')
tabbar.setAttribute('role', 'group')
tabbar.setAttribute('aria-label', t('Session filter', '表示する対象'))
const viewbar = node('div', '', 'bar')
viewbar.setAttribute('role', 'group')
viewbar.setAttribute('aria-label', t('View layout', '表示形式'))
const query = node('input')
query.type = 'search'
query.placeholder = t('Search sessions', 'セッションを検索')
query.setAttribute('aria-label', query.placeholder)
query.oninput = render
const status = node('p', t('Loading…', '取得中…'), 'status')
status.setAttribute('role', 'status')
const health = node('details', '', 'health')
const healthTitle = node('summary', t('Source status', '取得状況'))
const healthList = node('ul')
health.append(healthTitle, healthList)
const results = node('section')
results.setAttribute('aria-label', t('Session list', 'セッション一覧'))
header.append(heading, tabbar, query, viewbar, status, health)
root.append(header, results)
doc.body.append(root)

const dialog = node('section', '', 'detail')
dialog.id = 'session-detail'
const dialogHead = node('header', '', 'detail-head')
const dialogTitle = node('h2')
dialogTitle.id = 'session-title'
dialog.setAttribute('aria-labelledby', dialogTitle.id)
const back = button(t('← Sessions', '← セッション一覧'), closeDetail, 'back')
const detailControls = node('div', '', 'bar top')
const retryDetail = button(t('Refresh', '更新'), () => loadDetail(opened, viewedQuestionId))
dialogTitle.tabIndex = -1
detailControls.append(back, retryDetail)
dialogHead.append(detailControls, dialogTitle)
const details = node('div', '', 'detail-meta')
const action = node('div', '', 'bar')
const detailStatus = node('p', '', 'status')
detailStatus.setAttribute('role', 'status')
const question = node('section', '', 'question')
const tabs = node('div', '', 'tabs')
tabs.setAttribute('role', 'tablist')
tabs.setAttribute('aria-label', t('Session details', '詳細表示'))
const activity = node('section', '', 'activity')
const timeline = node('section', '', 'timeline')
activity.id = 'activity'; timeline.id = 'history'
activity.setAttribute('role', 'tabpanel'); timeline.setAttribute('role', 'tabpanel')
const activityTab = button('Activity', () => selectDetailTab(true), 'tab')
const historyTab = button(t('State history', '状態履歴'), () => selectDetailTab(false), 'tab')
activityTab.id = 'activity-tab'; historyTab.id = 'history-tab'
activityTab.setAttribute('role', 'tab'); historyTab.setAttribute('role', 'tab')
activityTab.setAttribute('aria-controls', activity.id); historyTab.setAttribute('aria-controls', timeline.id)
activity.setAttribute('aria-labelledby', activityTab.id); timeline.setAttribute('aria-labelledby', historyTab.id)
tabs.append(activityTab, historyTab)
dialog.append(dialogHead, details, detailStatus, question, action, tabs, activity, timeline)
dialog.hidden = true
root.after(dialog)
function selectDetailTab(showActivity: boolean) {
  activity.hidden = !showActivity; timeline.hidden = showActivity
  activityTab.setAttribute('aria-selected', String(showActivity)); historyTab.setAttribute('aria-selected', String(!showActivity))
  activityTab.tabIndex = showActivity ? 0 : -1; historyTab.tabIndex = showActivity ? -1 : 0
}
selectDetailTab(true)
tabs.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const showActivity = event.key === 'Home' || (event.key !== 'End' && doc.activeElement === historyTab)
  selectDetailTab(showActivity)
  ;(showActivity ? activityTab : historyTab).focus()
})

let board: Board | undefined
let filter: 'all' | 'bot' | 'session' = 'all'
let layout: 'list' | 'board' = 'list'
let opened = ''
let generation = 0
let viewedQuestionId: string | undefined
function closeDetail() {
  const previous = rowButton(opened)
  opened = ''
  viewedQuestionId = undefined
  generation++
  currentDetail = undefined
  details.replaceChildren(); question.replaceChildren(); action.replaceChildren()
  activity.replaceChildren(); timeline.replaceChildren()
  dialog.hidden = true
  root.hidden = false
  ;(previous ?? query).focus()
}
dialog.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return
  event.preventDefault()
  closeDetail()
})
for (const [key, label] of [['all', t('All', 'すべて')], ['bot', 'Bot'], ['session', t('Regular', '通常')]] as const) {
  const control = button(label, () => { filter = key; render() })
  control.dataset.value = key
  tabbar.append(control)
}
for (const [key, label] of [['list', t('List', 'リスト')], ['board', t('Board', 'ボード')]] as const) {
  const control = button(label, () => { layout = key; render() })
  control.dataset.value = key
  viewbar.append(control)
}

function selectControls(group: HTMLElement, value: string) {
  for (const control of group.querySelectorAll('button')) {
    control.setAttribute('aria-pressed', String(control.dataset.value === value))
  }
}
function accept(value: Board) {
  if (!value.sources.length && board?.sources.length) return
  const previous = board?.rows.find(row => row.id === opened)
  const next = value.rows.find(row => row.id === opened)
  board = value
  render()
  if (!opened) return
  if (!next) {
    closeDetail()
    return
  }
  const changed = !previous || previous.cursor !== next.cursor || previous.state !== next.state ||
    previous.stale !== next.stale || previous.questionId !== next.questionId
  if (!changed) return
  if (!next.stale) loadDetail(opened, viewedQuestionId)
  else {
    generation++
    currentDetail = undefined
    detailStatus.textContent = t('Could not load this session. Select Refresh to try again.', '取得できません。更新して再試行してください。')
    activity.replaceChildren(); timeline.replaceChildren(); renderDetails()
  }
}

function rowButton(id: string) {
  return [...results.querySelectorAll('button')].find(control => control.dataset.row === id)
}

function render() {
  selectControls(tabbar, filter)
  selectControls(viewbar, layout)
  if (!board) return
  const {rows, sources, notificationIssue, hiddenRows} = board
  const unavailable = sources.filter(source => source.issue).length
  const input = rows.filter(row => row.state === 'input' && !row.stale).length
  status.textContent = !sources.length ? t('Loading…', '取得中…') :
    t(number.format(input) + (input === 1 ? ' session needs input' : ' sessions need input'),
      '入力待ち ' + number.format(input) + ' 件') +
    (unavailable ? t(' · ' + number.format(unavailable) + (unavailable === 1 ? ' unavailable source' : ' unavailable sources'),
      ' · 取得できないソース ' + number.format(unavailable) + ' 件') : '') +
    (notificationIssue ? t(' · Notification error', ' · 通知エラー') : '')
  healthList.replaceChildren(...sources.map(source =>
    node('li', label(source.label) + ' · ' + (source.at ? stamp(source.at) : t('No successful fetch', '未取得')) +
      (source.issue ? ' · ' + label(source.issue) : ''))))
  if (notificationIssue) healthList.append(node('li', label(notificationIssue)))
  if (hiddenRows) healthList.append(node('li', t(number.format(hiddenRows) +
    (hiddenRows === 1 ? ' session hidden by the display limit.' : ' sessions hidden by the display limit.'),
    '表示上限により ' + number.format(hiddenRows) + ' 件を省略しました。')))
  healthList.append(node('li', t('Bot work and chats refresh every 15 seconds. Brief transitions can be missed between refreshes.', 'Botとチャットは15秒ごとに取得します。差分取得では短い遷移を見落とす場合があります。')))
  healthList.append(node('li', t('After you open this panel, monitoring continues while the worker is running.', '一度開くと、ワーカー稼働中はパネルを閉じても監視します。')))
  const words = query.value.normalize('NFKC').toLocaleLowerCase('ja').trim().split(/\s+/).filter(Boolean)
  const filtered = rows.filter(row => {
    if (filter !== 'all' && (filter === 'bot') !== isBot(row)) return false
    const searchable = [label(row.title), label(row.origin), row.ref, label(sourceNames[row.source]), kinds[row.source],
      label(states[row.state]), row.reason].join(' ')
      .normalize('NFKC').toLocaleLowerCase('ja')
    return words.every(word => searchable.includes(word))
  })
  const focusedElement = doc.activeElement as HTMLElement | null
  const focused = focusedElement?.dataset.row
  const focusedReply = focusedElement?.dataset.rowReply
  const now = Date.now()
  results.classList.toggle('board', layout === 'board')
  const groups = (Object.keys(states) as State[]).flatMap(state => {
    const group = filtered.filter(row => row.state === state)
    if (!group.length) return []
    const block = node('section', '', 'group ' + state)
    const groupTitle = node('h2', label(states[state]))
    groupTitle.append(node('span', number.format(group.length), 'count'))
    const list = node('ul')
    for (const row of group) {
      const control = button('', () => open(row.id), 'entry')
      control.dataset.row = row.id
      control.setAttribute('aria-controls', dialog.id)
      const primary = node('span', '', 'row-line')
      primary.append(node('span', kinds[row.source], 'row-kind'), node('span', label(row.title), 'row-title'))
      const secondary = node('span', '', 'row-line meta')
      secondary.append(node('span', label(row.origin), 'row-origin'))
      if (row.reason) secondary.append(node('span', row.reason, 'row-reason'))
      if (row.stale) secondary.append(node('span', t('Unavailable', '取得不能'), 'row-age'))
      else if (row.at) {
        const time = node('time', age(row.at, now), 'row-age')
        time.dateTime = new Date(row.at).toISOString()
        secondary.append(time)
      }
      control.append(primary, secondary)
      const item = node('li')
      item.className = 'entry-row'
      item.append(control)
      if (row.source === 'Bot Item') {
        const reply = button(t('Reply', '返信'), () => void replyToItem(row.id), 'row-reply')
        reply.dataset.rowReply = row.id
        reply.setAttribute('aria-label', t('Reply to ' + label(row.title) + ' (' + label(row.origin) + ')',
          label(row.title) + 'に返信（' + label(row.origin) + '）'))
        reply.disabled = row.stale
        item.append(reply)
      }
      list.append(item)
    }
    block.append(groupTitle, list)
    return [block]
  })
  results.replaceChildren(...groups)
  if (!groups.length && sources.length) results.append(node('p',
    unavailable ? t('No sessions to show. Check Source status.', '表示できるセッションがありません。取得状況を確認してください。') :
      t('No matching sessions.', '該当するセッションはありません。'), 'status'))
  if (focused || focusedReply) {
    const next = (focusedReply && [...results.querySelectorAll<HTMLButtonElement>('.row-reply')].find(control => control.dataset.rowReply === focusedReply)) || (focused && rowButton(focused)) || query
    next.focus({preventScroll:true})
  }
}
async function replyToItem(id: string, questionId?: string, index?: number) {
  try {
    const result = await orca.plugin.request('board.reply', questionId === undefined ? {id} : {id, questionId, index: index!})
    if (result.reason === 'choose') {
      if (opened !== id) open(id)
      else loadDetail(id)
      return
    }
    if (result.reason === 'read-only') {
      if (opened === id) detailStatus.textContent = t('Opened the Item in Orca in read-only mode.', '標準画面を開きました。編集はできません。')
      else status.textContent = t('Opened the Item in Orca in read-only mode.', '標準画面を開きました。編集はできません。')
    } else if (!result.opened) {
      const messages = {
        changed: t('The Item changed. Review the latest details.', '状態が変わりました。内容を確認してください。'),
        'accessibility-required': t('To open the reply, allow Orca Computer Use in macOS Accessibility settings.', '返信画面を開くには、macOSのアクセシビリティ設定でOrca Computer Useを許可してください。'),
        'bot-home-unavailable': t('Could not verify that the Bot’s Home opened. Open the target Bot’s Home Chat and try again.', '対象Botのホームが開いたことを確認できませんでした。対象BotのHome Chatを開いてから再試行してください。')
      }
      const message = result.reason ? messages[result.reason] : t('Could not verify the reply composer in Orca.', '標準の返信画面を確認できませんでした。')
      if (opened === id) loadDetail(id, questionId, message)
      else open(id, message)
    }
  } catch {
    if (opened === id) detailStatus.textContent = t('Could not open the reply composer. Select Refresh to try again.', '返信画面を開けませんでした。更新して再試行してください。')
    else status.textContent = t('Could not open the reply composer. Select Refresh to try again.', '返信画面を開けませんでした。更新して再試行してください。')
  }
}
let currentDetail: Detail | undefined
function renderDetails() {
  const row = board?.rows.find(entry => entry.id === opened)
  if (!row) {
    const hadActionFocus = action.contains(doc.activeElement)
    dialogTitle.textContent = t('Session unavailable', '対象を取得できません')
    details.replaceChildren(); question.replaceChildren(); action.replaceChildren()
    if (hadActionFocus) back.focus({preventScroll: true})
    return
  }
  dialogTitle.textContent = label(row.title)
  const meta = node('p', [kinds[row.source], label(row.origin), row.at ? age(row.at, Date.now()) : t('Unknown time', '日時不明')].join(' · '), 'muted')
  const state = currentDetail?.state ?? row.state
  const badge = node('span', label(states[state]) + (row.stale ? t(' (unavailable)', '（取得不能）') : ''), 'badge ' + state)
  details.replaceChildren(meta, badge)
  if (row.at) details.append(node('p', t('Updated: ', '更新：') + stamp(row.at), 'small detail-updated'))
  const reason = currentDetail?.reason ?? (state === 'external' && !row.stale ? row.reason : undefined)
  if (reason && reason !== currentDetail?.question?.prompt) details.append(node('p', reason, 'detail-reason'))
  const focusedReply = (doc.activeElement as HTMLElement | null)?.dataset.replyIndex
  const hadActionFocus = action.contains(doc.activeElement)
  question.replaceChildren()
  const q = currentDetail?.question
  if (q && !row.stale && currentDetail?.questionStatus !== 'answered' && currentDetail?.questionStatus !== 'unverified') {
    question.append(node('h3', currentDetail?.questionStatus === 'replaced' ? t('Current question', '現在の質問') : t('Awaiting your answer', '回答を待っています')))
    const addPrompt = (prompt: string, options: string[], index: number) => {
      const group = node('div', '', 'question-prompt')
      if (prompt) group.append(node('p', prompt))
      if (options.length) {
        const choices = node('ul', '', 'read-choices')
        choices.append(...options.map(choice => node('li', choice)))
        group.append(choices)
      }
      if (row.source === 'Bot Item' && state === 'input' && q.eventId && q.targets?.includes(index)) {
        const control = button(t('Answer in Orca', '標準画面で回答'), () => void replyToItem(opened, q.eventId, index), 'primary reply')
        control.dataset.replyIndex = String(index)
        group.append(control)
      }
      question.append(group)
    }
    if (q.decisions?.length) {
      if (q.prompt) question.append(node('p', q.prompt))
      if (q.options.length) {
        const choices = node('ul', '', 'read-choices')
        choices.append(...q.options.map(choice => node('li', choice)))
        question.append(choices)
      }
      q.decisions.forEach((decision, index) => addPrompt(decision.prompt, decision.options, index))
    } else addPrompt(q.prompt, q.options, 0)
  }
  question.hidden = !question.childElementCount
  action.replaceChildren()
  if (row.source === 'Bot Item') {
    const reply = button(t('Reply', '返信'), () => void replyToItem(row.id), 'primary')
    reply.disabled = row.stale
    action.append(reply)
  }
  const kind = currentDetail?.action
  const actionLabel = kind === 'bot-home' ? t('Open Bot Home ↗', 'Bot Homeを開く ↗') : kind === 'terminal' ? t('Open terminal ↗', 'ターミナルを開く ↗') : ''
  if (actionLabel && !row.stale && row.source !== 'Bot Item') action.append(button(actionLabel, async () => {
    const targetId = opened
    try {
      const questionId = currentDetail?.question?.eventId
      const input = questionId ? { id: targetId, questionId } : { id: targetId }
      const result = await orca.plugin.request('board.focus', input)
      if (targetId !== opened) return
      if (!result) {
        detailStatus.textContent = t('Could not verify the destination. Refreshing details…', '移動先を確認できませんでした。詳細を更新します。')
        loadDetail(targetId, questionId, t('Could not open the destination. Check the navigation instructions.', '移動先を開けませんでした。表示した経路を確認してください。'))
      }
    } catch { if (targetId === opened) detailStatus.textContent = t('Could not open the destination. Select Refresh to try again.', '移動先を開けませんでした。更新して再試行してください。') }
  }, 'primary'))
  if (currentDetail?.navigationHint && row.source !== 'Bot Item' && !question.querySelector('.reply')) action.append(node('p', label(currentDetail.navigationHint), 'route'))
  if (!question.hidden) question.append(action)
  else dialog.insertBefore(action, tabs)
  if (focusedReply !== undefined) (question.querySelector<HTMLElement>(`[data-reply-index="${focusedReply}"]`) ?? back).focus({preventScroll: true})
  else if (hadActionFocus) (action.querySelector('button') ?? back).focus({preventScroll: true})
}
function loadDetail(id: string, questionId?: string, actionIssue?: string) {
  const replyFocus = (doc.activeElement as HTMLElement | null)?.dataset.replyIndex
  const restoreActionFocus = action.contains(doc.activeElement) || replyFocus !== undefined
  const request = ++generation
  currentDetail = undefined
  detailStatus.textContent = t('Loading details…', '詳細を取得中…')
  activity.replaceChildren(); timeline.replaceChildren()
  renderDetails()
  void orca.plugin.request('board.detail', questionId ? {id, questionId} : {id}).then((result: Detail) => {
    if (request !== generation) return
    currentDetail = result
    viewedQuestionId = result.question?.eventId ?? viewedQuestionId
    const notices = { answered: t('This question has been answered.', 'この質問は回答済みです。'), replaced: t('The question has changed.', '質問が更新されています。'), unverified: t('Could not verify the status of this question.', '質問の状態を確認できません。') }
    detailStatus.textContent = [result.questionStatus ? notices[result.questionStatus] : '',
      result.issue ? label(result.issue) : actionIssue].filter(Boolean).join(' ')
    activity.replaceChildren()
    if (result.activity) renderActivity(activity, result.activity, false, result.activity.navigationHint ?? result.navigationHint)
    else activity.append(node('p', t('Could not load Activity.', 'Activityを取得できません。'), 'small source'))
    if (result.relatedActivity) renderActivity(activity, result.relatedActivity, true, result.relatedActivity.navigationHint)
    timeline.replaceChildren(...result.transitions.map(move => {
      const item = node('div', '', 'history-row')
      item.append(node('span', label(states[move.from]) + ' → ' + label(states[move.to])),
        node('p', stamp(move.at) + ' · ' + label(move.via), 'small'))
      return item
    }))
    if (!result.transitions.length) timeline.append(node('p', t('No recorded state changes.', '確認できる遷移はありません。'), 'small source'))
    renderDetails()
    if (restoreActionFocus && doc.activeElement === back) {
      const reply = replyFocus === undefined ? null : question.querySelector<HTMLElement>(`[data-reply-index="${replyFocus}"]`)
      ;(reply ?? action.querySelector('button') ?? back).focus({preventScroll: true})
    }
  }).catch(() => {
    if (request === generation) { currentDetail = undefined; detailStatus.textContent = t('Could not load details.', '詳細を取得できません。'); activity.replaceChildren(); timeline.replaceChildren(); renderDetails() }
  })
}
function open(id: string, actionIssue?: string) {
  opened = id
  viewedQuestionId = undefined
  currentDetail = undefined
  activity.replaceChildren(); timeline.replaceChildren()
  detailStatus.textContent = t('Loading details…', '詳細を取得中…')
  renderDetails()
  root.hidden = true; dialog.hidden = false
  selectDetailTab(true)
  dialogTitle.focus()
  loadDetail(id, undefined, actionIssue)
}

render()
const subscription = orca.plugin.on('board.changed', accept)
window.addEventListener('pagehide', () => subscription.dispose(), { once:true })
void orca.plugin.request('board.start', {locale}).then(accept).catch(() => {
  status.textContent = t('Could not connect to the worker. Select Refresh to try again.', 'ワーカーに接続できません。更新で再試行できます。')
})
