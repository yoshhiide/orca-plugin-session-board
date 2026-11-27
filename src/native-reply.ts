import { randomUUID } from 'node:crypto'
import { list, optional, type Cli } from './sources'
import type { State } from './model'

export type ReplyChoice = {label: string; detail?: string}
export type ReplyQuestion = {prompt: string; choices: ReplyChoice[]}
type ItemIdentity = {bot: string; number: number; title: string}
export type ReplyTarget = ItemIdentity & {at: number; question: ReplyQuestion}
export type ItemReplyTarget = ItemIdentity & {state: State; snoozed: boolean}
type NativeTarget = ReplyTarget | ItemReplyTarget
export type NativeReplyIssue = 'platform-unavailable' | 'accessibility-required' | 'window-unavailable' |
  'bot-home-unavailable' | 'item-unavailable' | 'question-unavailable' | 'composer-unavailable'
export type ReplyStage = 'preflight' | 'bot-home' | 'item' | 'question' | 'composer'

const statusNames: Record<State, string[]> = {
  input:['Needs you'], working:['In progress'], external:['Waiting'], planned:['Planned'],
  done:['Done'], cancelled:['Canceled', 'Cancelled'], blocked:[], waiting:[], failed:[], unknown:[]
}
const groupNames = ['Needs you', 'In progress', 'Waiting', 'Planned', 'Snoozed', 'Stale', 'Closed']

type AxNode = { depth: number; index: string; label: string; parent?: AxNode }
type AxState = { nodes: AxNode[]; focused: string; disabled: Set<string> }
const app = 'com.stablyai.orca'
const placeholder = 'Reply in your own words, or pick an option'
const homeToolbar = /^button (?:ホーム, 要対応 [0-9]+ 件|Home, [0-9]+ needs you|ホーム|Home)$/
const sessionBoardTool = /^button (?:Session Board|セッションボード)$/
const choiceText = (choice: ReplyChoice) => choice.detail ? choice.label + ' ' + choice.detail : choice.label

function one<T>(values: T[]): T | undefined {
  return values.length === 1 ? values[0] : undefined
}

function under(node: AxNode, ancestor: AxNode): boolean {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent === ancestor) return true
  }
  return false
}

function parse(result: Awaited<ReturnType<Cli>>, window: number): AxState {
  const snapshot = optional(result.snapshot)
  const frame = optional(snapshot.window)
  if (frame.id !== window || frame.isMinimized !== false || frame.isOffscreen !== false ||
    optional(snapshot.app).bundleId !== app || optional(snapshot.truncation).truncated !== false ||
    snapshot.treeDiff || typeof snapshot.treeText !== 'string' || !Array.isArray(snapshot.disabledElementIndexes)) {
    throw new Error('native_snapshot_unavailable')
  }
  const nodes: AxNode[] = []
  const ancestors: AxNode[] = []
  for (const line of snapshot.treeText.split('\n')) {
    const match = /^(\t+)(\d+) (.*)$/.exec(line)
    if (!match) continue
    const depth = match[1].length
    while (ancestors.length && ancestors.at(-1)!.depth >= depth) ancestors.pop()
    const node = {depth, index:match[2], label:match[3], parent:ancestors.at(-1)}
    ancestors.push(node)
    nodes.push(node)
  }
  return {nodes, focused:String(snapshot.focusedElementId), disabled:new Set(snapshot.disabledElementIndexes.map(String))}
}

function sameHome({nodes}: AxState, bot: string): boolean {
  // Newer Orca builds name the active Bot in the native chat composer's footer.
  const composers = new Set(nodes.filter(node => /^text entry area \(settable\) Ask anything, @ to mention bots or files, \/ for commands\b/.test(node.label))
    .map(node => node.parent).filter(Boolean))
  const footers = nodes.filter(node => composers.has(node.parent) &&
    (node.label.startsWith('button Copy ') || /^button .+ をコピー$/.test(node.label)))
  if (footers.length) {
    const footer = one(footers)?.label
    return footer === 'button Copy ' + bot || footer === 'button ' + bot + ' をコピー'
  }
  return !!one(nodes.filter(node => node.label === "button Open " + bot + "'s page" ||
    node.label === 'button ' + bot + 'のページを開く'))
}

