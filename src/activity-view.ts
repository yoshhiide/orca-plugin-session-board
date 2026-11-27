import { display, language, type Copy } from './language'
import type { Activity } from './model'

const locale = language(orca.locale)
const t = (en: string, ja: string) => locale === 'ja' ? ja : en
const day = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' })
const number = new Intl.NumberFormat(locale)
const make = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') => {
  const el = document.createElement(tag)
  el.textContent = text
  if (className) el.className = className
  return el
}

// Only create text and a small set of elements. Markdown never creates an image or raw HTML.
function inline(target: HTMLElement, text: string) {
  const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const index = match.index
    target.append(document.createTextNode(text.slice(last, index)))
    const token = match[0]
    if (token.startsWith('[')) {
      const parts = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(token)
      if (parts && (index === 0 || text[index - 1] !== '!')) {
        const link = make('a', parts[1]); link.href = parts[2]; link.target = '_blank'; link.rel = 'noopener noreferrer'; target.append(link)
      } else target.append(document.createTextNode(token))
    } else {
      const strong = token.startsWith('**') || token.startsWith('__')
      target.append(make(token.startsWith('`') ? 'code' : strong ? 'strong' : 'em', token.slice(strong ? 2 : 1, strong ? -2 : -1)))
    }
    last = index + token.length
  }
  target.append(document.createTextNode(text.slice(last)))
}
function markdown(text: string) {
  const root = make('div', '', 'message-body')
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  let i = 0
  while (i < lines.length) {
    if (!lines[i].trim()) { i++; continue }
    if (/^\s*```/.test(lines[i])) {
      i++
      const code: string[] = []
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++])
      if (i < lines.length) i++
      const pre = make('pre'); pre.append(make('code', code.join('\n'))); root.append(pre); continue
    }
    if (/^>\s?/.test(lines[i])) {
      const quote = make('blockquote')
      while (i < lines.length && /^>\s?/.test(lines[i])) { const p = make('p'); inline(p, lines[i++].replace(/^>\s?/, '')); quote.append(p) }
      root.append(quote); continue
    }
    const heading = /^(#{1,4})\s+(.+)$/.exec(lines[i])
    if (heading) { const el = make('strong', '', 'markdown-heading'); inline(el, heading[2]); root.append(el); i++; continue }
    const listMatch = /^\s*(?:([-*+])\s+|(\d+)\.\s+)(.*)$/.exec(lines[i])
    if (listMatch) {
      const ordered = !!listMatch[2], list = make(ordered ? 'ol' : 'ul')
      while (i < lines.length) {
        const item = /^\s*(?:([-*+])\s+|(\d+)\.\s+)(.*)$/.exec(lines[i])
        if (!item || !!item[2] !== ordered) break
        const li = make('li'); inline(li, item[3]); list.append(li); i++
      }
      root.append(list); continue
    }
    const paragraph: string[] = []
    while (i < lines.length && lines[i].trim() && !/^\s*```/.test(lines[i]) && !/^(#{1,4})\s+(.+)$/.test(lines[i]) && !/^>\s?/.test(lines[i]) && !/^\s*(?:[-*+]\s+|\d+\.\s+)/.test(lines[i])) paragraph.push(lines[i++])
    const p = make('p'); inline(p, paragraph.join('\n')); root.append(p)
  }
  return root
}
function validImage(src: string) {
  return src.length <= 8_000_000 && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(src)
}
function imageButton(image: { alt: string; src: string }) {
  const control = make('button', '', 'activity-image')
  control.type = 'button'; control.setAttribute('aria-label',
    image.alt ? t('Enlarge ' + image.alt, image.alt + 'を拡大') : t('Enlarge image', '画像を拡大'))
  const thumb = make('img'); thumb.src = image.src; thumb.alt = image.alt; thumb.loading = 'lazy'; control.append(thumb)
  control.addEventListener('click', () => {
    const viewer = make('dialog', '', 'image-viewer')
    viewer.setAttribute('aria-label', image.alt || t('Image preview', '画像プレビュー'))
    const close = make('button', t('Close', '閉じる'), 'image-close'); close.type = 'button'
    const full = make('img'); full.src = image.src; full.alt = image.alt
    close.addEventListener('click', () => viewer.close())
    viewer.addEventListener('cancel', event => { event.stopPropagation() })
    viewer.addEventListener('close', () => { viewer.remove(); if (control.isConnected) control.focus(); else { const fallback = document.querySelector<HTMLElement>('#activity-tab[aria-selected="true"]') ?? document.querySelector<HTMLElement>('#session-title'); if (fallback && fallback.getClientRects().length) fallback.focus() } })
    viewer.append(close, full); document.body.append(viewer); viewer.showModal(); close.focus()
  })
  if (!image.alt) return control
  const figure = make('figure')
  figure.append(control, make('figcaption', image.alt))
  return figure
}
export function renderActivity(container: HTMLElement, data: Activity, related: boolean, routeHint?: Copy) {
  const translated = (value: Copy) => display(value, locale)
  if (related) container.append(make('h3', t('Related Bot chat', '関連するBotチャット'), 'activity-heading'))
  container.append(make('p', t('Source: ', '出典：') + translated(data.source), 'small source'))
  if (data.issue) container.append(make('p', translated(data.issue), 'small'))
  if (data.navigationHint) container.append(make('p', translated(data.navigationHint), 'small image-route'))
  let previousDay = ''
  let previous: Activity['entries'][number] | undefined
  let unknownShown = false
  let imageRouteShown = Boolean(data.navigationHint)
  for (const entry of data.entries) {
    const date = entry.at && Number.isFinite(entry.at) ? new Date(entry.at) : undefined
    const valid = date && !Number.isNaN(date.getTime()) ? date : undefined
    const key = valid ? valid.toDateString() : ''
    if (valid && key !== previousDay) {
      container.append(make('h4', day.format(valid), 'activity-day'))
    } else if (!valid && !unknownShown) {
      container.append(make('p', t('Some activity has no timestamp.', '日時不明のActivityを含みます'), 'small activity-unknown')); unknownShown = true
    }
    const message = make('article', '', 'message')
    const speaker = entry.kind ? undefined : entry.speaker
    message.dataset.side = entry.kind ? 'event' : speaker?.side ?? 'neutral'
    if (speaker && previous?.speaker && key === previousDay &&
      speaker.id === previous.speaker.id && speaker.side === previous.speaker.side &&
      translated(entry.author) === translated(previous.author)) message.dataset.repeat = ''
    previousDay = key
    previous = speaker ? entry : undefined
    const head = make('header')
    const label = entry.kind === 'image-view' ?
      (entry.count && entry.count > 1 ? t(number.format(entry.count) + ' images viewed',
        '画像を表示（' + number.format(entry.count) + '件）') : t('Image viewed', '画像を表示')) : translated(entry.author)
    head.append(make('strong', label))
    if (valid) { const clock = make('time', time.format(valid), 'small'); clock.dateTime = valid.toISOString(); head.append(clock) }
    message.append(head)
    const surface = make('div', '', 'message-surface')
    if (entry.kind === 'image-view') {
      const imageRoute = entry.body || routeHint
      if (!imageRouteShown && imageRoute) {
        surface.append(make('p', translated(imageRoute), 'small image-route'))
        imageRouteShown = true
      }
    } else if (entry.body) surface.append(entry.kind === 'terminal-output' ?
      make('pre', entry.body, 'terminal-output') : markdown(entry.body))
    const images = (entry.images ?? []).filter(image => validImage(image.src))
    if (images.length) {
      const attachments = make('div', '', 'activity-images')
      attachments.append(...images.map(imageButton))
      surface.append(attachments)
    }
    if (surface.hasChildNodes()) message.append(surface)
    container.append(message)
  }
  if (!data.entries.length && !data.issue) container.append(make('p', t('No activity to show.', '表示できるActivityはありません。'), 'small source'))
}
