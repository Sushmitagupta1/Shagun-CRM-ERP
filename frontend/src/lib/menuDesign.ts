import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export interface MenuDesignPage {
  html: string
  index: number
}

export interface MenuDesign {
  id: string
  name: string
  pages: MenuDesignPage[]
  raw: string
  paletteIndex?: number
}

export interface ParsedDesigns {
  designs: MenuDesign[]
  error?: string
}

export interface MenuEditableItem {
  key: string
  text: string
  description?: string
}

export interface MenuEditableHeading {
  key: string
  text: string
}

export interface MenuEditablePage {
  pageIndex: number
  headings: MenuEditableHeading[]
  items: MenuEditableItem[]
}

export interface MenuFonts {
  title: string
  heading: string
  item: string
  description?: string
}

export interface MenuColors {
  title: string
  heading: string
  item: string
  description?: string
}

export const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Playfair Display', value: "'Playfair Display', Georgia, serif" },
  { label: 'Great Vibes', value: "'Great Vibes', 'Brush Script MT', cursive" },
  { label: 'Dancing Script', value: "'Dancing Script', 'Brush Script MT', cursive" },
  { label: 'Cinzel', value: "'Cinzel', Georgia, serif" },
  { label: 'Cormorant Garamond', value: "'Cormorant Garamond', Georgia, serif" },
  { label: 'Marcellus', value: "'Marcellus', Georgia, serif" },
  { label: 'Prata', value: "'Prata', Georgia, serif" },
  { label: 'EB Garamond', value: "'EB Garamond', Georgia, serif" },
  { label: 'Lato', value: "'Lato', 'Segoe UI', Arial, sans-serif" },
  { label: 'Montserrat', value: "'Montserrat', 'Segoe UI', Arial, sans-serif" },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Segoe UI', value: "'Segoe UI', Arial, sans-serif" },
]

export interface MenuPalette {
  id: string
  name: string
  heading: string
  item: string
  desc: string
  headingFont: string
  itemFont: string
  descFont: string
}

// Three distinct text palettes for the 3 design options. All use the SAME
// selected template background; only heading/dish/description colours + fonts
// differ per option (blue / purple / black & gold).
export const MENU_PALETTES: MenuPalette[] = [
  {
    id: 'blue',
    name: 'Royal Blue',
    heading: '#1E3A8A',
    item: '#3B5BDB',
    desc: '#4B5563',
    headingFont: "'Playfair Display', Georgia, serif",
    itemFont: "'Montserrat', 'Segoe UI', Arial, sans-serif",
    descFont: "'Lato', 'Segoe UI', Arial, sans-serif",
  },
  {
    id: 'purple',
    name: 'Royal Purple',
    heading: '#4A148C',
    item: '#6A1B9A',
    desc: '#374151',
    headingFont: "'Playfair Display', Georgia, serif",
    itemFont: "'Montserrat', 'Segoe UI', Arial, sans-serif",
    descFont: "'Lato', 'Segoe UI', Arial, sans-serif",
  },
  {
    id: 'black-gold',
    name: 'Black & Gold',
    heading: '#1A1A1A',
    item: '#8C6A1F',
    desc: '#4B5563',
    headingFont: "'Playfair Display', Georgia, serif",
    itemFont: "'Montserrat', 'Segoe UI', Arial, sans-serif",
    descFont: "'Lato', 'Segoe UI', Arial, sans-serif",
  },
]

const DEFAULT_FONTS: MenuFonts = {
  title: "'Playfair Display', Georgia, serif",
  heading: "'Playfair Display', Georgia, serif",
  item: "'Lato', 'Segoe UI', Arial, sans-serif",
  description: "'Lato', 'Segoe UI', Arial, sans-serif",
}

