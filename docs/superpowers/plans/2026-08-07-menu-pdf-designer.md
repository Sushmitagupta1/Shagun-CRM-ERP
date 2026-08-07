# AI Menu Designer (Multi-page Menu PDF) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "AI Menu Designer" section to the Menu Generator page that takes a user-labeled menu list, has Groq generate 3 distinct HTML/CSS design options on the user's selected template background, and lets the user download each as a real multi-page A4 PDF file.

**Architecture:** Groq (text model) returns 3 HTML design blocks (`---DESIGN---` separator, pages split by `---PAGE---`). The frontend sanitizes each block, renders it in a hidden container with the selected template as background, captures each page with `html2canvas`, and assembles a multi-page `.pdf` with `jspdf`.

**Tech Stack:** React 19 + TypeScript, Vite, framer-motion, Groq API (`frontend/src/lib/groq.ts`), `html2canvas`, `jspdf`, tailwindcss.

**Spec:** `docs/superpowers/specs/2026-08-07-menu-pdf-designer-design.md`

---

## File Structure

- **Modify:** `frontend/src/lib/groq.ts` — add `generateMenuDesign()`.
- **Create:** `frontend/src/lib/menuDesign.ts` — parsing (split `---DESIGN---` / `---PAGE---`) + sanitization + PDF download helper. Keeps MenuGenerator.tsx focused.
- **Modify:** `frontend/src/pages/menu/MenuGenerator.tsx` — new "AI Menu Designer" section (textarea, button, 3 preview cards, Download PDF, Regenerate).
- **Modify:** `frontend/package.json` — add `html2canvas`, `jspdf`.
- **Modify:** `frontend/tsconfig.app.json` — no change needed (default includes all `src`).

### Task 1: Add dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install html2canvas and jspdf**

Run (in `D:\Shagun CRM\frontend`):
```
npm install html2canvas jspdf
```
Expected: packages added to `dependencies` in `package.json`, exit code 0.

- [ ] **Step 2: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat: add html2canvas + jspdf for menu PDF designer"
```

### Task 2: Add `generateMenuDesign` to groq.ts

**Files:**
- Modify: `frontend/src/lib/groq.ts` (append after `generateInsights`)

- [ ] **Step 1: Add the function**

Append to `frontend/src/lib/groq.ts`:

```ts
// ── AI Menu Designer ──
export async function generateMenuDesign(params: {
  menuText: string
  eventType: string
  clientName: string
  templateInfo: string
}): Promise<GroqResponse> {
  const prompt = `You are an expert menu card designer for Shagun Caterers (pure veg only).
Design a beautiful printable menu card using the user's menu list and section labels.

Client: ${params.clientName}
Event Type: ${params.eventType}
Template background: ${params.templateInfo || 'No template selected — use a clean white background'}

USER'S MENU LIST (section labels are headings):
${params.menuText}

INSTRUCTIONS:
- Return exactly 3 DIFFERENT design options separated by "---DESIGN---".
- Inside each design option, separate pages with "---PAGE---".
- Each page is a COMPLETE HTML fragment: a <style> block (scoped inline styles) followed by <body> markup. Do NOT include <html>, <head>, doctype, <script>, external images, or absolute URLs.
- Each labeled section of the user's menu becomes its OWN page. Example: STARTERS page, MAIN COURSE page, DESSERTS page.
- Use the user's exact section label text as the page heading.
- The template background is set via CSS on a wrapper div, e.g. <div style="background-image:url('${'TEMPLATE_URL'}');background-size:100% 100%;background-position:center;background-repeat:no-repeat;min-height:100vh"> ... </div>. Replace TEMPLATE_URL literally with the given template URL string.
- Give each option a distinct theme appropriate to the event (wedding: gold/maroon elegant serif; engagement: rose/gold; corporate: navy/steel clean sans-serif). Vary fonts, colors, heading treatments, and item bullet styles between the 3 options.
- Use <h1> for the design/menu title, the section label as <h2>, and a <ul>/<li> per dish.
- Keep all CSS inline in a <style> tag that only targets the page. Use CSS classes, not element selectors that could leak.
- Content must fit A4 portrait (compact spacing, reasonable font sizes).`
  return callGroq(prompt)
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS (no TS errors).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/groq.ts
git commit -m "feat: add generateMenuDesign to groq lib"
```

### Task 3: Create `frontend/src/lib/menuDesign.ts`

**Files:**
- Create: `frontend/src/lib/menuDesign.ts`

- [ ] **Step 1: Write the module**

```ts
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

export function sanitizeMenuHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\bjavascript\s*:/gi, '')
}

