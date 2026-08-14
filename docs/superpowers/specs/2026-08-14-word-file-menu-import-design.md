# Word File Menu Import & Word Export — Design Spec

> Status: Approved (2026-08-14) · Owner: Menu Generator
> Replaces the earlier "preserve formatting + PDF" version of this spec. The user's requirements changed during brainstorming: the Word file's visual formatting is no longer preserved as-is; Gemini only fixes spelling, the content is beautified on the selected template, and the deliverable is a Word (.docx) file — not a PDF.

## Goal

Let a menu planner upload a `.doc`/`.docx` menu file in the Menu Generator, have Gemini fix only the spelling (content, categories, and structure unchanged), see ONE editable preview on the selected template background with template-matched colours, and download the result as a `.docx` where the template picture fills the page background and the text is beautifully formatted on top — keeping the page structure of the original Word file (3-4 categories per page).

## Requirements (from brainstorming)

1. Upload a Word file (`.doc` and `.docx`).
2. Gemini fixes **only spelling** — "spelling thik karega". Content, categories, and structure stay exactly as in the Word file.
3. Apply the selected template: the template picture becomes the page background ("word ka background ko template se replace kar do"), and the text is beautified on it ("template laga ke beautify").
4. The page structure follows the original Word file — "jesa word me hoga ka page me 3-4 category" (3-4 categories per page).
5. Show a preview in the browser before download, with an edit step ("Preview + edit, phir download").
6. Deliverable is a **Word file only** ("Sirf Word") — no PDF for this feature.

## Superseded requirements

- Preserving the Word file's underline/font-size/pattern as-is — dropped; Gemini polish + template beautify take over the visual styling.
- PDF download for word-imported menus — dropped (output is `.docx` only).
- The existing AI flow (pasted text → Gemini → 3 design options → PDF) is **unchanged**; the Word import is a separate path.

## Architecture

- **Backend** parses the uploaded Word file into structured lines (`text`, `is_heading`, `page`) and builds the final `.docx` (template background + formatted text). Stateless — no DB writes.
- **Frontend** calls Gemini (existing client-side integration in `frontend/src/lib/ai.ts`) for the spelling-fix, renders the preview on the template, lets the user edit line texts, and posts the final lines to the backend for the Word export.
- Template images are already served and stored by the backend (`/app/templates/<category>/<file>` in Docker; `backend/templates` in local dev).

## Data flow

```
User picks template
   │
   ▼
Upload Word file → POST /api/menu/parse-word
   │  (python-docx; .doc → .docx via LibreOffice headless)
   ▼
{ file_name, lines: [{ text, is_heading, page }] }
   │
   ▼
Frontend: polishMenuText(text) → Gemini spelling fix (structure kept)
   │
   ▼
Frontend: group lines into pages (Word page breaks, else 3-4 categories/page)
   │
   ▼
Browser: single design preview on template (extractTemplatePalette colours)
   │
   ▼
Edit: line editor (text only, heading flag preserved)
   │
   ▼
POST /api/menu/export-word { lines, template_category, template_file, colors }
   │  (python-docx: A4, template image in header = full-page background, centered text)
   ▼
.docx file download
```

## Backend

### `app/services/word_parser.py` (new)

`word_to_lines(file_bytes: bytes, filename: str) -> list[dict]`:

- Validates extension (`.doc`/`.docx`) and size (max 10 MB). Errors raise `ValueError` (client error) or `RuntimeError` (conversion/parse failure).
- `.doc` → `.docx` via `soffice --headless --convert-to docx --outdir <tmp>` (same `_run_soffice` helper as before). If `soffice` is missing, `RuntimeError("LibreOffice ... not installed")`.
- Reads paragraphs with python-docx; produces one line per non-empty paragraph:
  - `text`: the paragraph text, trimmed, whitespace collapsed.
  - `is_heading`: true when the paragraph style name starts with `Heading`, or its runs are bold, or it is a short ALL-CAPS line ending with `:`.
  - `page`: page index. Explicit page breaks in the document (runs containing `<w:br w:type="page"/>`) increment the page. Defaults to `0` when the file has no explicit breaks.

### `app/routers/menu_word.py` (new)

- `POST /api/menu/parse-word` — JWT-protected (`get_current_user`), multipart `file`. Calls `word_to_lines`. Returns `{ "file_name": ..., "lines": [...] }`. Maps `ValueError` → 400, `RuntimeError` → 422.
- `POST /api/menu/export-word` — JWT-protected, JSON body:
  ```json
  {
    "lines": [{ "text": "...", "is_heading": true, "page": 0 }],
    "template_category": "Wedding",
    "template_file": "gold-border.jpg",
    "colors": { "heading": "#5A0016", "item": "#8C6A1F", "desc": "#4B5563" }
  }
  ```
  Builds a `.docx` in memory:
  - A4 portrait; all margins and header/footer distances set to 0 so the background can bleed to the edge.
  - Template image added to the section header at exactly 210 mm × 297 mm → a full-page background on every page (Word renders header content behind body text).
  - Body: centered paragraphs. Headings: bold, ALL-CAPS, in `colors.heading`, larger font (e.g. 18pt). Dish lines: in `colors.item` (e.g. 12pt). Descriptions not special-cased — the menu text is rendered as-is per line. Left/right indents give comfortable padding inside the template's border; spacing before/after headings.
  - Page breaks: a paragraph run `add_break(WD_BREAK.PAGE)` whenever the `page` field increases (or from the grouping done client-side).
  - Returns `StreamingResponse` with `Content-Disposition: attachment; filename="menu.docx"` and the docx MIME type.
  - 400 when `lines` is empty or the template file is missing.

