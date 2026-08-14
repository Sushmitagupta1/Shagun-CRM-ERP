# Menu Designer — 3-Option Palettes, Typography Hierarchy, Full-A4 PDF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the AI menu designer so the 3 options use one selected template with distinct blue/purple/black text palettes, a big ALL-CAPS heading / medium dish name / small description typography hierarchy (all different fonts+colours, sentence-case items), and downloadable PDFs that are clean full-A4 pages with the template picture cover-filled edge-to-edge.

**Architecture:** Frontend-only. `frontend/src/lib/ai.ts` builds the Gemini prompt from a `MENU_PALETTES` constant. `frontend/src/lib/menuDesign.ts` adds palette enforcement CSS (`withMenuTypography`) applied at parse time, name+description splitting for editing, and an A4 PDF fix (fixed page height + `background-size: cover`). `frontend/src/pages/menu/MenuGenerator.tsx` gains description inputs in the Edit modal and Edit/Download/Regenerate buttons on saved versions.

**Tech Stack:** React + TypeScript (Vite, `noUnusedLocals` on), Gemini via OpenAI-compatible endpoint, html2canvas + jsPDF for PDF.

**Spec:** `docs/superpowers/specs/2026-08-14-menu-designer-palettes-a4-design.md`

---

### Task 1: Palette infrastructure in `menuDesign.ts`

**Files:**
- Modify: `frontend/src/lib/menuDesign.ts` — `MenuDesign` interface (line ~9), new constants near `FONT_OPTIONS` (line ~49), `parseMenuDesigns` (line ~420)

- [ ] **Step 1: Add `paletteIndex` to the `MenuDesign` interface**

In `frontend/src/lib/menuDesign.ts`, change the interface (lines 9-14):

```ts
export interface MenuDesign {
  id: string
  name: string
  pages: MenuDesignPage[]
  raw: string
  paletteIndex?: number
}
```

- [ ] **Step 2: Add the `MenuPalette` interface and `MENU_PALETTES` constant**

Insert right after the `FONT_OPTIONS` array (after line 62):

```ts
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
```

- [ ] **Step 3: Add `withMenuTypography`**

Insert after `applyTextOverrides` (after line 159):

```ts
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
```

- [ ] **Step 4: Apply the palette in `parseMenuDesigns`**

Replace the whole `parseMenuDesigns` function (lines 420-440):

```ts
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
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: no errors (existing callers pass one argument; `paletteIndex` optional).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/menuDesign.ts
git commit -m "feat(menu): palette infra and deterministic typography enforcement"
```

---

### Task 2: Gemini prompt rewrite in `ai.ts`

**Files:**
- Modify: `frontend/src/lib/ai.ts` — `DESIGN_THEMES` (line ~230), `generateMenuDesign` (line ~246), `buildMenuDesignPrompt` (line ~273)

- [ ] **Step 1: Import palette types and drop `DESIGN_THEMES`**

Add to the top of `frontend/src/lib/ai.ts`:

```ts
import { MENU_PALETTES, type MenuPalette } from './menuDesign'
```

Replace the `DESIGN_THEMES` block (lines 230-234) with nothing (delete it).

- [ ] **Step 2: Extend `generateMenuDesign` params and loop with `paletteIndex`**

Replace the `generateMenuDesign` function (lines 246-271):

```ts
export async function generateMenuDesign(params: {
  menuText: string
  eventType: string
  clientName: string
  templateInfo: string
  templateImage?: string | null
  count?: number
  previousDesign?: string | null
  paletteIndex?: number
}): Promise<AIResponse> {
  const designCount = params.count || 3
  const outputs: string[] = []
  for (let i = 0; i < designCount; i++) {
    const paletteIdx = params.paletteIndex ?? i
    const palette = MENU_PALETTES[paletteIdx % MENU_PALETTES.length]
    const themeNote = `- Apply THIS text palette (exact hex colours) for this option, option ${i + 1} of ${designCount}:
  HEADING colour ${palette.heading} — ALL CAPS, font-family ${palette.headingFont}.
  DISH NAME colour ${palette.item} — font-family ${palette.itemFont}.
  DESCRIPTION colour ${palette.desc} — font-family ${palette.descFont}.
  Use these exact colours and fonts; you may pick very close shades only if they clash badly with the template picture.`
    const prompt = buildMenuDesignPrompt(params, themeNote)
    const res = params.templateImage
      ? await callGeminiVision(prompt, params.templateImage, 40000)
      : await callGemini(prompt, 40000)
    if (res.error) return res
    const cleaned = cleanSingleDesign(res.text)
    if (!cleaned) return { text: '', error: 'AI returned an empty response. Try again.' }
    outputs.push(cleaned)
  }
  return { text: outputs.join('\n\n---DESIGN---\n\n') }
}
```

