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
}

export interface ParsedDesigns {
  designs: MenuDesign[]
  error?: string
}

export interface MenuEditableItem {
  key: string
  text: string
}

export interface MenuEditablePage {
  pageIndex: number
  heading: string
  items: MenuEditableItem[]
}

export interface MenuFonts {
  title: string
  heading: string
  item: string
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

const DEFAULT_FONTS: MenuFonts = {
  title: "'Playfair Display', Georgia, serif",
  heading: "'Playfair Display', Georgia, serif",
  item: "'Lato', 'Segoe UI', Arial, sans-serif",
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
  while ((m = re.exec(style)) !== null) last = m[1].trim()
  return last
}

// Best-effort detection of the current title/heading/item fonts from the
// page's <style>. Falls back to sensible defaults when nothing is found.
export function detectPageFonts(html: string): MenuFonts {
  const sm = html.match(/<style>([\s\S]*?)<\/style>/i)
  const style = sm ? sm[1] : ''
  const title = fontInRule(style, 'h1') || fontInRule(style, '\\.\\w*title\\w*') || DEFAULT_FONTS.title
  const heading = fontInRule(style, 'h2') || fontInRule(style, '\\.\\w*heading\\w*') || fontInRule(style, '\\.\\w*section\\w*') || DEFAULT_FONTS.heading
  const item = fontInRule(style, 'ul\\s+li') || fontInRule(style, '\\.\\w*item\\w*') || fontInRule(style, 'li') || DEFAULT_FONTS.item
  return { title: matchFontOption(title), heading: matchFontOption(heading), item: matchFontOption(item) }
}

const FONT_OVERRIDE_MARK = '/* user-font-overrides */'

// Injects !important font-family overrides at the end of the page's <style>
// so the user's font choices win over the AI-generated rules.
export function applyFontOverrides(html: string, fonts: MenuFonts): string {
  const sm = html.match(/<style>([\s\S]*?)<\/style>/i)
  if (!sm) return html
  const base = sm[1].replace(/\n\s*\/\* user-font-overrides \*\/[\s\S]*$/, '').replace(/\s+$/, '')
  const overrides = `\n${FONT_OVERRIDE_MARK}\nh1, [class*="title"] { font-family: ${fonts.title} !important; }\nh2, [class*="heading"], [class*="section"] { font-family: ${fonts.heading} !important; }\nul li, [class*="item"] { font-family: ${fonts.item} !important; }\n`
  return html.replace(sm[0], `<style>${base}${overrides}</style>`)
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
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
function editLiText(li: HTMLElement, text: string) {
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
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  li.innerHTML = prefixHtml + escaped
}

// Pulls out the section heading and item texts of each page so they can be
// edited in a form without touching the design's styling.
export function extractMenuEditable(design: MenuDesign): MenuEditablePage[] {
  return design.pages.map((page, pi) => {
    const doc = new DOMParser().parseFromString(page.html, 'text/html')
    const headings = Array.from(doc.body.querySelectorAll('h1, h2'))
    const headingEl = headings[headings.length - 1] || null
    const heading = headingEl ? stripHtml(headingEl.innerHTML) : `Page ${pi + 1}`
    const ul = mainUl(doc)
    const lis = ul ? Array.from(ul.children).filter((el) => el.tagName === 'LI') as HTMLElement[] : []
    return {
      pageIndex: pi,
      heading,
      items: lis.map((li, i) => ({ key: `p${pi}_i${i}`, text: liDisplayText(li) })),
    }
  })
}

function pageStyle(html: string): string {
  const m = html.match(/<style>[\s\S]*?<\/style>/i)
  return m ? m[0] : ''
}

// Rebuilds each page's HTML with the edited heading, item texts, title and
// fonts, keeping the original <style>, wrapper div, and <li> styles intact.
export function applyMenuEdits(design: MenuDesign, pages: MenuEditablePage[], opts?: { title?: string; fonts?: MenuFonts }): MenuDesign {
  const updatedPages = design.pages.map((page, pi) => {
    const edits = pages.find((p) => p.pageIndex === pi)
    let html = page.html

    const style = pageStyle(html)
    const doc = new DOMParser().parseFromString(html, 'text/html')
    doc.head.querySelectorAll('style').forEach((s) => s.remove())
    doc.body.querySelectorAll('style').forEach((s) => s.remove())

    if (edits) {
      const headings = Array.from(doc.body.querySelectorAll('h1, h2'))
      const headingEl = headings[headings.length - 1] || null
      if (headingEl && edits.heading.trim()) headingEl.textContent = edits.heading.trim()

      const texts = edits.items.map((it) => it.text).filter((t) => t.trim() !== '')
      const ul = mainUl(doc)
      if (ul) {
        const lis = Array.from(ul.children).filter((el) => el.tagName === 'LI') as HTMLElement[]
        lis.forEach((li, i) => {
          if (i < texts.length) editLiText(li, texts[i])
          else li.remove()
        })
        if (texts.length > lis.length) {
          const template = lis[lis.length - 1] || doc.createElement('li')
          for (let i = lis.length; i < texts.length; i++) {
            const clone = template.cloneNode(true) as HTMLElement
            editLiText(clone, texts[i])
            ul.appendChild(clone)
          }
        }
      } else if (texts.length > 0) {
        const newUl = doc.createElement('ul')
        texts.forEach((t) => {
          const li = doc.createElement('li')
          li.textContent = t
          newUl.appendChild(li)
        })
        doc.body.appendChild(newUl)
      }
    }

    if (opts?.title && opts.title.trim()) {
      doc.body.querySelectorAll('h1').forEach((h1) => (h1.textContent = opts.title!.trim()))
    }

    const bodyHtml = doc.body.innerHTML.trim()
    html = style ? `${style}\n${bodyHtml}` : bodyHtml

    if (opts?.fonts) html = applyFontOverrides(html, opts.fonts)
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

export function parseMenuDesigns(raw: string): ParsedDesigns {
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
    const pageHtml = splitPages(block)
    return {
      id: `design_${i}`,
      name,
      pages: pageHtml.map((html, p) => ({ html, index: p })),
      raw: block,
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
  for (let i = 0; i < design.pages.length; i++) {
    const container = document.createElement('div')
    container.style.position = 'absolute'
    container.style.left = '-9999px'
    container.style.top = '0'
    container.style.width = '794px'
    container.style.zIndex = '-1'
    container.innerHTML = design.pages[i].html
    document.body.appendChild(container)
    try {
      await document.fonts.ready
      await new Promise((resolve) => setTimeout(resolve, 300))

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: container.offsetWidth,
        height: container.offsetHeight,
      })

      const imgData = canvas.toDataURL('image/jpeg', 0.92)
      if (i > 0) doc.addPage()
      const pageW = 210
      const pageH = 297
      const imgW = canvas.width
      const imgH = canvas.height
      const scale = Math.min(pageW / imgW, pageH / imgH)
      const w = imgW * scale
      const h = imgH * scale
      const x = (pageW - w) / 2
      const y = (pageH - h) / 2
      doc.addImage(imgData, 'JPEG', x, y, w, h)
    } finally {
      document.body.removeChild(container)
    }
  }
  doc.save(fileName)
}
