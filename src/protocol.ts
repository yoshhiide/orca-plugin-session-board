import type { Board, Detail } from './model'
import type { NativeReplyIssue } from './native-reply'
declare module 'orca' {
  interface PluginRequests {
    'board.start': { input: { locale: string } | undefined; output: Board }
    'board.refresh': { input: { locale: string } | undefined; output: Board }
    'board.detail': { input: { id: string; questionId?: string }; output: Detail }
    'board.reply': { input: { id: string; questionId?: string; index?: number }; output: { opened: boolean; reason?: 'read-only' | 'choose' | 'changed' | 'target-unavailable' | NativeReplyIssue } }
    'board.focus': { input: { id: string; questionId?: string }; output: boolean }
  }
  interface PluginPanelEvents {
    'board.changed': Board
  }
}