- [ ] **Step 3: Rewrite `buildMenuDesignPrompt`**

Replace the whole `buildMenuDesignPrompt` function (lines 273-328) with:

```ts
function buildMenuDesignPrompt(params: {
  menuText: string
  eventType: string
  clientName: string
  templateInfo: string
  templateImage?: string | null
  previousDesign?: string | null
}, themeNote: string): string {
  const templateImageNote = params.templateImage
    ? `\n- I am attaching the actual template picture. Study it carefully and match its border, frame, colours and style.
- The template picture already has its own border/frame decoration. Do NOT add any extra border or frame of your own — just place the text content in the CLEAR MIDDLE area inside the template's border, with comfortable padding so no text overlaps the border decoration.`
    : ''
  const regenerationNote = params.previousDesign
    ? `\n- This is a REGENERATION. Keep the same menu items and section labels, and KEEP the same text palette given below, but produce a clearly DIFFERENT layout: change the arrangement, ornament spacing and heading treatment. Do not just repeat the previous design.\nPREVIOUS VERSION (for reference only):\n${params.previousDesign.slice(0, 1500)}`
    : ''
  const backgroundGuidance = params.templateInfo
    ? `- Set the template background via CSS on the wrapper div, e.g. <div style="display:flex;align-items:center;justify-content:center;background-image:url('TEMPLATE_URL');background-size:cover;background-position:center;background-repeat:no-repeat;min-height:100vh;padding:40px"> ... </div>. Replace TEMPLATE_URL literally with the given template URL string. background-size:cover (NOT 100% 100%) so the picture fills the page without distortion. The wrapper MUST be display:flex with align-items:center and justify-content:center so the content sits in the MIDDLE of the border.`
    : `- Use a clean cream or white wrapper div (no background image), with the same flex centering so the content sits in the middle of the page.`
  return `You are an expert luxury menu card designer for Shagun Caterers (pure veg only).
Design a beautiful wedding-menu booklet using ONLY the user's menu list and section labels.

CONTENT RULE (very important):
- The design must contain ONLY text the user provided below. Do NOT invent the client's name, event name, dates, venues, phone numbers, or any other text.
- If the user's menu already starts with a heading/name/date line, that exact line may be used on the cover. Otherwise use a decorative ornament and the plain word "MENU".
- A "SPECIAL MENU FOR / AT / Decorator / Event Co-Ordinator / Colour Theme / Crockery & Cutlery / Type of Function / Type of Service / Office Address / Residence Address" block is a DETAILS page — render it exactly as given, leaving values blank when the user left them blank.

DESIGN STYLE:
- Warm cream / ivory page background (#F7EBDB to #FEF7EB). NO plain white, no dark page backgrounds.
- Use the option's text palette (given below) for all text colours and fonts. Only when a template picture is provided, keep its own border and do not add a frame of your own.
- Refined, symmetrical, spacious layout, everything horizontally centered.
Template background: ${params.templateInfo || 'No template selected — use the cream wedding style above'}

USER'S MENU LIST (section labels are headings):
${params.menuText}

${themeNote}

INSTRUCTIONS:
- Return exactly 1 design option. Do NOT output "---DESIGN---", "Design Option N:", "Page N:" or any other separator or label text — output only the page markup.
- Separate pages with "---PAGE---". The separator must appear BETWEEN complete pages, never inside a page's markup.
- Each page is a COMPLETE, SELF-CONTAINED HTML fragment: a <style> block (scoped inline styles) followed by the page markup wrapped in a single wrapper <div> that is opened AND closed on that same page. Do NOT share one wrapper <div> across pages. No <html>, <head>, doctype, <script>, external images, or absolute URLs.
- PAGE STRUCTURE, in this exact order:
  1. COVER page: large decorative title (use the user's top line if present, else "MENU"), small flourish ornament under it, nothing else.
  2. DETAILS page: title "PROPOSED MENU" (or "MENU") then "SPECIAL MENU FOR - PAX ON AT:" and the details list (Decorator, Event Co-Ordinator, Colour Theme, Crockery & Cutlery, Type of Function, Type of Service, Office Address, Residence Address) with the user's values after each colon. If the user's menu has no such block, skip this page.
  3. MENU pages: each labeled section of the user's menu becomes its OWN page (e.g. a "High Tea" page, a "Mehandi Dinner" page, a "Reception Dinner" page, then each station/section page). Use the user's exact section label as the <h2>.
- LIST EVERY DISH, DO NOT SKIP ANYTHING: every dish, drink and line the user wrote MUST appear. Never merge several dishes into one line, never summarise, never drop a dish or a subsection. If the menu is long, simply use more pages (---PAGE---) — but include absolutely everything.
- TYPOGRAPHY HIERARCHY (per menu page, mandatory):
  1. Section headings (<h2>): LARGE (16-20px), ALL CAPS, bold, in the HEADING colour and HEADING font of the option palette.
  2. Dish names (<strong class="dish-name"> inside each <li>): MEDIUM (13-15px), in the DISH NAME colour and DISH NAME font of the palette, sentence case (only the first word capitalised).
  3. Dish descriptions (<span class="dish-desc">, on their own line under the name): SMALL (10-11px), in the DESCRIPTION colour and DESCRIPTION font, sentence case.
- SPLITTING RULE: if a dish line contains a "-", "–", "—" or ":" separator, the part before it is the dish name and the part after it is the description. Lines without a separator are name-only (no description span).
- Do NOT capitalise dish names or descriptions — only headings are ALL CAPS.
- DISH LIST STRUCTURE (mandatory): <ul class="menu-dishes"> with one <li class="menu-dish"> per dish, containing <strong class="dish-name">NAME</strong> followed by <span class="dish-desc">DESCRIPTION</span> (omit the span when there is no description).
- Use <h1> for the page title (cover title, PROPOSED MENU), <h2> for section labels.
${backgroundGuidance}
- CENTER EACH PAGE: on the wrapper div use display:flex, align-items:center, justify-content:center, min-height:100vh, padding:40px. The inner card is centered (text-align:center) with padding; nothing touches the frame edges.
- SMALL COMPACT FONTS so the whole menu fits one A4 portrait sheet: cover title <h1> 26-34px, "PROPOSED MENU" <h1> 28-36px, section headings <h2> 16-20px, dish names 13-15px, descriptions 10-11px.
- Keep all CSS inline in a <style> tag that only targets the page. Use CSS classes, not element selectors that could leak.
- Content must fit A4 portrait. Each page must be a SINGLE A4 sheet — never let one section spill onto a second page, and never put two sections on one page.
${templateImageNote}
${regenerationNote}`
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b`
Expected: no errors. `DESIGN_THEMES` gone, `MENU_PALETTES`/`MenuPalette` imported (both used).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/ai.ts
git commit -m "feat(menu): train Gemini with palette, template-matching and typography hierarchy prompt"
```

