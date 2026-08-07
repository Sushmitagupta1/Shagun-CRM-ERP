# Multi-page Menu PDF Designer

**Date:** 2026-08-07
**Status:** Approved

## Problem

The Menu Generator currently only produces a plain text menu list rendered onto a template. Users want to paste their own labeled menu list and get **beautifully designed menu pictures** (1+ pages) they can download as a real PDF file — not a print dialog.

## Requirements

- User pastes a menu list with section labels (`STARTERS:`, `MAIN COURSE:`, `DESSERTS:`).
- User selects a template background (existing category/file picker in MenuGenerator).
- Groq generates **3 distinct design options**, each with its own theme (colors, fonts, page arrangement) and **one PDF page per labeled section**.
- Each design previews in a card; **Download PDF** produces a real multi-page A4 `.pdf` file; **Regenerate** produces a new design.
- AI-generated HTML must be sanitized before injection (no scripts, no remote images).

## Approach

Groq is a text model — it cannot render images. Instead, Groq returns HTML/CSS designs (theme + layout), which are rendered in the browser on top of the selected template background, then captured with `html2canvas` and assembled into a PDF with `jspdf`.

### Data flow

```
user menu text (labeled) ──▶ generateMenuDesign() ──▶ Groq
   ──▶ 3 blocks (---DESIGN---), pages within (---PAGE---)
   ──▶ sanitize HTML ──▶ 3 preview cards (template bg + theme)
   ──▶ Download PDF: per page html2canvas → jsPDF addImage → .pdf
```

### Groq contract

New function in `frontend/src/lib/groq.ts`:

```
generateMenuDesign({ menuText, eventType, clientName, templateInfo }): Promise<GroqResponse>
```

Prompt instructions:
- Return exactly 3 design options separated by `---DESIGN---`.
- Inside each option, separate pages with `---PAGE---`.
- Each page is a complete HTML fragment: inline `<style>` + markup.
- Use the user's exact section labels (`STARTERS:`, etc.) as page headings; each section becomes its own page.
- Apply an event-appropriate theme (wedding → gold/maroon elegant, engagement → rose/gold, corporate → navy/steel).
- Use the template background (provided URL) as page background via CSS.
- Keep each page A4-portrait compact; use the `@page`/background sizing so content fits one page per section.
- Do NOT include `<script>`, external images, or absolute URLs.

### Parser

Split AI text on `---DESIGN---` → 3 designs. Split each design on `---PAGE---` → pages array. Each design object:

```
{ id, pages: string[], name }
```

Design name taken from the first heading in page 1 (fallback: "Design Option N").

### Sanitization

Strip anything that could execute or exfiltrate:
- `<script>` tags
- `on*=` event handler attributes
- `src=`/`href=` pointing to remote origins (allow `data:` only for background if provided)
- `<iframe>`, `<object>`, `<embed>`, `<link>`
- Allow inline `<style>`, text, lists, headings, `background-image` referencing the same-origin template URL.

### PDF generation

In `MenuGenerator.tsx`:

```
async function downloadPdf(design, templateUrl) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  for each page in design.pages:
    render page HTML into a hidden container (with template bg)
    await wait for fonts/images
    const canvas = await html2canvas(container, { scale: 2, useCORS: true })
    if pageIndex > 0: doc.addPage()
    doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297)
  doc.save('menu-design.pdf')
}
```

- Template images are same-origin (`/api/templates/static/...` returns 200 on the frontend), so `useCORS` + same-origin means no canvas tainting.
- A4 portrait: 210 × 297 mm.

## UI (MenuGenerator.tsx)

New section below the existing "Generate Menu Options" button:

- **Textarea** "Paste your labeled menu" (placeholder shows the `STARTERS:`/`MAIN COURSE:`/`DESSERTS:` format).
- **Button** "Design Menu Picture" (disabled while generating; spinner + "Designing 3 Options...").
- **3 preview cards** (`lg:grid-cols-3`), each:
  - Scrolling preview of all pages (template bg + theme).
  - Buttons: **Download PDF**, **Regenerate**.
- No new route — lives inside the existing MenuGenerator page.

## Dependencies

Add to `frontend/package.json`:
- `html2canvas` (DOM → canvas)
- `jspdf` (canvas → PDF file)

## Error handling

- Groq error → `toast.error('AI error: ...')`, reset generating state.
- Parse failure (no `---DESIGN---` separators) → treat whole response as a single design; if still empty, toast error.
- PDF generation failure → toast.error, keep page usable.

## Testing

- `npm run build` (tsc + vite) passes.
- Manual: paste labeled menu → 3 designs render with template bg → Download PDF produces a multi-page A4 file → Regenerate swaps one design.

## Out of scope

- No image (PNG/JPG) export.
- No PDF library alternative (print dialog is explicitly rejected by user).
- No backend changes.
