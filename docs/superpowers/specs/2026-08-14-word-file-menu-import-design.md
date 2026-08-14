# Menu Designer — Word File Import (.doc / .docx)

**Date:** 2026-08-14
**Status:** Draft

## Problem

Menu planners already design menus inside Microsoft Word with specific formatting — underlines under headings, chosen font sizes, and a fixed layout pattern. Today the Menu Generator only accepts pasted labeled text and runs it through the AI designer, which:

1. Never reproduces the user's own Word formatting (underline, size, pattern).
2. Always produces 3 options when the user wants a single result.
3. Keeps a plain white page instead of applying the selected template picture as the page design.

The user wants: upload the Word file, keep its underline/size/pattern exactly, put the selected template's design on the page, match text colours to the template, and end up with ONE editable design that can be downloaded as PDF — all in one go inside the Menu Generator.

## Requirements

- "Upload Word File" button in the Menu Generator accepting both `.doc` and `.docx`.
- The menu text and its formatting (underline, font size, bold/italic, alignment, colour) are preserved from the Word file — no AI restyling.
- The selected template picture is applied as the page background (white page gets the template's design).
- Text colours are matched to the template (dominant colours extracted from the template image), not hard-coded.
- Exactly ONE design is produced (no 3 options) when importing from a Word file.
- The imported design is editable: each text line can be edited while its formatting is kept.
- The imported design downloads as a single A4 PDF via the existing `downloadMenuDesignPdf` pipeline.
- Everything happens in the Menu Generator page — no navigation to another screen.

## Approach

### Backend

#### Dependencies
- `mammoth` (Python) added to `backend/requirements.txt` — converts `.docx` → HTML preserving inline formatting.
- `libreoffice-writer` installed in the backend Docker image (headless) — converts legacy `.doc` → `.docx` so formatting survives.

#### Endpoint: `POST /api/menu/parse-word`
- Multipart file upload, JWT-protected (reuse the existing auth middleware).
- Accepts `.doc` and `.docx` (validated by extension + content sniff).
- For `.doc`: convert to `.docx` first via `soffice --headless --convert-to docx --outdir <tmp>`.
- Run `mammoth.convert_to_html` on the resulting `.docx`.
- Return `{ html, file_name }` where `html` is the mammoth HTML with inline formatting.
- Temp files cleaned up in a `finally`.
- No DB writes — this is a stateless conversion endpoint.

#### Dockerfile
- Add `libreoffice-writer-nogui` (Debian package) with `--no-install-recommends`; include common fonts so text renders correctly after conversion.

### Frontend

#### API (`frontend/src/api/inquiries.ts` — the Menu Generator already imports menu-version functions from here)
- New `parseWordFile(file: File): Promise<{ html: string }>` posting to `/menu/parse-word`.

#### Menu Generator (`frontend/src/pages/menu/MenuGenerator.tsx`)
- New "Upload Word File" control next to the "Labeled Menu List" textarea (`accept=".doc,.docx"`).
- On upload: call `parseWordFile`, then build a single `MenuDesign`:
  - Sanitize the mammoth HTML with the existing `sanitizeMenuHtml`.
  - Wrap it in the menu-card page structure using the selected template picture as a full-page `background-image` (`background-size:cover`), mirroring `normalizePage`'s wrapper approach so the existing PDF path renders it edge-to-edge.
  - Set `designs` to exactly one design (`{ id, name: 'Word Menu', pages: [{ html, index: 0 }], raw }`).
- The single design shows in the existing preview grid, with Edit + Download PDF actions.

#### Template-matched colours
- New helper in `frontend/src/lib/menuDesign.ts` (or `ai.ts`): `extractTemplatePalette(imageUrl)` using a canvas to downscale the template image and sample dominant colours, producing `{ heading, item, desc }`.
- The imported design's `<style>` gets a palette block (heading / dish / description colours from the dominant template colours, with sensible fallbacks) via a `withMenuTypography`-style injection — colours match the template, not Word's colours.

#### Editable word design
- New `extractWordEditable(html)` / `applyWordEdits(html, lines)` helpers in `frontend/src/lib/menuDesign.ts`:
  - Walk the block elements (`p`, `h1`–`h6`, `li`) that carry text.
  - Each block becomes an editable line: `{ key, text, tag, style }` where `style` preserves the original font-size, font-family, underline, colour and alignment.
  - The Edit modal lists each line as a styled text input; editing changes only the text, re-emitting `<tag style="...">text</tag>` so underline/size/pattern are kept.
- The existing Edit modal (or a small variant) hosts this line editor for the word-imported design.

### Data flow summary

```
Word file (.doc/.docx)
  → POST /api/menu/parse-word        (LibreOffice .doc→.docx, mammoth → HTML)
  → sanitize + wrap with template bg
  → extractTemplatePalette(template) → text colours
  → ONE MenuDesign with template-matched colours
  → preview + Edit (line editor keeps formatting)
  → downloadMenuDesignPdf (existing A4 pipeline)
```

## Files touched

- `backend/requirements.txt` — add `mammoth`.
- `backend/Dockerfile` — install `libreoffice-writer-nogui` + fonts.
- `backend/app/routers/menu.py` (or new `menu_word.py`) — `POST /api/menu/parse-word`.
- `backend/app/services/file_parsers.py` (or new service) — word→HTML conversion helper.
- `frontend/src/api/inquiries.ts` — `parseWordFile`.
- `frontend/src/lib/menuDesign.ts` — `extractTemplatePalette`, `extractWordEditable`, `applyWordEdits`.
- `frontend/src/pages/menu/MenuGenerator.tsx` — upload control, single-design build, line-editor modal.

## Testing / verification

- Backend: `pytest` for the new endpoint using a small `.docx` fixture and (if available) a `.doc` fixture; assert the returned HTML contains expected text and inline formatting.
- `npx tsc -b` and `npm run build` from `frontend` must pass (`noUnusedLocals` is on).
- Manual: upload a `.docx` and a `.doc` in the Menu Generator → one design appears with the template background, Word's underlines/sizes intact, colours matching the template; Edit a line → text changes, formatting stays; Download PDF → single full-A4 page with the template filling the sheet.

## Non-goals

- No changes to the AI designer flow (pasted text still uses the 3-option AI path).
- No persistence of the uploaded Word file itself (only the generated design is saved via the existing Save Version).
- No server-side template colour extraction (done client-side on the template image).
