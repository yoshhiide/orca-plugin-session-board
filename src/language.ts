import type { NativeReplyIssue } from './native-reply'

export type Language = 'en' | 'ja'
export type Copy = string | { en: string; ja: string }

export function language(locale: unknown): Language {
  if (typeof locale !== 'string') return 'en'
  try { return new Intl.Locale(locale).language === 'ja' ? 'ja' : 'en' }
  catch { return 'en' }
}

export function copy(en: string, ja: string): Copy {
  return {en, ja}
}

export function display(value: Copy, locale: Language): string {
  return typeof value === 'string' ? value : value[locale]
}

export function joinCopy(parts: Copy[], separator: string): Copy {
  return copy(parts.map(part => display(part, 'en')).join(separator),
    parts.map(part => display(part, 'ja')).join(separator))
}

export const replyMessages: Record<NativeReplyIssue | 'changed' | 'target-unavailable', Copy> = {
  changed: copy('The Item changed. Review the latest details.', '状態が変わりました。内容を確認してください。'),
  'target-unavailable': copy('Could not identify a single local Bot and Item. Open the matching Item in Orca.', 'ローカルのBotと項目を特定できませんでした。Orcaで対象項目を開いてください。'),
  'platform-unavailable': copy('Automatic reply navigation requires macOS. Open the Item manually.', '自動で返信欄を開くにはmacOSが必要です。この環境では項目を手動で開いてください。'),
  'accessibility-required': copy('To open the reply, allow Orca Computer Use in macOS Accessibility settings.', '返信画面を開くには、macOSのアクセシビリティ設定でOrca Computer Useを許可してください。'),
  'window-unavailable': copy('Keep one Orca window visible in the current Space, then try again.', '現在のSpaceにOrcaのウィンドウを1つだけ表示してから再試行してください。'),
  'bot-home-unavailable': copy('Could not verify that Bot Home opened. Open the target Bot’s Home Chat and try again.', 'Botのホームが開いたことを確認できませんでした。対象BotのHome Chatを開いてから再試行してください。'),
  'item-unavailable': copy('Could not locate the Item in Bot Home. Check the Item filter in Orca and try again.', 'Botのホームで項目を確認できませんでした。Orcaで項目の絞り込みを確認してから再試行してください。'),
  'question-unavailable': copy('Could not verify the selected question. Check the draft or current answer selection in Orca, then choose the question there.', '選んだ質問を確認できませんでした。標準画面で下書きや選択中の回答を確認し、質問を選んでください。'),
  'composer-unavailable': copy('Could not focus the input. Check the reply destination in Orca and select the input field.', '入力欄にフォーカスできませんでした。標準画面で返信先を確認し、入力欄を選んでください。')
}
