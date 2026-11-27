import { randomUUID } from 'node:crypto'
import { list, optional, type Cli } from './sources'
import type { State } from './model'

export type ReplyChoice = {label: string; detail?: string}
export type ReplyQuestion = {prompt: string; choices: ReplyChoice[]}
type ItemIdentity = {bot: string; number: number; title: string}
export type ReplyTarget = ItemIdentity & {at: number; question: ReplyQuestion}
export type ItemReplyTarget = ItemIdentity & {state: State; snoozed: boolean}
type NativeTarget = ReplyTarget | ItemReplyTarget

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
    typeof snapshot.treeText !== 'string' || !Array.isArray(snapshot.disabledElementIndexes)) {
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
  return !!one(nodes.filter(node => node.label === "button Open " + bot + "'s page" ||
    node.label === 'button ' + bot + 'のページを開く'))
}

function botHomeTab({nodes}: AxState, bot: string): AxNode | undefined {
  const marker = one(nodes.filter(node => node.label === 'button (expanded) Fold ' + bot &&
    nodes.some(sibling => sibling.parent === node.parent && sibling.label === 'text ' + bot)))
  if (!marker?.parent?.parent) return
  // The sidebar places the Home Chat immediately after its owning Bot header.
  // The header is selected by name, and the active Bot identity is read back after opening.
  const siblings = nodes.filter(node => node.parent === marker.parent!.parent)
  const tab = siblings[siblings.indexOf(marker.parent) + 1]
  if (tab && /^button (?:\(expanded\) )?Home Chat(?: · .+)?$/.test(tab.label)) return tab
}

