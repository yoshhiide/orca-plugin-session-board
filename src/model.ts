import { copy, type Copy } from './language'
export const states = {
  input: copy('Needs input', '入力待ち'), working: copy('In progress', '作業中'), external: copy('Waiting externally', '外部待ち'), blocked: copy('Blocked', 'ブロック中'),
  waiting: copy('Idle', '待機中'), planned: copy('Planned', '予定'), failed: copy('Failed', '失敗'), done: copy('Done', '完了'),
  cancelled: copy('Canceled', '中止'), unknown: copy('Unknown', '状態不明')
} as const
export type State = keyof typeof states
export type Source = 'Bot Item' | 'Bot ワーカー' | 'Orca チャット' | 'Orca ターミナル'
export const sourceNames: Record<Source, Copy> = {
  'Bot Item': 'Bot Item', 'Bot ワーカー': copy('Bot worker', 'Bot ワーカー'),
  'Orca チャット': copy('Orca chat', 'Orca チャット'), 'Orca ターミナル': copy('Orca terminal', 'Orca ターミナル')
}
export type Transition = { from: State; to: State; at: number; via: Copy }
export type Row = {
  id: string; source: Source; title: Copy; origin: Copy; state: State; at: number;
  reason?: string; ref: string; chat?: string; workers?: string[]; cursor?: string;
  pane?: string; target?: string; targetIncarnation?: string; workspace?: string;
  bot?: string; questionId?: string; stateAt?: number
}
export const activityWindow = 120 * 60 * 60 * 1000

export function withinActivityWindow(at: unknown, now: number): at is number {
  return typeof at === 'number' && Number.isSafeInteger(at) && at > 0 &&
    at >= now - activityWindow && at <= now
}

export type Batch = { key: string; label: Copy; ok: boolean; rows: Row[]; issue?: Copy }
export type Board = {
  rows: (Row & { stale: boolean })[]
  sources: {label: Copy; at?: number; issue?: Copy}[]
  hiddenRows?: number
  notificationIssue?: Copy
}
export type Activity = {
  source: Copy
  navigationHint?: Copy
  entries: {
    author: Copy; body: string; at?: number
    speaker?: { side: 'owner' | 'agent'; id: string }
    kind?: 'image-view' | 'system' | 'terminal-output'
    count?: number
    images?: { alt: string; src: string }[]
  }[]
  issue?: Copy
}
export type Question = {
  eventId: string
  prompt: string
  options: string[]
  targets?: number[]
  decisions?: { prompt: string; options: string[] }[]
}
export type Detail = {
  transitions: Transition[]
  issue?: Copy
  activity?: Activity
  relatedActivity?: Activity
  question?: Question
  questionStatus?: 'answered' | 'replaced' | 'unverified'
  state?: State
  reason?: string
  action?: 'bot-home' | 'terminal'
  navigationHint?: Copy
}

export function itemState(value: unknown): State {
  switch (value) {
    case 'needs_you': return 'input'
    case 'working': case 'in_progress': return 'working'
    case 'waiting': return 'external'
    case 'planned': return 'planned'
    case 'done': return 'done'
    case 'cancelled': case 'canceled': return 'cancelled'
    default: return 'unknown'
  }
}

export function sessionState(value: unknown, outcome?: unknown): State {
  switch (value) {
    case 'working': case 'running': return 'working'
    case 'waiting': case 'idle': return 'waiting'
    case 'blocked': return 'blocked'
    case 'failed': case 'failure': return 'failed'
    case 'stopped': case 'cancelled': case 'canceled': return 'cancelled'
    case 'done': case 'completed':
      if (outcome === 'failure') return 'failed'
      if (outcome === 'cancellation' || outcome === 'superseded') return 'cancelled'
      if (outcome === 'interruption' || outcome === 'unconfirmed') return 'unknown'
      return 'done'
    default: return 'unknown'
  }
}

export function isBot(row: Row): boolean {
  return row.source === 'Bot Item' || row.source === 'Bot ワーカー'
}

export function visibleRows(rows: Row[]): Row[] {
  const owned = new Set(rows.flatMap(row => row.workers ?? []))
  return rows.filter(row => row.source !== 'Bot ワーカー' || !owned.has(row.ref))
}

export function transition(row: Row, to: State, at: number, via: Copy): Transition {
  return { from: row.state, to, at, via }
}