export function parseMenuDesigns(raw: string): ParsedDesigns {
  const cleaned = sanitizeMenuHtml(raw)
  const designBlocks = cleaned.split('---DESIGN---').map((b) => b.trim()).filter(Boolean)
  if (designBlocks.length === 0) {
    return { designs: [], error: 'AI returned no designs. Try again.' }
  }
  const designs: MenuDesign[] = designBlocks.map((block, i) => {
    const pages = block.split('---PAGE---').map((p) => p.trim()).filter(Boolean)
    const pageHtml = pages.length > 0 ? pages : [block]
    const nameMatch = pageHtml[0].match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    const name = nameMatch
      ? nameMatch[1].replace(/<[^>]+>/g, '').trim() || `Design Option ${i + 1}`
      : `Design Option ${i + 1}`
    return {
      id: `design_${i}`,
      name,
      pages: pageHtml.map((html, p) => ({ html, index: p })),
      raw: block,
    }
  })
  return { designs }
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

    await document.fonts.ready
    await new Promise((resolve) => setTimeout(resolve, 300))

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
      width: container.offsetWidth,
      height: container.offsetHeight,
    })
    document.body.removeChild(container)

    const imgData = canvas.toDataURL('image/jpeg', 0.92)
    if (i > 0) doc.addPage()
    doc.addImage(imgData, 'JPEG', 0, 0, 210, 297)
  }
  doc.save(fileName)
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/menuDesign.ts
git commit -m "feat: add menu design parser, sanitizer, and PDF download helper"
```

### Task 4: Add the AI Menu Designer UI to MenuGenerator.tsx

**Files:**
- Modify: `frontend/src/pages/menu/MenuGenerator.tsx`

- [ ] **Step 1: Update imports**

Replace the lucide-react import line (line 12) with:

```tsx
import { ArrowLeft, Sparkles, Save, Download, RotateCcw, Loader2, CheckCircle2, BookOpen, Phone, Calendar, DollarSign, MessageSquare, FileText, User, Users, Layout, Palette, FileDown } from 'lucide-react'
```

Add after `import { generateMenu } from '@/lib/groq'`:

```tsx
import { generateMenuDesign } from '@/lib/groq'
import { parseMenuDesigns, downloadMenuDesignPdf, type MenuDesign } from '@/lib/menuDesign'
```

- [ ] **Step 2: Add state**

Add inside the `MenuGenerator()` component, after the `savingClient` state line:

```tsx
  // AI Menu Designer
  const [designMenuText, setDesignMenuText] = useState('')
  const [designing, setDesigning] = useState(false)
  const [designs, setDesigns] = useState<MenuDesign[]>([])
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null)
```

- [ ] **Step 3: Add handlers**

Add after `handleDownload` function (before `if (!inquiry)`):

```tsx
  const handleDesignMenu = async () => {
    if (!designMenuText.trim()) {
      toast.error('Paste your labeled menu first')
      return
    }
    if (!selectedCat || !selectedFile) {
      toast.error('Select a template first')
      return
    }
    setDesigning(true)
    setDesigns([])
    const res = await generateMenuDesign({
      menuText: designMenuText,
      eventType: inquiry?.event_type || 'General',
      clientName: inquiry?.client_name || 'Client',
      templateInfo: getTemplateUrl(selectedCat, selectedFile),
    })
    if (res.error) {
      toast.error('AI error: ' + res.error)
      setDesigning(false)
      return
    }
    const parsed = parseMenuDesigns(res.text)
    if (parsed.error) {
      toast.error(parsed.error)
      setDesigning(false)
      return
    }
    setDesigns(parsed.designs)
    setDesigning(false)
    toast.success(`${parsed.designs.length} designs ready`)
  }

  const handleDownloadDesignPdf = async (design: MenuDesign) => {
    setDownloadingPdf(design.id)
    try {
      await downloadMenuDesignPdf(design, `${design.name.replace(/[^\w\d]+/g, '_')}.pdf`)
      toast.success('PDF downloaded')
    } catch {
      toast.error('Failed to generate PDF')
    } finally {
      setDownloadingPdf(null)
    }
  }

  const handleRegenerateDesign = (idx: number) => {
    setDesigns((prev) => prev.filter((_, i) => i !== idx))
  }