### `backend/requirements.txt`

Add `python-docx==1.1.2`.

### `backend/Dockerfile`

Add `libreoffice-writer-nogui` and `fonts-dejavu-core` to the apt install list (for `.doc` conversion).

### `backend/app/config.py`

Add a `TEMPLATES_DIR` setting (default `/app/templates`). The word parser / export router resolves the template file via this setting, falling back to `backend/templates` (project root) for local Windows dev.

## Frontend

### `frontend/src/lib/ai.ts`

Add `polishMenuText(text: string): Promise<AIResponse>` — a text-only Gemini call (reuses `callGemini`). Prompt: "Fix spelling and obvious typos in the menu text below. Do NOT change the categories, dish names' meaning, the order, or the line structure. Change only misspelled words. Return the corrected text with the same line breaks."

**Polish merge rule (in `MenuGenerator`):** split the polished text into lines; if the count matches the parsed lines, apply each polished line in order to the original lines (keeps every `is_heading` flag). If the count differs, rebuild the lines from the polished text and re-detect headings with the ALL-CAPS-short-line heuristic (`is_heading` = short line that is ALL-CAPS or ends with `:`).

### `frontend/src/api/inquiries.ts`

- `parseWordFile(file: File)` → `POST /menu/parse-word` (multipart) → `{ file_name, lines }`.
- `downloadWordMenu(payload: { lines, template_category, template_file, colors })` → `POST /menu/export-word` (JSON) → downloads the returned `.docx` (read the response as a Blob).

### `frontend/src/lib/menuDesign.ts`

- `extractTemplatePalette(imageUrl)` — samples the dominant (non-white/non-black) colours of the template image (64×64 canvas) → `{ heading, item, desc }` with a sensible fallback. Existing helper ported from the earlier plan.
- `buildWordPageHtml(contentHtml, templateUrl, palette)` — wraps the polished text (as `<p>` lines) on the template background with `background-size: cover`, template-matched text colours, first line as heading colour. Used only for the on-screen preview.
- `wordLinesToHtml(lines)` — converts parsed lines to simple HTML (`<p>` per line, heading lines get a heading class / style).
- `groupWordLines(lines, categoriesPerPage = 4)` — if the Word file had no explicit page breaks, groups the lines so each page holds up to 4 category sections; returns lines with a computed `page`. If explicit page breaks exist, they are kept.

### `frontend/src/components/menu/WordMenuEditor.tsx` (new)

Line editor modal: one input per line, styled to reflect heading vs dish line. Editing text only; heading flags preserved. Save → returns updated lines.

### `frontend/src/pages/menu/MenuGenerator.tsx`

- Upload control next to the "Labeled Menu List" textarea: "Upload Word File (.doc / .docx)".
- On upload: require a selected template, call `parseWordFile`, then `polishMenuText` on the joined line texts, then `groupWordLines`, then `buildWordPageHtml` → a single design card (`id` prefix `word_`). Errors → toast via `getErrorMessage`.
- Design card for word designs: **Edit Items** (opens `WordMenuEditor`) and **Download Word** button. No **Regenerate**, no **Download PDF** for word designs.
- Version viewer: word designs edit via `WordMenuEditor`, no Regenerate button.
- Save Version flow unchanged (designs are saved with the version).

## Error handling

| Condition | Behaviour |
| --- | --- |
| Unsupported extension | 400 "Only .doc and .docx files are supported" |
| File > 10 MB | 400 "File too large (max 10MB)" |
| Empty file / no readable text | 400 "No readable text found" |
| `.doc` and `soffice` missing / conversion fails | 422 with message |
| Gemini rate limit | existing retry (3 attempts) then error toast |
| No template selected at upload | toast "Select a template first" |
| Template file missing at export | 400 |

## Testing

- `backend/tests/test_word_parser.py` — unit tests: lines/heading/page extraction from an in-memory-built `.docx` (minimal OOXML zip), extension/size validation, `.doc` without soffice → RuntimeError.
- `backend/tests/test_menu_word.py` — API tests (reuse the session `client` fixture + seeded `admin@shaguncatering.com`): parse-word returns lines; unsupported file → 400; missing auth → 401/403; export-word returns a readable `.docx` (re-open the response bytes with python-docx and assert heading text/colours); empty lines → 400.
- Frontend: `npm run build` and `npm run lint` (no JS test runner in the repo).
- Manual E2E: upload a short `.docx`, confirm spelling-fix + single preview + edit + Word download with template background.

## Out of scope

- PDF export for word-imported menus.
- AI redesign/regeneration of word-imported content (Gemini must not change structure).
- Editing the template background inside the Word file (image is fixed full-page behind the text).