---

### Task 3: Description support in `menuDesign.ts` (fonts/colors/detect/extract/edit)

**Files:**
- Modify: `frontend/src/lib/menuDesign.ts` — `MenuEditableItem` (line ~21), `MenuFonts`/`MenuColors` (lines 37-47), `DEFAULT_FONTS` (line ~64), `detectPageColors` (line ~109), `detectPageFonts` (line ~122), `applyTextOverrides` (line ~141), `extractMenuEditable` (line ~283), `editLiText` (line ~258), `applyMenuEdits` (line ~306)

- [ ] **Step 1: Extend types**

Change `MenuEditableItem` (line 21-24):

```ts
export interface MenuEditableItem {
  key: string
  text: string
  description?: string
}
```

Change `MenuFonts` and `MenuColors` (lines 37-47):

```ts
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
```

Change `DEFAULT_FONTS` (lines 64-68):

```ts
const DEFAULT_FONTS: MenuFonts = {
  title: "'Playfair Display', Georgia, serif",
  heading: "'Playfair Display', Georgia, serif",
  item: "'Lato', 'Segoe UI', Arial, sans-serif",
  description: "'Lato', 'Segoe UI', Arial, sans-serif",
}
```

- [ ] **Step 2: Add the line-split helper**

Insert just before `countLis` (before line 232):

```ts
// Splits a dish line "Name - description" / "Name: description" / "Name–description"
// into name + description. Lines without a separator are name-only.
export function splitMenuLine(text: string): { name: string; description: string } {
  const m = text.match(/^(.+?)\s*[-–—:]\s*(.+)$/)
  return m
    ? { name: m[1].trim(), description: m[2].trim() }
    : { name: text, description: '' }
}
```