function homeBack({nodes}: AxState): AxNode | undefined {
  return one(nodes.filter(node => {
    if (node.label !== 'button ホーム' && node.label !== 'button Home') return false
    const panel = node.parent
    if (!panel?.parent || !/^(?:container|container ホーム|container Home)$/.test(panel.label)) return false
    return nodes.some(sibling => sibling.parent === panel.parent && homeToolbar.test(sibling.label)) &&
      nodes.some(sibling => sibling.parent === panel.parent && sessionBoardTool.test(sibling.label)) &&
      nodes.some(heading => under(heading, panel) && /^heading #[0-9]+ /.test(heading.label))
  }))
}

function itemScope(state: AxState, target: NativeTarget): AxNode | undefined {
  const heading = one(state.nodes.filter(node => node.label === 'heading #' + target.number + ' ' + target.title))
  const scope = heading?.parent?.parent?.parent
  const home = homeBack(state)?.parent
  const statuses = statusNames['question' in target ? 'input' : target.state]
  if (!home || !scope || scope.parent !== home ||
    !state.nodes.some(node => node.parent === heading?.parent &&
      statuses.some(status => node.label === 'pop up button ' + status))) return
  return scope
}

function homePanel({nodes}: AxState, bot: string): AxNode | undefined {
  return one(nodes.filter(node => node.label === 'text ' + bot && node.parent &&
    nodes.some(sibling => sibling.parent === node.parent && sibling.label === 'pop up button Edit bot picture')))?.parent
}

function homeItem(state: AxState, target: NativeTarget): AxNode | undefined {
  const prefix = 'button #' + target.number + ' ' + target.title
  const panel = homePanel(state, target.bot)
  if (!panel) return
  const lists = state.nodes.filter(node => under(node, panel) &&
    groupNames.some(group => node.label === 'content list ' + group))
  return one(state.nodes.filter(node => (node.label === prefix || node.label.startsWith(prefix + ' ')) &&
    lists.some(group => under(node, group))))
}

function itemGroups(target: NativeTarget): string[] {
  if ('question' in target) return ['Needs you']
  if (target.snoozed) return ['Snoozed']
  if (target.state === 'done' || target.state === 'cancelled') return ['Closed']
  return [...statusNames[target.state], 'Stale']
}

function listControl(state: AxState, target: NativeTarget, matches: (label: string, group: string) => boolean): AxNode | undefined {
  const panel = homePanel(state, target.bot)
  if (!panel) return
  for (const group of itemGroups(target)) {
    const heading = one(state.nodes.filter(node => node.label === 'heading ' + group && under(node, panel)))
    if (!heading?.parent?.parent) continue
    const control = one(state.nodes.filter(node => (node.parent === heading.parent ||
      node.parent === heading.parent!.parent) && matches(node.label, group)))
    if (control) return control
  }
}

function collapsedGroup(label: string, group: string): boolean {
  const prefix = 'button ' + group + ' '
  return label === 'button (collapsed)' || (label.startsWith(prefix) && /^[0-9]+$/.test(label.slice(prefix.length)))
}

function exactQuestion(state: AxState, scope: AxNode, target: ReplyTarget) {
  const names = ['ja-JP', 'en-US', Intl.DateTimeFormat().resolvedOptions().locale].map(locale =>
    'container ' + target.bot + ', ' + new Intl.DateTimeFormat(locale, {dateStyle:'full', timeStyle:'long'}).format(target.at))
  const card = one(state.nodes.filter(node => under(node, scope) && names.includes(node.label)))
  if (!card) return
  const children = state.nodes.filter(node => node.parent === card)
  if (!children.some(node => node.label === 'text Needs you')) return
  const prompt = one(children.filter(node => node.label === 'text ' + target.question.prompt))
  if (!prompt) return
  const start = children.indexOf(prompt) + 1
  const controls = children.slice(start, start + target.question.choices.length + 1)
  const button = controls.at(-1)
  if (!target.question.choices.length && button?.label !== 'button Type your answer') {
    const reply = 'button Replying to: ' + target.question.prompt + '. Show question'
    if (one(state.nodes.filter(node => under(node, scope) && node.label === reply))) return 'already-bound' as const
  }
  if (controls.length !== target.question.choices.length + 1 || button?.label !== 'button Type your answer') return
  const matches = (label: (choice: ReplyChoice) => string) =>
    target.question.choices.every((choice, index) => controls[index].label === label(choice))
  // A one-line ask shows immediate reply buttons. A multi-line ask shows unselected toggles.
  if (!matches(choice => 'button ' + choiceText(choice)) &&
    !matches(choice => 'toggle button ' + choiceText(choice) + ', Value: 0')) return
  return button
}

function boundQuestion(state: AxState, scope: AxNode, target: ReplyTarget): boolean {
  const reply = 'button Replying to: ' + target.question.prompt + '. Show question'
  return !!one(state.nodes.filter(node => under(node, scope) && node.label === reply))
}

function emptyComposer(state: AxState, scope: AxNode, bot: string): AxNode | undefined {
  const nodes = state.nodes.filter(node => under(node, scope))
  const input = commentComposer(state, scope)
  if (!input || ![placeholder, 'Reply to ' + bot + '…'].some(text =>
    (input.label === 'text entry area (settable) コメント ' + text || input.label === 'text entry area (settable) Comment ' + text) &&
    nodes.some(node => node.parent === input && node.label === 'text ' + text))) return
  if (!nodes.some(node => /^button \(disabled\) (?:コメント|Comment)$/.test(node.label))) return
  return input
}

function commentComposer(state: AxState, scope: AxNode): AxNode | undefined {
  return one(state.nodes.filter(node => under(node, scope) &&
    /^text entry area \(settable\) (?:コメント|Comment)(?: |$)/.test(node.label) &&
    !state.disabled.has(node.index)))
}

export async function nativeReply(
  run: Cli, target: NativeTarget, stillCurrent: () => Promise<boolean>, signal: AbortSignal,
  openHome: () => Promise<boolean>, stage?: (value: ReplyStage) => void
): Promise<boolean | 'read-only' | NativeReplyIssue> {
  const deadline = Date.now() + 22_000
  const active = () => !signal.aborted && Date.now() < deadline
  stage?.('preflight')
  const [permission, windowList] = await Promise.all([
    run('computer', 'permissions'), run('computer', 'list-windows', '--app', app)
  ])
  if (permission.platform !== 'darwin') return 'platform-unavailable'
  if (!list(permission.permissions).some(entry => entry.id === 'accessibility' && entry.status === 'granted')) return 'accessibility-required'
  const window = one(list(windowList.windows).filter(frame =>
    optional(frame.app).bundleId === app && frame.isOffscreen === false && frame.isMinimized === false))
  if (!window || typeof window.id !== 'number') return 'window-unavailable'
  const windowId = window.id
  const args = ['--app', app, '--window-id', String(windowId), '--session', 'board-reply-' + randomUUID(), '--no-screenshot']
  const read = async () => parse(await run('computer', 'get-app-state', ...args), windowId)
  async function waitFor(predicate: (state: AxState) => boolean, initial?: AxState | boolean) {
    if (typeof initial === 'object' && active() && predicate(initial)) return initial
    for (let attempt = 0; attempt < 5 && active(); attempt++) {
      const state = await read()
      if (predicate(state)) return state
      await new Promise(resolve => setTimeout(resolve, 160))
    }
  }
  async function press(state: AxState, find: (view: AxState) => AxNode | undefined): Promise<AxState | boolean> {
    for (let attempt = 0; attempt < 2 && active() && sameHome(state, target.bot); attempt++) {
      const node = find(state)
      if (!node || state.disabled.has(node.index)) return false
      try {
        // AXPress is explicitly requested so Orca cannot fall back to a pointer or foreground action.
        const result = await run('computer', 'perform-secondary-action', ...args,
          '--element-index', node.index, '--action', 'AXPress', '--full-tree')
        const action = optional(result.action)
        if (action.path !== 'accessibility' || action.delivery !== 'background' || action.targetWindowId !== windowId) return false
        try { return parse(result, windowId) } catch { return true }
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'element_not_found') throw error
        if (attempt || !active() || !await stillCurrent()) return false
        state = await read()
      }
    }
    return false
  }
  const [first, current] = await Promise.all([read(), stillCurrent()])
  if (!active() || !current) return false
  let state = first
  stage?.('bot-home')
  if (!sameHome(state, target.bot)) {
    if (!active() || !await openHome()) return 'bot-home-unavailable'
    const home = await waitFor(view => sameHome(view, target.bot))
    if (!home) return 'bot-home-unavailable'
    state = home
  }

  stage?.('item')
  let afterItem: AxState | boolean = state
  if (!itemScope(state, target)) {
    const homeVisible = (view: AxState) => sameHome(view, target.bot) &&
      !!(itemScope(view, target) || homePanel(view, target.bot) || homeBack(view))
    if (!homeVisible(state)) {
      const opened = await press(state, ({nodes}) => one(nodes.filter(node => homeToolbar.test(node.label) &&
        nodes.some(sibling => sibling.parent === node.parent && sessionBoardTool.test(sibling.label)))))
      if (!opened) return 'bot-home-unavailable'
      const home = await waitFor(homeVisible, opened)
      if (!home) return 'bot-home-unavailable'
      state = home
      afterItem = home
    }
    if (!itemScope(state, target)) {
      if (homeBack(state)) {
        const opened = await press(state, homeBack)
        if (!opened) return 'item-unavailable'
        const home = await waitFor(view => sameHome(view, target.bot) && !!homePanel(view, target.bot), opened)
        if (!home) return 'item-unavailable'
        state = home
      }
      for (let page = 0; page < 8 && !homeItem(state, target); page++) {
        const disclosure = listControl(state, target, collapsedGroup)
        const opened = await press(state, view => listControl(view, target, disclosure ?
          collapsedGroup : label => /^button Show [0-9]+ more$/.test(label)))
        if (!opened) return 'item-unavailable'
        const before = state.nodes.filter(node => /^button #[0-9]+ /.test(node.label)).length
        const next = await waitFor(view => sameHome(view, target.bot) && !!homePanel(view, target.bot) &&
          (!!homeItem(view, target) || view.nodes.filter(node => /^button #[0-9]+ /.test(node.label)).length !== before ||
            Boolean(disclosure && listControl(view, target, label => label === 'button (expanded)'))), opened)
        if (!next) return 'item-unavailable'
        state = next
      }
      afterItem = await press(state, view => homeItem(view, target))
      if (!afterItem) return 'item-unavailable'
    }
  }

  if (!('question' in target)) {
    stage?.('composer')
    const ready = (view: AxState) => {
      const scope = itemScope(view, target)
      return scope && sameHome(view, target.bot) && view.nodes.some(node =>
        under(node, scope) && node.label === 'heading Activity') ? scope : undefined
    }
    const [editable, unchanged] = await Promise.all([waitFor(view => {
      const scope = ready(view)
      return !!scope && !!commentComposer(view, scope)
    }, afterItem), stillCurrent()])
    if (!active() || !unchanged) return false
    const view = editable ?? await read()
    const scope = ready(view)
    if (!scope) return false
    const input = commentComposer(view, scope)
    if (!input) return editable ? false : 'read-only'
    const focusedView = view.focused === input.index ? view : await press(view, next => {
      const pane = ready(next)
      return pane && commentComposer(next, pane)
    })
    if (!focusedView) return 'composer-unavailable'
    const focused = await waitFor(current => {
      const pane = ready(current)
      const field = pane && commentComposer(current, pane)
      return !!field && current.focused === field.index
    }, focusedView)
    return !focused ? 'composer-unavailable' : active() && await stillCurrent()
  }
  stage?.('question')
  const [detail, unchanged] = await Promise.all([waitFor(view => {
    const scope = itemScope(view, target)
    return sameHome(view, target.bot) && !!scope && !!emptyComposer(view, scope, target.bot) && !!exactQuestion(view, scope, target)
  }, afterItem), stillCurrent()])
  if (!active() || !unchanged) return false
  if (!detail) return 'question-unavailable'
  const scope = itemScope(detail, target)!
  const input = emptyComposer(detail, scope, target.bot)!
  stage?.('composer')
  const opened = boundQuestion(detail, scope, target) && detail.focused === input.index ? detail :
    await press(detail, next => {
      const pane = itemScope(next, target)
      if (!pane) return
      const field = emptyComposer(next, pane, target.bot)
      const control = field && exactQuestion(next, pane, target)
      if (!control) return
      if (boundQuestion(next, pane, target)) return field
      if (control !== 'already-bound') return control
    })
  if (!opened) return 'composer-unavailable'
  const replied = await waitFor(view => {
    const current = itemScope(view, target)
    if (!current || !sameHome(view, target.bot) || !exactQuestion(view, current, target)) return false
    return emptyComposer(view, current, target.bot)?.index === view.focused && boundQuestion(view, current, target)
  }, opened)
  return !replied ? 'composer-unavailable' : active() && await stillCurrent()
}
