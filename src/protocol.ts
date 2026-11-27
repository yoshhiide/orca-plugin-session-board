import type { Board, Detail } from './model'
declare module 'orca' {
  interface PluginRequests {
    'board.start': { input: undefined; output: Board }
    'board.refresh': { input: undefined; output: Board }
    'board.detail': { input: { id: string; questionId?: string }; output: Detail }
    'board.reply': { input: { id: string; questionId?: string; index?: number }; output: { opened: boolean; reason?: 'read-only' | 'choose' | 'changed' } }
    'board.focus': { input: { id: string; questionId?: string }; output: boolean }
  }
  interface PluginPanelEvents {
    'board.changed': Board
  }
}