- [ ] **Step 3: Read name + description in `extractMenuEditable`**

Add a helper before `extractMenuEditable` (before line 283):

```ts
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
```

Change the `items` line inside `extractMenuEditable` (currently line 292):

```ts
      items: lis.map((li, i) => {
        const { name, description } = liNameDesc(li)
        return { key: `p${pi}_i${i}`, text: name, description }
      }),
```

- [ ] **Step 4: Rebuild `editLiText` to keep the split**

Replace `editLiText` (lines 258-273):

```ts
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
```

- [ ] **Step 5: Update `applyMenuEdits` to pass full items**

Replace the `texts`/`ul` block in `applyMenuEdits` (lines 342-366):

```ts
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
```

- [ ] **Step 6: Add description to `detectPageColors` / `detectPageFonts`**

Replace `detectPageColors` (lines 109-118):

```ts
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
```

Replace `detectPageFonts` (lines 122-129):

```ts
export function detectPageFonts(html: string): MenuFonts {
  const sm = html.match(/<style>([\s\S]*?)<\/style>/i)
  const style = sm ? sm[1] : ''
  const title = fontInRule(style, 'h1') || fontInRule(style, '\\.\\w[\\w-]*title[\\w-]*') || DEFAULT_FONTS.title
  const heading = fontInRule(style, 'h2') || fontInRule(style, '\\.\\w[\\w-]*heading[\\w-]*') || fontInRule(style, '\\.\\w[\\w-]*section[\\w-]*') || DEFAULT_FONTS.heading
  const item = fontInRule(style, 'ul\\s+li') || fontInRule(style, '\\.\\w[\\w-]*item[\\w-]*') || fontInRule(style, 'li') || DEFAULT_FONTS.item
  const description = fontInRule(style, '\\.dish-desc') || fontInRule(style, '\\.\\w[\\w-]*desc[\\w-]*') || DEFAULT_FONTS.description
  return { title: matchFontOption(title), heading: matchFontOption(heading), item: matchFontOption(item), description: matchFontOption(description) }
}
```

- [ ] **Step 7: Add description overrides in `applyTextOverrides`**

Replace the `rules.push` block in `applyTextOverrides` (lines 147-156):

```ts
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
```

- [ ] **Step 8: Typecheck**

Run: `npx tsc -b`
Expected: no errors (`description` is optional everywhere, so `MenuGenerator.tsx` still compiles).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/lib/menuDesign.ts
git commit -m "feat(menu): name and description splitting for dish editing"
```

---

### Task 4: Full-A4 PDF fix in `downloadMenuDesignPdf`

**Files:**
- Modify: `frontend/src/lib/menuDesign.ts` — `downloadMenuDesignPdf` (line ~473)

- [ ] **Step 1: Rewrite the PDF loop**

Replace the whole `downloadMenuDesignPdf` function (lines 473-524):

```ts
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
    inner.style.height = `${PAGE_H}px`
    inner.style.transformOrigin = 'top left'
    // Full-A4 fix: min-height:100vh resolves to the BROWSER window height (not
    // the sheet), which pushed the content to the wrong place and left the
    // picture not covering the page. Pin the page height and cover-fill the
    // template so the picture spans the whole A4 edge-to-edge with no stretch.
    const fixed = scopeMenuHtml(design.pages[i].html, 'pdf-scope')
      .replace(/min-height\s*:\s*100vh/gi, `height:${PAGE_H}px`)
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/menuDesign.ts
git commit -m "fix(menu): full-A4 PDF with cover-filled template and correct centering"
```

---

### Task 5: Persist `paletteIndex` in saved versions

**Files:**
- Modify: `frontend/src/types/inquiry.ts` — `MenuDesignPayload` (line ~76)
- Modify: `frontend/src/api/inquiries.ts` — `createMenuVersion` (line ~206)

- [ ] **Step 1: Extend the payload type**

Change `MenuDesignPayload` (lines 76-81):

```ts
export interface MenuDesignPayload {
  id: string
  name: string
  pages: { html: string; index: number }[]
  raw: string
  paletteIndex?: number
}
```

- [ ] **Step 2: Extend `createMenuVersion` data type**

Change the `data` type in `createMenuVersion` (line 208):

```ts
  data: { menu_text: string | null; designs: { id: string; name: string; pages: { html: string; index: number }[]; raw: string; paletteIndex?: number }[]; template_category: string | null; template_file: string | null }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: no errors (`MenuDesign` is structurally assignable to the extended payload).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/inquiry.ts frontend/src/api/inquiries.ts
