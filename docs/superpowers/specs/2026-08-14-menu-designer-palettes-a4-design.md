# Menu Designer — 3-Option Palettes, Typography Hierarchy, Full-A4 PDF

**Date:** 2026-08-14
**Status:** Approved

## Problem

The Menu Generator's AI-produced designs and PDF output don't match what users want:

1. The AI designs don't respect the selected template picture — Gemini invents its own border frame on top of the template's border, and content overlaps the border instead of sitting in the clear middle.
2. Menu typography is flat: category headings, dish names and dish descriptions are not visually differentiated. Users want a 3-level hierarchy — category = big ALL-CAPS heading, dish name = medium with its own colour + font, description = small with a third colour + font — with palettes like royal blue, royal purple, black & gold, all matching the template.
3. Downloaded PDFs are broken: the template picture is not a clean full A4 page — it looks stretched, and the content sits oddly in the middle.
4. Saved menu versions can only be previewed and loaded — users want Edit, Save, Re-generate and Download available on every saved version, same as live designs.

## Requirements

- "Design Menu Picture" still produces **3 design options**.
- All 3 options use the **same selected template picture**; each option applies a different text palette (Royal Blue, Royal Purple, Black & Gold) chosen by the user in brainstorming.
- Each option's content sits in the **clear middle** of the template border — no extra AI-drawn border, no overlap.
- Typography hierarchy enforced:
  - Section/category heading: **large, ALL CAPS**, strong palette colour.
  - Dish name: **medium**, second palette colour + second font.
  - Dish description (after `-`, `–`, `—` or `:`): **small**, third palette colour + third font.
  - Only headings are ALL CAPS; dish names and descriptions are sentence case (first word capital).
- Fonts are smaller overall so more items fit on one A4 page.
- PDF output: template picture fills the **entire A4 page** (210 × 297 mm) edge-to-edge with `background-size: cover` (no distortion, minimal cropping on non-A4 templates), content correctly centered on the page.
- Edit, Save, Regenerate, Download work on **every saved menu version**, not just live designs.

## Approach

### Data model changes

`MenuDesign` (in `frontend/src/lib/menuDesign.ts`) gains a `paletteIndex: number` field so Regenerate keeps the same palette.

New exported palette constant `MENU_PALETTES` (3 entries). Each entry:

```
{ id, name, heading, item, desc, headingFont, itemFont, descFont }
```

- **Royal Blue:** heading `#1E3A8A`, item `#3B5BDB`, desc `#4B5563`
- **Royal Purple:** heading `#4A148C`, item `#6A1B9A`, desc `#374151`
- **Black & Gold:** heading `#1A1A1A`, item `#8C6A1F`, desc `#4B5563`

Fonts per level are chosen from `FONT_OPTIONS` (e.g. heading `Playfair Display`, item `Montserrat`, desc `Lato`) — three distinct families per option.

### AI prompt (`frontend/src/lib/ai.ts`)

- Replace `DESIGN_THEMES` with the 3 `MENU_PALETTES`; the `themeNote` for option `i` now references `MENU_PALETTES[i]` (colour values + font names) instead of the maroon/gold / modern-minimal / romantic themes.
- Template guidance (when a template image is attached): study the picture carefully; **keep the template's own border/frame; do NOT add a separate border**; place content in the clear middle with comfortable padding (no overlap); choose text colours that complement the template while using the option's palette.
- New CONTENT TYPOGRAPHY instructions:
  - `<h2>` section headings: large (16–20px), **ALL CAPS**, strong palette colour.
  - Dish names: medium (13–15px), the option's item colour + item font, sentence case.
  - Descriptions: small (10–11px), the option's desc colour + desc font, sentence case, on their own line under the name.
  - Splitting rule: when a dish line contains a `-`, `–`, `—` or `:` separator, render the part before it as the dish name and the part after as the description; lines without a separator are name-only.
  - Keep fonts small so everything fits one A4 sheet.
- Fixed dish structure so our tooling can edit reliably:

```
<ul class="menu-dishes">
  <li class="menu-dish"><strong class="dish-name">Paneer Tikka</strong><span class="dish-desc">grilled paneer with mint chutney</span></li>
</ul>
```

### Palette + typography enforcement (`frontend/src/lib/menuDesign.ts`)

