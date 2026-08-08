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