git commit -m "feat(menu): persist design palette index in saved menu versions"
```

---

### Task 6: Edit modal — description inputs + font/colour rows in `MenuGenerator.tsx`

**Files:**
- Modify: `frontend/src/pages/menu/MenuGenerator.tsx` — initial states (lines 42-43), `handleAddItem` (line ~183), add `handleEditDescription`, fonts/colors section (lines 541-545), dish inputs (lines 590-601)

- [ ] **Step 1: Add `handleEditDescription`**

Insert after `handleEditItem` (after line 181):

```ts
  const handleEditDescription = (pageIndex: number, itemKey: string, text: string) => {
    setEditDraft((prev) => prev.map((p) => (p.pageIndex === pageIndex
      ? { ...p, items: p.items.map((it) => (it.key === itemKey ? { ...it, description: text } : it)) }
      : p)))
  }
```

- [ ] **Step 2: Extend `handleAddItem`**

Change `handleAddItem` (lines 183-187):

```ts
  const handleAddItem = (pageIndex: number) => {
    setEditDraft((prev) => prev.map((p) => (p.pageIndex === pageIndex
      ? { ...p, items: [...p.items, { key: `${p.pageIndex}_new_${Date.now()}`, text: '', description: '' }] }
      : p)))
  }
```

- [ ] **Step 3: Add the Description font/colour row**

Change the fonts/colors array (lines 541-545):

```tsx
                    {([
                      ['Title font', 'title'],
                      ['Heading font', 'heading'],
                      ['Item font', 'item'],
                      ['Description font', 'description'],
                    ] as const).map(([label, key]) => (
```

- [ ] **Step 4: Add a description input per dish**

Replace the dish input row (lines 590-601):

```tsx
                      {page.items.map((item) => (
                        <div key={item.key} className="flex items-center gap-2">
                          <input value={item.text} onChange={(e) => handleEditItem(page.pageIndex, item.key, e.target.value)}
                            placeholder="Dish name"
                            className="w-1/2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gold/30" />
                          <input value={item.description ?? ''} onChange={(e) => handleEditDescription(page.pageIndex, item.key, e.target.value)}
                            placeholder="Description (optional)"
                            className="w-1/2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-400 focus:outline-none focus:ring-2 focus:ring-gold/30" />
                          <button onClick={() => handleRemoveItem(page.pageIndex, item.key)}
                            className="shrink-0 rounded-lg border border-red-100 p-2 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/menu/MenuGenerator.tsx
git commit -m "feat(menu): edit dish names and descriptions separately with description font/colour"
```

---

### Task 7: Regenerate by design object + version viewer actions in `MenuGenerator.tsx`

**Files:**
- Modify: `frontend/src/pages/menu/MenuGenerator.tsx` — `handleRegenerateDesign` (lines 128-162), live design card Regenerate button (line 457-460), version viewer modal (lines 470-513)

- [ ] **Step 1: Refactor `handleRegenerateDesign` to take a design object and keep its palette**

Replace `handleRegenerateDesign` (lines 128-162):

```ts
  const handleRegenerateDesign = async (design: MenuDesign) => {
    if (regeneratingIdx !== null) return
    setRegeneratingIdx(design.id)
    try {
      let templateImage: string | null = null
      if (selectedCat && selectedFile) {
        templateImage = await loadImageAsDataUrl(getTemplateUrl(selectedCat, selectedFile))
      }
      const paletteIdx = design.paletteIndex ?? 0
      const res = await generateMenuDesign({
        menuText: designMenuText,
        eventType: inquiry?.event_type || 'General',
        clientName: inquiry?.client_name || 'Client',
        templateInfo: selectedCat && selectedFile ? getTemplateUrl(selectedCat, selectedFile) : '',
        templateImage,
        count: 1,
        previousDesign: design.raw,
        paletteIndex: paletteIdx,
      })
      if (res.error) {
        toast.error('AI error: ' + res.error)
        return
      }
      const parsed = parseMenuDesigns(res.text, paletteIdx)
      if (parsed.error || parsed.designs.length === 0) {
        toast.error(parsed.error || 'AI returned no design. Try again.')
        return
      }
      const replacement = { ...parsed.designs[0], id: design.id }
      setDesigns((prev) => {
        const exists = prev.some((d) => d.id === design.id)
        return exists ? prev.map((d) => (d.id === design.id ? replacement : d)) : [...prev, replacement]
      })
      toast.success('Design regenerated')
    } finally {
      setRegeneratingIdx(null)
    }
  }
```

- [ ] **Step 2: Update the live design card Regenerate button**

Replace the live card Regenerate button (lines 457-460):

```tsx
                    <button onClick={() => handleRegenerateDesign(design)} disabled={regeneratingIdx !== null}
                      className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-gray-200 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50">
                      {regeneratingIdx === design.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Regenerate
                    </button>
```

- [ ] **Step 3: Add Edit / Download / Regenerate buttons to the version viewer**

In the version viewer modal (lines 470-513), change `v.designs.map((d, di) => (` to include a footer. Replace the card content (lines 490-505):

```tsx
                    {v.designs.map((d, di) => (
                      <div key={di} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                        <div className="border-b border-gray-100 px-4 py-3">
                          <h4 className="text-sm font-bold text-gray-900">{d.name}</h4>
                          <p className="text-[10px] text-gray-400">{d.pages?.length ?? 0} pages · A4</p>
                        </div>
                        <div className="max-h-96 overflow-y-auto bg-gray-50 p-3">
                          {(d.pages ?? []).map((page, pi) => (
                            <div key={pi} className="mb-3 overflow-hidden rounded-lg shadow-sm last:mb-0">
                              <PagePreview html={page.html} scopeId={`ver${v.version}-d${di}-p${pi}`} />
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 border-t border-gray-100 p-3">
                          <button onClick={() => { setDesigns(v.designs ?? []); setViewingVersion(null); handleOpenEdit(d) }}
                            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 text-[11px] font-medium text-amber-700 transition-colors hover:bg-gold/20">
                            <Pencil size={12} /> Edit
                          </button>
                          <button onClick={() => handleDownloadDesignPdf(d)} disabled={downloadingPdf === d.id}
                            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-maroon text-[11px] font-medium text-white transition-colors hover:bg-maroon-dark disabled:opacity-50">
                            {downloadingPdf === d.id ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />} Download PDF
                          </button>
                          <button onClick={() => { setDesigns(v.designs ?? []); setViewingVersion(null); handleRegenerateDesign(d) }} disabled={regeneratingIdx !== null}
                            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50">
                            {regeneratingIdx === d.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Regenerate
                          </button>
                        </div>
                      </div>
                    ))}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b`
Expected: no errors. `handleOpenEdit(d)` and `handleRegenerateDesign(d)` accept `MenuDesignPayload` (structurally compatible with `MenuDesign`).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/menu/MenuGenerator.tsx
git commit -m "feat(menu): edit, regenerate and download on every saved menu version"
```

---

### Task 8: Final verification

- [ ] **Step 1: Typecheck + production build**

Run: `npx tsc -b; if ($?) { npm run build }`
Expected: tsc clean; Vite build succeeds (the existing >500 kB chunk-size warning is acceptable, pre-existing).

- [ ] **Step 2: Confirm git status is clean**

Run: `git status --short`
Expected: no uncommitted changes.

- [ ] **Step 3: Commit anything left over (if any)**

```bash
git add -A
git commit -m "chore(menu): finalize designer palette and A4 pdf work"
```
(Only if Step 2 showed changes.)

---

## Self-Review Notes

- **Spec coverage:** palettes (Tasks 1-2), template-matching/no-extra-border + clear middle (Task 2 prompt), 3-level typography + ALL-CAPS/sentence-case (Tasks 2 + 1 enforcement), small fonts (Task 2), description splitting (Task 3), full-A4 cover-fill PDF (Task 4), per-version Edit/Download/Regenerate (Task 7), palette persisted so Regenerate keeps it (Task 5).
- **Type consistency:** `paletteIndex?: number` on `MenuDesign`, `MenuDesignPayload`, `createMenuVersion` data. `description?: string` on `MenuFonts`/`MenuColors`/`MenuEditableItem`. `withMenuTypography(html, palette)`; `parseMenuDesigns(raw, paletteIndex = 0)`; `handleRegenerateDesign(design: MenuDesign)`; `generateMenuDesign({ ..., paletteIndex })`.
- **No placeholders:** every step has complete code or exact commands.