function homeBack({nodes}: AxState): AxNode | undefined {
  return one(nodes.filter(node => {
    if (node.label !== 'button ホーム' && node.label !== 'button Home') return false
    const panel = node.parent
    if (!panel?.parent || !/^(?:container|container ホーム|container Home)$/.test(panel.label)) return false
    return nodes.some(sibling => sibling.parent === panel.parent && homeToolbar.test(sibling.label)) &&
      nodes.some(sibling => sibling.parent === panel.parent && sibling.label === 'button セッションボード') &&
      nodes.some(heading => under(heading, panel) && /^heading #[0-9]+ /.test(heading.label))
  }))
}

function itemScope(state: AxState, target: NativeTarget): AxNode | undefined {
  const heading = one(state.nodes.filter(node => node.label === 'heading #' + target.number + ' ' + target.title))
  const scope = heading?.parent?.parent?.parent
  const statuses = statusNames['question' in target ? 'input' : target.state]
  if (!scope || scope.parent !== homeBack(state)?.parent ||
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

function listControl(state: AxState, target: NativeTarget, label: RegExp): AxNode | undefined {
  const panel = homePanel(state, target.bot)
  if (!panel) return
  for (const group of itemGroups(target)) {
    const heading = one(state.nodes.filter(node => node.label === 'heading ' + group && under(node, panel)))
    if (!heading?.parent?.parent) continue
    const control = one(state.nodes.filter(node => (node.parent === heading.parent ||
      node.parent === heading.parent!.parent) && label.test(node.label)))
    if (control) return control
  }
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

function emptyComposer(state: AxState, scope: AxNode): AxNode | undefined {
  const nodes = state.nodes.filter(node => under(node, scope))
  const input = one(nodes.filter(node =>
    node.label === 'text entry area (settable) コメント ' + placeholder ||
    node.label === 'text entry area (settable) Comment ' + placeholder))
  if (!input || !nodes.some(node => node.parent === input && node.label === 'text ' + placeholder)) return
  if (!nodes.some(node => /^(?:button \(disabled\) (?:コメント|Comment))$/.test(node.label))) return
  return input
}

function commentComposer(state: AxState, scope: AxNode): AxNode | undefined {
  return one(state.nodes.filter(node => under(node, scope) &&
    /^text entry area \(settable\) (?:コメント|Comment)(?: |$)/.test(node.label) &&
    !state.disabled.has(node.index)))
}

export async function nativeReply(
  run: Cli, target: NativeTarget, stillCurrent: () => Promise<boolean>, signal: AbortSignal
): Promise<boolean | 'read-only'> {
  const deadline = Date.now() + 22_000
  const active = () => !signal.aborted && Date.now() < deadline
  const permission = await run('computer', 'permissions')
  if (permission.platform !== 'darwin' ||
    !list(permission.permissions).some(entry => entry.id === 'accessibility' && entry.status === 'granted')) return false
  const windows = list((await run('computer', 'list-windows', '--app', app)).windows)
  const window = one(windows.filter(frame => optional(frame.app).bundleId === app))
  if (!window || typeof window.id !== 'number' || window.isOffscreen !== false || window.isMinimized !== false) return false
  const windowId = window.id
  const args = ['--app', app, '--window-id', String(windowId), '--session', 'board-reply-' + randomUUID(), '--no-screenshot']
  const read = async () => parse(await run('computer', 'get-app-state', ...args), windowId)
  async function waitFor(predicate: (state: AxState) => boolean) {
    for (let attempt = 0; attempt < 5 && active(); attempt++) {
      const state = await read()
      if (predicate(state)) return state
      await new Promise(resolve => setTimeout(resolve, 160))
    }
  }
  async function press(state: AxState, node?: AxNode) {
    if (!node || !active() || state.disabled.has(node.index)) return false
    // AXPress is explicitly requested so the provider cannot fall back to a pointer or foreground action.
    const action = optional((await run('computer', 'perform-secondary-action', ...args,
      '--element-index', node.index, '--action', 'AXPress')).action)
    return action.path === 'accessibility' && action.delivery === 'background' && action.targetWindowId === windowId
  }
  if (!active() || !await stillCurrent()) return false
  let state = await read()
  if (!sameHome(state, target.bot)) {
    if (!await press(state, botHomeTab(state, target.bot))) return false
    const home = await waitFor(view => sameHome(view, target.bot))
    if (!home) return false
    state = home
  }

  if (!itemScope(state, target)) {
    const homeVisible = (view: AxState) => sameHome(view, target.bot) &&
      !!(itemScope(view, target) || homePanel(view, target.bot) || homeBack(view))
    if (!homeVisible(state)) {
      const tool = one(state.nodes.filter(node => homeToolbar.test(node.label) &&
        state.nodes.some(sibling => sibling.parent === node.parent && sibling.label === 'button セッションボード')))
      if (!await press(state, tool)) return false
      const home = await waitFor(homeVisible)
      if (!home) return false
      state = home
    }
    if (!itemScope(state, target)) {
      const previous = homeBack(state)
      if (previous) {
        if (!await press(state, previous)) return false
        const home = await waitFor(view => sameHome(view, target.bot) && !!homePanel(view, target.bot))
        if (!home) return false
        state = home
      }
      for (let page = 0; page < 8 && !homeItem(state, target); page++) {
        const disclosure = listControl(state, target, /^button \(collapsed\)$/)
        const more = disclosure ?? listControl(state, target, /^button Show [0-9]+ more$/)
        if (!sameHome(state, target.bot) || !await press(state, more)) return false
        const before = state.nodes.filter(node => /^button #[0-9]+ /.test(node.label)).length
        const next = await waitFor(view => sameHome(view, target.bot) && !!homePanel(view, target.bot) &&
          (!!homeItem(view, target) || view.nodes.filter(node => /^button #[0-9]+ /.test(node.label)).length !== before ||
            Boolean(disclosure && listControl(view, target, /^button \(expanded\)$/))))
        if (!next) return false
        state = next
      }
      if (!sameHome(state, target.bot) || !await press(state, homeItem(state, target))) return false
    }
  }

  if (!active() || !await stillCurrent()) return false
  if (!('question' in target)) {
    const ready = (view: AxState) => {
      const scope = itemScope(view, target)
      return scope && sameHome(view, target.bot) && view.nodes.some(node =>
        under(node, scope) && node.label === 'heading Activity') ? scope : undefined
    }
    const editable = await waitFor(view => {
      const scope = ready(view)
      return !!scope && !!commentComposer(view, scope)
    })
    if (!active() || !await stillCurrent()) return false
    const view = await read()
    const scope = ready(view)
    if (!scope) return false
    const input = commentComposer(view, scope)
    if (!input) return editable ? false : 'read-only'
    if (view.focused !== input.index && !await press(view, input)) return false
    const focused = await waitFor(current => {
      const pane = ready(current)
      const field = pane && commentComposer(current, pane)
      return !!field && (current.focused === field.index || current.focused === 'null')
    })
    return !!focused && active() && await stillCurrent()
  }
  const detail = await waitFor(view => {
    const scope = itemScope(view, target)
    return sameHome(view, target.bot) && !!scope && !!emptyComposer(view, scope) && !!exactQuestion(view, scope, target)
  })
  if (!detail) return false
  const control = exactQuestion(detail, itemScope(detail, target)!, target)
  if (control === 'already-bound') return active() && await stillCurrent()
  if (!await press(detail, control)) return false
  const replied = await waitFor(view => {
    const current = itemScope(view, target)
    if (!current || !sameHome(view, target.bot) || !exactQuestion(view, current, target)) return false
    const input = emptyComposer(view, current)
    const reply = 'button Replying to: ' + target.question.prompt + '. Show question'
    return input?.index === view.focused &&
      view.nodes.filter(node => under(node, current) && node.label === reply).length === 1
  })
  return !!replied && active() && await stillCurrent()
}