New function `withMenuTypography(html, palette)` that strips any prior `/* menu-typography */` block from the page's `<style>` and appends deterministic rules:

```
h2, [class*="heading"], [class*="section"] {
  text-transform: uppercase !important;
  color: <heading> !important;
  font-family: <headingFont> !important;
}
.dish-name { color: <item> !important; font-family: <itemFont> !important; }
.dish-desc { color: <desc> !important; font-family: <descFont> !important; font-size: 10.5px !important; }
```

Guarantees the requested look even if Gemini drifts. Applied:
- In `parseMenuDesigns`, per page, using palette `MENU_PALETTES[i % 3]` and storing `paletteIndex` on the design.
- After Regenerate, re-applied with the source design's palette (`handleRegenerateDesign` corrects the returned design's `paletteIndex` before replacing).

User font/colour overrides in the Edit modal already append later `!important` rules (via `applyTextOverrides`), so they still win.

### Edit flow with descriptions

- `MenuEditableItem` gains `description: string`.
- `extractMenuEditable` splits each dish's display text at the first `-`/`–`/`—`/`:` separator into `text` (name) and `description`.
- `editLiText`-equivalent rebuild in `applyMenuEdits`: keep the decorative `prefixHtml`, then output `<strong class="dish-name">name</strong>` plus `<span class="dish-desc">desc</span>` when a description exists.
- `MenuFonts`/`MenuColors` gain a `description` entry; `detectPageFonts`/`detectPageColors`/`applyTextOverrides` handle the `.dish-desc` selector; the Edit modal gains a "Description" font/colour row and a second input per dish (name + description).

### Full-A4 PDF fix (`downloadMenuDesignPdf` in `frontend/src/lib/menuDesign.ts`)

Root cause of the "weird middle / stretched" PDF: pages use `min-height:100vh`, which resolves to the browser *window* height rather than the fixed 1123px (A4 @ 96dpi) sheet, so content centers at the wrong position and the background doesn't reliably cover the page.

In the PDF path, before mounting each page:
- `min-height: 100vh` → fixed `height: 1123px` (regex replace, tolerant of whitespace).
- `background-size: 100% 100%` → `background-size: cover` (fills the whole A4 edge-to-edge with no distortion).
- Remove the old scale-down / translateY centering math — with a fixed height the page always centers correctly.
- Keep `html2canvas(scale: 2, useCORS: true)` → `doc.addImage(..., 0, 0, 210, 297)`.

### Actions on every menu version (`frontend/src/pages/menu/MenuGenerator.tsx`)

Version viewer modal: each saved design card gets the same actions as live designs:
- **Edit** — loads that design into the Edit modal (closes viewer).
- **Download PDF** — runs `downloadMenuDesignPdf` on the stored design.
- **Regenerate** — sets `designs` to a copy of that version's designs, regenerates the target design (keeps its palette), closes viewer; user then hits **Save Version** to persist.

## Files touched

- `frontend/src/lib/ai.ts` — `MENU_PALETTES`, prompt rewrite (template matching, typography hierarchy, ALL-CAPS headings, sentence-case items/descriptions, small fonts, fixed dish classes).
- `frontend/src/lib/menuDesign.ts` — `MenuDesign.paletteIndex`, `MENU_PALETTES`, `withMenuTypography`, edit split/rebuild, `description` in fonts/colors/detect/overrides, A4 PDF fix.
- `frontend/src/pages/menu/MenuGenerator.tsx` — Edit modal description inputs + Description font/colour row; version viewer Edit/Download/Regenerate buttons; Regenerate palette preservation.

## Testing / verification

- `npx tsc -b` and `npm run build` from `frontend` must pass (frontend-only change; `noUnusedLocals` is on).
- Manual: generate 3 options on one template → each shows a distinct palette, ALL-CAPS headings, sentence-case items, small descriptions, content inside the border; Download PDF → full-A4 cover-filled picture, centered content; Edit a dish with a description → split survives; Save Version → new version shows Edit/Download/Regenerate.

## Non-goals

- No backend changes (versions already store full designs).
- No changes to non-menu AI features.
- Old saved versions are frozen snapshots; they get the PDF cover-fill fix but keep their original styling until regenerated.
