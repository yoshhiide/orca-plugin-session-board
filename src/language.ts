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