function normalizeFont(value: string): string {
  return (value || '').replace(/"/g, "'").replace(/\s+/g, ' ').trim()
}

// FONT_OPTIONS values are used verbatim as CSS (no extra quoting), so match
// detected values against the option list after normalising quotes/spaces.
export function matchFontOption(value: string | null | undefined): string {
  const norm = normalizeFont(value || '')
  if (!norm) return DEFAULT_FONTS.title
  const hit = FONT_OPTIONS.find((f) => normalizeFont(f.value) === norm)
  return hit ? hit.value : norm
}

export function extractMenuTitle(design: MenuDesign): string {
  if (design.pages.length === 0) return ''
  const doc = new DOMParser().parseFromString(design.pages[0].html, 'text/html')
  const h1 = doc.body.querySelector('h1')
  return h1 ? stripHtml(h1.innerHTML) : ''
}

function fontInRule(style: string, selector: string): string | null {
  const re = new RegExp(selector + '\\s*\\{[^}]*font-family\\s*:\\s*([^;}]+)', 'gi')
  let m: RegExpExecArray | null
  let last: string | null = null
  while ((m = re.exec(style)) !== null) last = cleanValue(m[1])
  return last
}

function colorInRule(style: string, selector: string): string | null {
  // (?<!-) avoids matching the "color" inside background-color / border-color.
  const re = new RegExp(selector + '\\s*\\{[^}]*?(?<!-)color\\s*:\\s*([^;}]+)', 'gi')
  let m: RegExpExecArray | null
  let last: string | null = null
  while ((m = re.exec(style)) !== null) last = cleanValue(m[1])
  return last
}

// The palette/typography rules we append use "value !important", but detection
// feeds the value into the edit form and later re-injects it as
// "value !important", which would double up to invalid "!important !important"
// CSS. Strip the declaration modifier from the captured value.
function cleanValue(raw: string): string {
  return raw.trim().replace(/\s*!important\s*$/i, '')
}

// Best-effort detection of the current text colours for title/heading/items
// from the page's <style> (hex, rgb, or named colours are returned as-is).
export function detectPageColors(html: string): MenuColors {
  const sm = html.match(/<style>([\s\S]*?)<\/style>/i)
  const style = sm ? sm[1] : ''
  const pick = (sel: string, alt: string): string => colorInRule(style, sel) || colorInRule(style, alt) || ''
  return {
    title: pick('h1', '\\.\\w[\\w-]*title[\\w-]*'),
    heading: pick('h2', '\\.\\w[\\w-]*heading[\\w-]*') || colorInRule(style, '\\.\\w[\\w-]*section[\\w-]*') || '',
    item: pick('ul\\s+li', '\\.\\w[\\w-]*item[\\w-]*') || colorInRule(style, 'li') || '',
    description: colorInRule(style, '\\.dish-desc') || colorInRule(style, '\\.\\w[\\w-]*desc[\\w-]*') || '',
  }
}

// Best-effort detection of the current title/heading/item fonts from the
// page's <style>. Falls back to sensible defaults when nothing is found.
export function detectPageFonts(html: string): MenuFonts {
  const sm = html.match(/<style>([\s\S]*?)<\/style>/i)
  const style = sm ? sm[1] : ''
  const title = fontInRule(style, 'h1') || fontInRule(style, '\\.\\w[\\w-]*title[\\w-]*') || DEFAULT_FONTS.title
  const heading = fontInRule(style, 'h2') || fontInRule(style, '\\.\\w[\\w-]*heading[\\w-]*') || fontInRule(style, '\\.\\w[\\w-]*section[\\w-]*') || DEFAULT_FONTS.heading
  const item = fontInRule(style, 'ul\\s+li') || fontInRule(style, '\\.\\w[\\w-]*item[\\w-]*') || fontInRule(style, 'li') || DEFAULT_FONTS.item
  const description = fontInRule(style, '\\.dish-desc') || fontInRule(style, '\\.\\w[\\w-]*desc[\\w-]*') || DEFAULT_FONTS.description
  return { title: matchFontOption(title), heading: matchFontOption(heading), item: matchFontOption(item), description: matchFontOption(description) }
}

const FONT_OVERRIDE_MARK = '/* user-font-overrides */'

// The selectable fonts are Google Fonts families, but the AI designs never load
// them, so the browser silently falls back (e.g. 'Playfair Display' -> Georgia)
// and the user's font choice appears to have no effect. Injecting this @import
// (once, inside the page's <style>) makes every option actually render.
const GOOGLE_FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display&family=Great+Vibes&family=Dancing+Script&family=Cinzel&family=Cormorant+Garamond&family=Marcellus&family=Prata&family=EB+Garamond&family=Lato&family=Montserrat&display=swap');`

// Injects !important font-family/colour overrides at the end of the page's
// <style> so the user's font and colour choices win over the AI-generated rules.
export function applyTextOverrides(html: string, fonts?: MenuFonts, colors?: MenuColors): string {
  const sm = html.match(/<style>([\s\S]*?)<\/style>/i)
  if (!sm) return html
  let base = sm[1].replace(/\n\s*\/\* user-font-overrides \*\/[\s\S]*$/, '').replace(/\s+$/, '')
  if (!base.includes('googleapis.com')) base = `${GOOGLE_FONT_IMPORT}\n${base}`
  const rules: string[] = []
  if (fonts) {
    rules.push(`h1, [class*="title"] { font-family: ${fonts.title} !important; }`)
    rules.push(`h2, [class*="heading"], [class*="section"] { font-family: ${fonts.heading} !important; }`)
    rules.push(`ul li, ul li .dish-name, [class*="item"] { font-family: ${fonts.item} !important; }`)
    if (fonts.description) rules.push(`.dish-desc, [class*="desc"] { font-family: ${fonts.description} !important; }`)
  }
  if (colors) {
    rules.push(`h1, [class*="title"] { color: ${colors.title} !important; }`)
    rules.push(`h2, [class*="heading"], [class*="section"] { color: ${colors.heading} !important; }`)
    rules.push(`ul li, ul li .dish-name, [class*="item"] { color: ${colors.item} !important; }`)
    if (colors.description) rules.push(`.dish-desc, [class*="desc"] { color: ${colors.description} !important; }`)
  }
  const overrides = `\n${FONT_OVERRIDE_MARK}\n${rules.join('\n')}\n`
  return html.replace(sm[0], `<style>${base}${overrides}</style>`)
}

const MENU_TYPOGRAPHY_MARK = '/* menu-typography */'

// Appends deterministic palette rules to the page's <style> so the 3-level
// hierarchy (ALL-CAPS heading / medium dish name / small description, each a
// different colour + font) always renders, even if Gemini drifts. Re-running
// replaces any previous block (idempotent), so Regenerate/Edit can re-apply.
export function withMenuTypography(html: string, palette: MenuPalette): string {
  const sm = html.match(/<style>([\s\S]*?)<\/style>/i)
  if (!sm) return html
  const base = sm[1].replace(/\n\s*\/\* menu-typography \*\/[\s\S]*$/, '').replace(/\s+$/, '')
  const rules = [
    `h1, h2, [class*="heading"], [class*="section"] { text-transform: uppercase !important; color: ${palette.heading} !important; font-family: ${palette.headingFont} !important; }`,
    `.dish-name { color: ${palette.item} !important; font-family: ${palette.itemFont} !important; }`,
    `.dish-desc { color: ${palette.desc} !important; font-family: ${palette.descFont} !important; font-size: 10.5px !important; }`,
  ]
  const block = `\n${MENU_TYPOGRAPHY_MARK}\n${rules.join('\n')}\n`
  return html.replace(sm[0], `<style>${base}${block}</style>`)
}

// Prefixes every selector in the page's <style> with the given scope attribute
// so several design previews rendered side by side cannot style each other's
// content (their global <style> tags would otherwise collide).
export function scopeMenuHtml(html: string, scope: string): string {
  const sm = html.match(/<style>([\s\S]*?)<\/style>/i)
  if (!sm) return html
  return html.replace(sm[0], `<style>${scopeCss(sm[1], scope)}</style>`)
}

function scopeCss(css: string, scope: string): string {
  const attr = `[data-menu-scope="${scope}"]`

  const scopeSelectors = (selectors: string): string =>
    selectors
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((sel) => (sel === ':root' || sel === ':host' ? sel : `${attr} ${sel}`))
      .join(', ')

  const takeBlock = (input: string, open: number): { inner: string; end: number } => {
    let depth = 1
    let i = open + 1
    while (i < input.length && depth > 0) {
      if (input[i] === '{') depth++
      else if (input[i] === '}') depth--
      i++
    }
    return { inner: input.slice(open + 1, i - 1), end: i }
  }

  // Standalone @import/@charset/@namespace statements have no selectors and
  // must be preserved exactly (and only valid at the top of the stylesheet).
  const preamble: string[] = []
  const stripped = css.replace(/^\s*@(import|charset|namespace)\b[^;{}]*;/gm, (m) => {
    preamble.push(m)
    return ''
  })

  let out = ''
  let i = 0
  while (i < stripped.length) {
    const brace = stripped.indexOf('{', i)
    if (brace === -1) {
      out += stripped.slice(i)
      break
    }
    const head = stripped.slice(i, brace)
    if (/^\s*@/.test(head)) {
      const atName = (head.trim().match(/^(@[\w-]+)/) || [])[1] || ''
      const { inner, end } = takeBlock(stripped, brace)
      if (atName === '@font-face' || atName === '@keyframes' || atName === '@-webkit-keyframes') {
        out += head + '{' + inner + '}'
      } else {
        out += head + '{' + scopeCss(inner, scope) + '}'
      }
      i = end
    } else {
      const { inner, end } = takeBlock(stripped, brace)
      out += scopeSelectors(head) + '{' + inner + '}'
      i = end
    }
  }
  return (preamble.length > 0 ? preamble.join('\n') + '\n' : '') + out
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

// Splits a dish line "Name - description" / "Name: description" / "Name–description"
// into name + description. Lines without a separator are name-only. A plain
// hyphen only splits when it has whitespace on at least one side, so hyphenated
// dish names like "Chicken-65" survive intact.
export function splitMenuLine(text: string): { name: string; description: string } {
  const m = text.match(/^(.+?)\s*[–—:]\s*(.+)$/) || text.match(/^(.+?)\s+-\s+(.+)$/)
  return m
    ? { name: m[1].trim(), description: m[2].trim() }
    : { name: text, description: '' }
}

function countLis(ul: Element): number {
  return Array.from(ul.children).filter((el) => el.tagName === 'LI').length
}

// The main dish list is the <ul> with the most <li> children (pages may
// contain small decorative lists too).
function mainUl(doc: Document): HTMLUListElement | null {
  const uls = Array.from(doc.body.querySelectorAll('ul'))
  if (uls.length === 0) return null
  return uls.sort((a, b) => countLis(b) - countLis(a))[0] as HTMLUListElement
}

// Item text excludes leading decorative empty elements (e.g. veg-dot spans)
// so only the actual dish name is edited.
function liDisplayText(li: HTMLElement): string {
  const parts: string[] = []
  for (const node of Array.from(li.childNodes)) {
    const txt = node.textContent || ''
    if (node.nodeType === Node.ELEMENT_NODE && txt.trim() === '') continue
    if (txt.trim()) parts.push(txt.trim())
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

// Replaces only the dish text inside an <li>, keeping leading decorative
// elements (veg dots, markers) so the rendered look stays intact.
function editLiText(li: HTMLElement, item: MenuEditableItem) {
  let prefixHtml = ''
  for (const node of Array.from(li.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      if ((node.textContent || '').trim() === '') continue
      break
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      if ((el.textContent || '').trim() !== '') break
      prefixHtml += el.outerHTML
    }
  }
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const desc = item.description?.trim()
  const inner = desc
    ? `<strong class="dish-name">${esc(item.text)}</strong><span class="dish-desc">${esc(desc)}</span>`
    : `<strong class="dish-name">${esc(item.text)}</strong>`
  li.innerHTML = prefixHtml + inner
}

// All heading lines (h1/h2/h3) of a page in document order, as plain text.
function pageHeadings(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return Array.from(doc.body.querySelectorAll('h1, h2, h3')).map((el) => stripHtml((el as HTMLElement).innerHTML))
}

function liNameDesc(li: HTMLElement): { name: string; description: string } {
  const strong = li.querySelector('.dish-name')
  const span = li.querySelector('.dish-desc')
  if (strong) {
    return {
      name: strong.textContent?.trim() ?? '',
      description: span?.textContent?.trim() ?? '',
    }
  }
  return splitMenuLine(liDisplayText(li))
}

// Pulls out the headings and item texts of each page so they can be edited in
// a form without touching the design's styling.
export function extractMenuEditable(design: MenuDesign): MenuEditablePage[] {
  return design.pages.map((page, pi) => {
    const doc = new DOMParser().parseFromString(page.html, 'text/html')
    const headingEls = Array.from(doc.body.querySelectorAll('h1, h2, h3')) as HTMLElement[]
    const ul = mainUl(doc)
    const lis = ul ? Array.from(ul.children).filter((el) => el.tagName === 'LI') as HTMLElement[] : []
    return {
      pageIndex: pi,
      headings: headingEls.map((el, hi) => ({ key: `p${pi}_h${hi}`, text: stripHtml(el.innerHTML) })),
      items: lis.map((li, i) => {
        const { name, description } = liNameDesc(li)
        return { key: `p${pi}_i${i}`, text: name, description }
      }),
    }
  })
}

function pageStyle(html: string): string {
  const m = html.match(/<style>[\s\S]*?<\/style>/i)
  return m ? m[0] : ''
}

// Rebuilds each page's HTML with the edited headings, item texts, fonts and
// text colours, keeping the original <style>, wrapper div, and <li> styles intact.
// Headings that have the same text on every page are treated as shared
// (e.g. the brand/title line) — editing one propagates to all pages.
export function applyMenuEdits(design: MenuDesign, pages: MenuEditablePage[], opts?: { fonts?: MenuFonts; colors?: MenuColors }): MenuDesign {
  const editsByPage = new Map(pages.map((p) => [p.pageIndex, p]))
  const originalHeadings = design.pages.map((page) => pageHeadings(page.html))

  const updatedPages = design.pages.map((page, pi) => {
    const edits = editsByPage.get(pi)
    let html = page.html

    const style = pageStyle(html)
    const doc = new DOMParser().parseFromString(html, 'text/html')
    doc.head.querySelectorAll('style').forEach((s) => s.remove())
    doc.body.querySelectorAll('style').forEach((s) => s.remove())

    if (edits) {
      const headingEls = Array.from(doc.body.querySelectorAll('h1, h2, h3')) as HTMLElement[]
      headingEls.forEach((el, hi) => {
        const originalText = originalHeadings[pi]?.[hi] || ''
        const sharedAcross = originalHeadings.every((pageHs) => pageHs[hi] === originalText)
        let newText: string | undefined
        if (sharedAcross) {
          // Any page's edit of this shared line wins, so it stays consistent.
          for (const other of originalHeadings) {
            const otherEdits = editsByPage.get(originalHeadings.indexOf(other))
            const t = otherEdits?.headings[hi]?.text?.trim()
            if (t && t !== originalText) {
              newText = t
              break
            }
          }
        } else {
          const t = edits.headings[hi]?.text?.trim()
          if (t) newText = t
        }
        if (newText) el.textContent = newText
      })

      const items = edits.items.filter((it) => it.text.trim() !== '')
      const ul = mainUl(doc)
      if (ul) {
        const lis = Array.from(ul.children).filter((el) => el.tagName === 'LI') as HTMLElement[]
        lis.forEach((li, i) => {
          if (i < items.length) editLiText(li, items[i])
          else li.remove()
        })
        if (items.length > lis.length) {
          const template = lis[lis.length - 1] || doc.createElement('li')
          for (let i = lis.length; i < items.length; i++) {
            const clone = template.cloneNode(true) as HTMLElement
            editLiText(clone, items[i])
            ul.appendChild(clone)
          }
        }
      } else if (items.length > 0) {
        const newUl = doc.createElement('ul')
        items.forEach((it) => {
          const li = doc.createElement('li')
          editLiText(li, it)
          newUl.appendChild(li)
        })
        doc.body.appendChild(newUl)
      }
    }

    const bodyHtml = doc.body.innerHTML.trim()
    html = style ? `${style}\n${bodyHtml}` : bodyHtml

    if (opts?.fonts || opts?.colors) html = applyTextOverrides(html, opts.fonts, opts.colors)
    return { ...page, html }
  })
  return { ...design, pages: updatedPages }
}

const ALLOWED_TAGS = new Set([
  'DIV', 'SPAN', 'H1', 'H2', 'H3', 'P', 'UL', 'OL', 'LI', 'STRONG', 'B', 'EM', 'I',
  'BR', 'HR', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'STYLE', 'SMALL', 'BLOCKQUOTE',
])

const ALLOWED_ATTRS = new Set(['class', 'id', 'style'])

export function sanitizeMenuHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const all = Array.from(doc.body.querySelectorAll('*'))
  const toRemove: Element[] = []
  for (const elem of all) {
    if (!ALLOWED_TAGS.has(elem.tagName)) {
      toRemove.push(elem)
      continue
    }
    for (const attr of Array.from(elem.attributes)) {
      const name = attr.name.toLowerCase()
      if (name.startsWith('on')) {
        elem.removeAttribute(attr.name)
        continue
      }
      if (name === 'href' || name === 'src' || name === 'xlink:href' || name === 'background') {
        const val = (attr.value || '').trim().toLowerCase()
        if (val.startsWith('javascript:') || val.startsWith('data:text/html') || val.startsWith('data:image/svg')) {
          elem.removeAttribute(attr.name)
          continue
        }
        if ((name === 'src' || name === 'href') && (val.startsWith('http://') || val.startsWith('https://'))) {
          elem.removeAttribute(attr.name)
        }
        continue
      }
      if (!ALLOWED_ATTRS.has(name)) {
        elem.removeAttribute(attr.name)
      }
    }
  }
  toRemove.forEach((el) => el.remove())
  return doc.body.innerHTML
}

export function parseMenuDesigns(raw: string, paletteIndex = 0): ParsedDesigns {
  const cleaned = sanitizeMenuHtml(raw)
  const designBlocks = cleaned.split('---DESIGN---').map((b) => b.trim()).filter(Boolean)
  if (designBlocks.length === 0) {
    return { designs: [], error: 'AI returned no designs. Try again.' }
  }
  const designs: MenuDesign[] = designBlocks.map((block, i) => {
    const nameMatch = block.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    const name = nameMatch
      ? nameMatch[1].replace(/<[^>]+>/g, '').trim() || `Design Option ${i + 1}`
      : `Design Option ${i + 1}`
    const paletteIdx = (i + paletteIndex) % MENU_PALETTES.length
    const pageHtml = splitPages(block)
    return {
      id: `design_${i}`,
      name,
      pages: pageHtml.map((html, p) => ({
        html: withMenuTypography(html, MENU_PALETTES[paletteIdx]),
        index: p,
      })),
      raw: block,
      paletteIndex: paletteIdx,
    }
  })
  return { designs }
}

function splitPages(block: string): string[] {
  const styleMatch = block.match(/<style>[\s\S]*?<\/style>/i)
  const designStyle = styleMatch ? styleMatch[0] : null
  const bgMatch = block.match(/url\(['"]([^'"]+)['"]\)/i)
  const designBg = bgMatch ? bgMatch[1] : ''
  const body = block.replace(/^###[^\n]*/, '').trim()
  const parts = body.split('---PAGE---').map((p) => p.trim()).filter(Boolean)
  const pages = parts.length > 0 ? parts : [body]
  return pages.map((page) => normalizePage(page, designStyle, designBg))
}

function normalizePage(page: string, designStyle: string | null, designBg: string): string {
  let html = page.replace(/^###[^\n]*/, '').trim()
  const styleMatch = html.match(/<style>[\s\S]*?<\/style>/i)
  const style = styleMatch ? styleMatch[0] : designStyle
  if (styleMatch) html = html.replace(/<style>[\s\S]*?<\/style>/i, '').trim()
  const bgMatch = html.match(/url\(['"]([^'"]+)['"]\)/i)
  const bg = bgMatch ? bgMatch[1] : designBg

  if (/^<div\b/i.test(html)) {
    return style ? `${style}\n${html}` : html
  }

  html = html.replace(/<\/div>\s*$/i, '').trim()
  const bgStyle = bg
    ? `style="background-image:url('${bg}');background-size:100% 100%;background-position:center;background-repeat:no-repeat;min-height:100vh"`
    : `style="background:#fff;min-height:100vh"`
  const baseStyle = style ?? `<style>body{margin:0}ul{list-style:none;padding:0;font-family:Georgia,serif}li{padding:6px 0}</style>`
  return `${baseStyle}\n<div ${bgStyle} class="menu-card">\n  ${html}\n</div>`
}

export async function downloadMenuDesignPdf(design: MenuDesign, fileName: string): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  // A4 at 96dpi = 794 x 1123 px. Every page is rendered onto exactly one sheet.
  const PAGE_W = 794
  const PAGE_H = 1123
  for (let i = 0; i < design.pages.length; i++) {
    const container = document.createElement('div')
    container.style.position = 'absolute'
    container.style.left = '-9999px'
    container.style.top = '0'
    container.style.width = `${PAGE_W}px`
    container.style.height = `${PAGE_H}px`
    container.style.overflow = 'hidden'
    container.style.zIndex = '-1'
    container.setAttribute('data-menu-scope', 'pdf-scope')
    const inner = document.createElement('div')
    inner.style.width = `${PAGE_W}px`
    inner.style.transformOrigin = 'top left'
    // Full-A4 fix: min-height:100vh resolves to the BROWSER window height (not
    // the sheet), which pushed the content to the wrong place and left the
    // picture not covering the page. Pin the page to the sheet height and
    // cover-fill the template so the picture spans the whole A4 edge-to-edge
    // with no stretch. min-height (not height) lets a page taller than one
    // sheet grow so it can be measured and scaled to fit instead of clipped.
    const fixed = scopeMenuHtml(design.pages[i].html, 'pdf-scope')
      .replace(/min-height\s*:\s*100vh/gi, `min-height:${PAGE_H}px`)
      .replace(/background-size\s*:\s*100%\s*100%/gi, 'background-size:cover;background-position:center')
    inner.innerHTML = fixed
    container.appendChild(inner)
    document.body.appendChild(container)
    try {
      await document.fonts.ready
      await new Promise((resolve) => setTimeout(resolve, 300))

      const naturalH = inner.offsetHeight
      if (naturalH > PAGE_H) {
        inner.style.transform = `scale(${(PAGE_H / naturalH).toFixed(4)})`
      }

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: PAGE_W,
        height: PAGE_H,
        windowWidth: PAGE_W,
      })

      const imgData = canvas.toDataURL('image/jpeg', 0.92)
      if (i > 0) doc.addPage()
      doc.addImage(imgData, 'JPEG', 0, 0, 210, 297)
    } finally {
      document.body.removeChild(container)
    }
  }
  doc.save(fileName)
}