```

- [ ] **Step 4: Add the UI section**

Add after the `{/* Options */}` block (after line 382's closing `)}` and before the final `</div>` + `)}` closing tags):

```tsx
      {/* AI Menu Designer */}
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-md">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold/20">
            <Palette size={14} className="text-gold" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">AI Menu Designer — Design on Template</h3>
        </div>
        <label className="mb-2 block text-[11px] font-bold uppercase text-gray-500">Labeled Menu List</label>
        <textarea value={designMenuText} onChange={(e) => setDesignMenuText(e.target.value)}
          placeholder={'STARTERS:\nPaneer Tikka\nHara Bhara Kebab\n\nMAIN COURSE:\nDal Makhani\nShahi Paneer\n\nDESSERTS:\nGulab Jamun\nRasmalai'}
          className="h-40 w-full rounded-lg border border-gray-200 p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gold/30" />
        <button onClick={handleDesignMenu} disabled={designing}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold to-amber-600 text-sm font-bold text-white shadow-lg transition-colors hover:from-gold hover:to-amber-700 disabled:opacity-50">
          {designing ? <><Loader2 size={16} className="animate-spin" /> Designing 3 Options...</> : <><Palette size={16} /> Design Menu Picture</>}
        </button>
      </div>

      {/* Designer Options */}
      {designs.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{designs.length} designs · select template above to change background</p>
          <div className="grid gap-4 lg:grid-cols-3">
            {designs.map((design, idx) => (
              <motion.div key={design.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
                className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md">
                <div className="border-b border-gray-100 px-4 py-3">
                  <h4 className="text-sm font-bold text-gray-900">{design.name}</h4>
                  <p className="text-[10px] text-gray-400">{design.pages.length} page{design.pages.length > 1 ? 's' : ''} · A4</p>
                </div>
                <div className="max-h-96 overflow-y-auto border-b border-gray-100 bg-gray-50 p-3">
                  {design.pages.map((page, pi) => (
                    <div key={pi} className="mb-3 overflow-hidden rounded-lg shadow-sm last:mb-0"
                      dangerouslySetInnerHTML={{ __html: page.html }} />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 p-3">
                  <button onClick={() => handleDownloadDesignPdf(design)} disabled={downloadingPdf === design.id}
                    className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-maroon text-[11px] font-medium text-white transition-colors hover:bg-maroon-dark disabled:opacity-50">
                    {downloadingPdf === design.id ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />} Download PDF
                  </button>
                  <button onClick={() => handleRegenerateDesign(idx)}
                    className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-gray-200 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50">
                    <RotateCcw size={12} /> Regenerate
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: PASS (tsc + vite both succeed).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/menu/MenuGenerator.tsx
git commit -m "feat: add AI Menu Designer section with multi-page PDF download"
```

### Task 5: Manual verification

- [ ] **Step 1: Run dev server**

Run: `npm run dev` (in `D:\Shagun CRM\frontend`), open the Menu Generator page for any inquiry.

- [ ] **Step 2: Test happy path**

1. Select a template category + file.
2. Paste a labeled menu (STARTERS:/MAIN COURSE:/DESSERTS:).
3. Click **Design Menu Picture** → 3 preview cards render with the template background.
4. Click **Download PDF** on one → multi-page A4 `.pdf` downloads.
5. **Regenerate** removes that design card.

- [ ] **Step 3: Test error paths**

1. Click Design with empty menu text → toast "Paste your labeled menu first".
2. Click Design without selecting template → toast "Select a template first".
3. Groq API failure → toast "AI error: ...".

### Task 6: Deploy + commit

- [ ] **Step 1: Build passes**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 2: Push commit**

```bash
git add frontend/src/lib/menuDesign.ts frontend/src/pages/menu/MenuGenerator.tsx frontend/src/lib/groq.ts frontend/package.json frontend/package-lock.json
git commit -m "feat: AI Menu Designer — multi-page menu PDF on selected template"
git push
```

---

## Self-Review Notes

- **Spec coverage:** generateMenuDesign (Task 2), sanitize+parse+PDF (Task 3), UI with preview cards/Download PDF/Regenerate (Task 4), template selection reuse (Task 4 uses existing `selectedCat`/`selectedFile`/`getTemplateUrl`), error handling (Task 4 handlers + Task 5), dependencies (Task 1). All spec sections covered.
- **Type consistency:** `MenuDesign`, `MenuDesignPage`, `ParsedDesigns`, `downloadMenuDesignPdf`, `parseMenuDesigns` used identically across Task 3 and Task 4. `generateMenuDesign` signature matches in Task 2 and Task 4.
- **Placeholders:** none; every step has concrete code or commands.
