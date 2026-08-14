# Word File Import for Menu Designer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let menu planners upload a `.doc`/`.docx` menu file in the Menu Generator, keep its underline/size/pattern, apply the selected template background with template-matched colours, and get ONE editable design they can download as PDF.

**Architecture:** A stateless backend endpoint (`POST /api/menu/parse-word`) converts `.doc`→`.docx` via LibreOffice headless, then parses the `.docx` with `python-docx` into HTML that carries inline formatting (font-size, underline, bold, alignment). The frontend wraps that HTML on the selected template background (single page), extracts a template-matched colour palette from the template image, shows exactly one design, edits it via a line editor that preserves formatting, and downloads via the existing A4 PDF pipeline.

**Tech Stack:** FastAPI (backend), python-docx + LibreOffice (word parsing), React 19 + TypeScript (frontend), html2canvas/jsPDF (existing PDF pipeline).

**Spec:** `docs/superpowers/specs/2026-08-14-word-file-menu-import-design.md`

---

## File Structure

- **Create** `backend/app/services/word_parser.py` — `.doc`→`.docx` conversion (`_run_soffice`) + `docx_to_html` (python-docx → inline-styled HTML) + `word_to_html(bytes, filename)` (entry point, validates extension/size).
- **Create** `backend/app/routers/menu_word.py` — `POST /api/menu/parse-word` (JWT-protected multipart upload).
- **Modify** `backend/app/main.py` — register the router.
- **Modify** `backend/requirements.txt` — add `python-docx`.
- **Modify** `backend/Dockerfile` — install `libreoffice-writer-nogui` + fonts.
- **Create** `backend/tests/test_word_parser.py` — unit tests for the service (no DB).
- **Create** `backend/tests/test_menu_word.py` — API tests (login + upload).
- **Modify** `frontend/src/api/inquiries.ts` — add `parseWordFile`.
- **Modify** `frontend/src/lib/menuDesign.ts` — add `TemplatePalette`, `WordEditableBlock`, `extractTemplatePalette`, `extractWordEditable`, `applyWordEdits`, `buildWordPageHtml`.
- **Create** `frontend/src/components/menu/WordMenuEditor.tsx` — line editor modal.
- **Modify** `frontend/src/pages/menu/MenuGenerator.tsx` — upload control, single-design build, word editor wiring, hide Regenerate for word designs.

---

## Task 1: Backend — word parsing service (unit tests)

**Files:**
- Create: `backend/app/services/word_parser.py`
- Test: `backend/tests/test_word_parser.py`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add python-docx to requirements**

In `backend/requirements.txt`, after the `openpyxl==3.1.5` line add:

```
python-docx==1.1.2
```

- [ ] **Step 2: Write the failing unit test**

Create `backend/tests/test_word_parser.py`:

```python
import io
import os
import tempfile
import zipfile

import pytest

from app.services.word_parser import docx_to_html, word_to_html


def build_docx(paragraphs: list[tuple[str, list[tuple[str, str]]]]) -> bytes:
    """paragraphs: list of (pPr_xml, [(run_props_xml, text), ...])."""
    body = []
    for ppr, runs in paragraphs:
        run_xml = []
        for props, text in runs:
            rpr = f"<w:rPr>{props}</w:rPr>" if props else ""
            run_xml.append(f'<w:r>{rpr}<w:t xml:space="preserve">{text}</w:t></w:r>')
        ppr_xml = f"<w:pPr>{ppr}</w:pPr>" if ppr else ""
        body.append(f"<w:p>{ppr_xml}{''.join(run_xml)}</w:p>")
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{''.join(body)}</w:body></w:document>"
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        "</Types>"
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        "</Relationships>"
    )
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", rels)
        zf.writestr("word/document.xml", document_xml)
    return buf.getvalue()


def _write_temp_docx(data: bytes) -> str:
    fd, path = tempfile.mkstemp(suffix=".docx")
    with os.fdopen(fd, "wb") as f:
        f.write(data)
    return path


def test_docx_to_html_preserves_size_underline_alignment():
    data = build_docx([
        ('<w:jc w:val="center"/>', [('<w:sz w:val="48"/>', "WEDDING MENU")]),
        ("", [('<w:b/><w:u w:val="single"/><w:sz w:val="28"/>', "STARTERS")]),
        ("", [("", "Paneer Tikka")]),
        ("", [("", "Hara Bhara Kebab")]),
    ])
    path = _write_temp_docx(data)
    try:
        html = docx_to_html(path)
    finally:
        os.unlink(path)

    assert "text-align:center" in html
    assert "font-size:24pt" in html  # sz val 48 = 24pt (half-points)
    assert "<u>" in html
    assert "<strong>" in html
    assert "font-size:14pt" in html  # sz val 28 = 14pt
    assert "Paneer Tikka" in html
    assert "Hara Bhara Kebab" in html


def test_word_to_html_docx_roundtrip():
    data = build_docx([("", [("", "Shahi Paneer")])])
    html = word_to_html(data, "menu.docx")
    assert "Shahi Paneer" in html


def test_word_to_html_rejects_unsupported_extension():
    with pytest.raises(ValueError):
        word_to_html(b"hello", "menu.txt")


def test_word_to_html_rejects_oversize_file():
    with pytest.raises(ValueError):
        word_to_html(b"x" * (10 * 1024 * 1024 + 1), "menu.docx")
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `python -m pytest tests/test_word_parser.py -v` (from `backend`).
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.word_parser'`.

- [ ] **Step 4: Install python-docx**

Run: `python -m pip install -r requirements.txt` (from `backend`).
Expected: python-docx installed successfully.

- [ ] **Step 5: Write the minimal implementation**

Create `backend/app/services/word_parser.py`:

```python
import os
import shutil
import subprocess
import tempfile

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH

MAX_FILE_BYTES = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {".doc", ".docx"}


def _run_soffice(src_path: str, out_dir: str) -> str:
    """Convert a legacy .doc to .docx via headless LibreOffice."""
    soffice = shutil.which("soffice")
    if soffice is None:
        raise RuntimeError("LibreOffice (soffice) is not installed on this server — cannot parse .doc files")
    os.makedirs(out_dir, exist_ok=True)
    env = dict(os.environ)
    env["HOME"] = out_dir
    cmd = [
        soffice,
        "--headless",
        "-env:UserInstallation=file://" + out_dir.replace("\\", "/"),
        "--convert-to", "docx",
        "--outdir", out_dir,
        src_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=180, env=env)
    if result.returncode != 0:
        raise RuntimeError(f"LibreOffice conversion failed: {result.stderr[-500:]}")
    base = os.path.splitext(os.path.basename(src_path))[0]
    converted = os.path.join(out_dir, base + ".docx")
    if not os.path.isfile(converted):
        raise RuntimeError("LibreOffice conversion produced no output file")
    return converted


def _escape(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _run_html(run) -> str:
    text = run.text or ""
    if not text.strip():
        return ""
    inner = _escape(text)
    if run.font.bold:
        inner = f"<strong>{inner}</strong>"
    if run.font.italic:
        inner = f"<em>{inner}</em>"
    if run.font.underline:
        inner = f"<u>{inner}</u>"
    styles = []
    size = run.font.size
    if size is not None and size.pt:
        styles.append(f"font-size:{size.pt:g}pt")
    color = None
    try:
        if run.font.color is not None and run.font.color.type is not None:
            rgb = run.font.color.rgb
            if rgb is not None:
                color = str(rgb)
    except Exception:
        color = None
    if color:
        styles.append(f"color:#{color}")
    if styles:
        inner = f'<span style="{";".join(styles)}">{inner}</span>'
    return inner


def docx_to_html(file_path: str) -> str:
    """Convert a .docx file to HTML, preserving font size, underline, bold,
    italic, colour and alignment as inline styles."""
    doc = Document(file_path)
    parts = []
    for para in doc.paragraphs:
        if not "".join(run.text for run in para.runs).strip():
            continue
        styles = []
        alignment = para.alignment
        if alignment == WD_ALIGN_PARAGRAPH.CENTER:
            styles.append("text-align:center")
        elif alignment == WD_ALIGN_PARAGRAPH.RIGHT:
            styles.append("text-align:right")
        elif alignment == WD_ALIGN_PARAGRAPH.JUSTIFY:
            styles.append("text-align:justify")
        runs_html = "".join(_run_html(run) for run in para.runs)
        style_attr = f' style="{";".join(styles)}"' if styles else ""
        parts.append(f"<p{style_attr}>{runs_html}</p>")
    return "\n".join(parts)


def word_to_html(file_bytes: bytes, filename: str) -> str:
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError("Only .doc and .docx files are supported")
    if len(file_bytes) > MAX_FILE_BYTES:
        raise ValueError("File too large (max 10MB)")
    with tempfile.TemporaryDirectory() as work_dir:
        src_path = os.path.join(work_dir, "upload" + ext)
        with open(src_path, "wb") as f:
            f.write(file_bytes)
        target = src_path
        if ext == ".doc":
            target = _run_soffice(src_path, os.path.join(work_dir, "conv"))
        return docx_to_html(target)
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `python -m pytest tests/test_word_parser.py -v` (from `backend`).
Expected: 4 passed.

- [ ] **Step 7: Commit**

```bash
git add backend/requirements.txt backend/tests/test_word_parser.py backend/app/services/word_parser.py
git commit -m "feat(menu): word parser service preserving docx formatting"
```

---

## Task 2: Backend — parse-word endpoint (API tests)

**Files:**
- Create: `backend/app/routers/menu_word.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_menu_word.py`

- [ ] **Step 1: Write the failing API test**

Create `backend/tests/test_menu_word.py`:

```python
import io
import os
import tempfile
import zipfile

import pytest_asyncio


def build_docx(paragraphs: list[tuple[str, list[tuple[str, str]]]]) -> bytes:
    body = []
    for ppr, runs in paragraphs:
        run_xml = []
        for props, text in runs:
            rpr = f"<w:rPr>{props}</w:rPr>" if props else ""
            run_xml.append(f'<w:r>{rpr}<w:t xml:space="preserve">{text}</w:t></w:r>')
        ppr_xml = f"<w:pPr>{ppr}</w:pPr>" if ppr else ""
        body.append(f"<w:p>{ppr_xml}{''.join(run_xml)}</w:p>")
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{''.join(body)}</w:body></w:document>"
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        "</Types>"
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        "</Relationships>"
    )
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", rels)
        zf.writestr("word/document.xml", document_xml)
    return buf.getvalue()


async def login(client, username, password):
    resp = await client.post("/api/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, f"Login failed: {resp.status_code} {resp.text}"
    return resp.json()["access_token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


async def test_parse_word_docx_returns_html(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    docx = build_docx([
        ('<w:jc w:val="center"/>', [('<w:sz w:val="48"/>', "WEDDING MENU")]),
        ("", [('<w:u w:val="single"/>', "STARTERS")]),
        ("", [("", "Paneer Tikka")]),
    ])
    resp = await client.post(
        "/api/menu/parse-word",
        headers=auth(token),
        files={"file": ("menu.docx", docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert resp.status_code == 200, resp.text
    html = resp.json()["html"]
    assert "WEDDING MENU" in html
    assert "text-align:center" in html
    assert "font-size:24pt" in html
    assert "<u>" in html
    assert "Paneer Tikka" in html


async def test_parse_word_rejects_unsupported_file(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    resp = await client.post("/api/menu/parse-word", headers=auth(token), files={"file": ("menu.txt", b"hello", "text/plain")})
    assert resp.status_code == 400


async def test_parse_word_requires_auth(client):
    resp = await client.post("/api/menu/parse-word", files={"file": ("menu.docx", b"x", "application/octet-stream")})
    assert resp.status_code in (401, 403)


async def test_parse_word_doc_failure_handled(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    # A fake .doc cannot be converted (or soffice is missing) — must be a clean 422, never a crash.
    resp = await client.post("/api/menu/parse-word", headers=auth(token), files={"file": ("menu.doc", b"not a real doc", "application/msword")})
    assert resp.status_code == 422
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python -m pytest tests/test_menu_word.py -v` (from `backend`).
Expected: FAIL with 404 (route not registered).

- [ ] **Step 3: Implement the endpoint and register the router**

Create `backend/app/routers/menu_word.py`:

```python
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.middleware.auth import get_current_user
from app.models.user import User
from app.services.word_parser import word_to_html

router = APIRouter(prefix="/api/menu", tags=["menu-word"])


@router.post("/parse-word")
async def parse_word(file: UploadFile = File(...), _: User = Depends(get_current_user)):
    content = await file.read()
    try:
        html = word_to_html(content, file.filename or "")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"html": html, "file_name": file.filename or ""}
```

In `backend/app/main.py`, add the import after the other router imports (line 14, after `events_router` import):

```python
from app.routers.menu_word import router as menu_word_router
```

and register it after `app.include_router(events_router)` (line 29):

```python
app.include_router(menu_word_router)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python -m pytest tests/test_menu_word.py -v` (from `backend`).
Expected: 4 passed. (Requires the test Postgres with seeded users to be up, as with the existing test suite.)

- [ ] **Step 5: Run the full backend test suite**

Run: `python -m pytest -v` (from `backend`).
Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/menu_word.py backend/app/main.py backend/tests/test_menu_word.py
git commit -m "feat(menu): parse-word endpoint for .doc/.docx menus"
```

---

## Task 3: Backend — LibreOffice in the Docker image

**Files:**
- Modify: `backend/Dockerfile`

- [ ] **Step 1: Add LibreOffice to the Docker image**

In `backend/Dockerfile`, extend the `apt-get install` list (lines 5-8) to:

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    libreoffice-writer-nogui \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
```

- [ ] **Step 2: Sanity-check the package name**

Run: `docker compose build backend` (optional, takes a few minutes).
Expected: image builds without errors and `libreoffice-writer-nogui` is installed.

- [ ] **Step 3: Commit**

```bash
git add backend/Dockerfile
git commit -m "chore(backend): install LibreOffice for .doc menu conversion"
```

---

## Task 4: Frontend — parseWordFile API

**Files:**
- Modify: `frontend/src/api/inquiries.ts`

- [ ] **Step 1: Add the API function**

In `frontend/src/api/inquiries.ts`, after `downloadMenuSlotFile` (end of file, line 261), add:

```ts
export async function parseWordFile(file: File): Promise<{ html: string; file_name: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await client.post('/menu/parse-word', formData)
  return response.data
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build` (from `frontend`).
Expected: TypeScript compiles and the build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/inquiries.ts
git commit -m "feat(menu): parseWordFile api client"
```

---

## Task 5: Frontend — menuDesign.ts word-import helpers

**Files:**
- Modify: `frontend/src/lib/menuDesign.ts`

Add the following code at the end of `frontend/src/lib/menuDesign.ts` (after `downloadMenuDesignPdf`):

```ts
export interface TemplatePalette {
  heading: string
  item: string
  desc: string
}

export interface WordEditableBlock {
  key: string
  text: string
  tag: string
  style: string
}

// Samples the dominant (non-white/non-black) colours of a template image and
// returns them as heading/item colours so imported menu text matches the template.
export async function extractTemplatePalette(imageUrl: string): Promise<TemplatePalette> {
  const fallback: TemplatePalette = { heading: '#5A0016', item: '#8C6A1F', desc: '#4B5563' }
  try {
    const blob = await fetch(imageUrl).then((r) => (r.ok ? r.blob() : null))
    if (!blob) return fallback
    const objectUrl = URL.createObjectURL(blob)
    const img = new Image()
    img.src = objectUrl
    await img.decode()
    URL.revokeObjectURL(objectUrl)
    const S = 64
    const canvas = document.createElement('canvas')
    canvas.width = S
    canvas.height = S
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return fallback
    ctx.drawImage(img, 0, 0, S, S)
    const data = ctx.getImageData(0, 0, S, S).data
    const counts = new Map<string, number>()
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3]
      if (a < 200) continue
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const brightness = r * 0.299 + g * 0.587 + b * 0.114
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      if (brightness > 235 && max - min < 25) continue
      if (brightness < 25) continue
      const key = `${Math.round(r / 32) * 32},${Math.round(g / 32) * 32},${Math.round(b / 32) * 32}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])
    if (ranked.length === 0) return fallback
    const hex = (bucket: string): string => {
      const [r, g, b] = bucket.split(',').map(Number)
      return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
    }
    const heading = hex(ranked[0][0])
    const item = ranked[1] ? hex(ranked[1][0]) : heading
    return { heading, item, desc: '#4B5563' }
  } catch {
    return fallback
  }
}

// True when an element holds visible text directly (its own text nodes) and has
// no element child that carries text — i.e. the innermost text container.
function isWordRunElement(el: Element): boolean {
  if (!el.textContent || !el.textContent.trim()) return false
  let hasDirectText = false
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent && node.textContent.trim()) {
      hasDirectText = true
      break
    }
  }
  if (!hasDirectText) return false
  for (const child of Array.from(el.children)) {
    if (child.textContent && child.textContent.trim()) return false
  }
  return true
}

// Splits a word-imported page into editable lines. Each line is the innermost
// element holding the visible text directly (e.g. a <u>, <strong> or a <p>
// holding bare text), so its underline/bold tag and the ancestor spans carrying
// font-size/alignment all survive an edit.
export function extractWordEditable(html: string): WordEditableBlock[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const runs = Array.from(doc.body.querySelectorAll('*')).filter(
    (el) => isWordRunElement(el) && el.tagName !== 'STYLE' && el.tagName !== 'SCRIPT'
  )
  return runs.map((el, i) => ({
    key: `w${i}`,
    text: (el.textContent ?? '').trim().replace(/\s+/g, ' '),
    tag: el.tagName.toLowerCase(),
    style: el.getAttribute('style') ?? '',
  }))
}

// Re-emits the page with edited line texts. Only the text inside each run
// element changes; tags and inline styles carrying the Word formatting are kept.
export function applyWordEdits(html: string, blocks: WordEditableBlock[]): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const runs = Array.from(doc.body.querySelectorAll('*')).filter(
    (el) => isWordRunElement(el) && el.tagName !== 'STYLE' && el.tagName !== 'SCRIPT'
  )
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  runs.forEach((el, i) => {
    const block = blocks[i]
    if (!block) return
    const text = block.text.trim()
    if (text) el.innerHTML = esc(text)
    else el.remove()
  })
  return doc.body.innerHTML
}

// Wraps word-imported HTML on a template background with template-matched text
// colours. Produces a single page so the existing single-sheet PDF pipeline works.
export function buildWordPageHtml(contentHtml: string, templateUrl: string, palette: TemplatePalette): string {
  const style = `<style>
    .word-menu-card {
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 40px;
      background-image: url('${templateUrl}');
      background-size: cover; background-position: center; background-repeat: no-repeat;
    }
    .word-menu-inner { width: 100%; text-align: center; }
    .word-menu-inner p, .word-menu-inner li, .word-menu-inner td, .word-menu-inner th, .word-menu-inner span {
      color: ${palette.item} !important; margin: 0.3em 0;
    }
    .word-menu-inner p:first-of-type, .word-menu-inner p:first-of-type span {
      color: ${palette.heading} !important;
    }
  </style>`
  return `${style}<div class="word-menu-card"><div class="word-menu-inner">${contentHtml}</div></div>`
}
```

- [ ] **Step 1: Verify the build**

Run: `npm run build` (from `frontend`).
Expected: TypeScript compiles and the build succeeds (`noUnusedLocals` is on — every export is used only by later tasks, so keep all new symbols exported).

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/menuDesign.ts
git commit -m "feat(menu): word-import helpers - palette, editable lines, template page"
```

---

## Task 6: Frontend — WordMenuEditor component

**Files:**
- Create: `frontend/src/components/menu/WordMenuEditor.tsx`

- [ ] **Step 1: Write the component**

Create `frontend/src/components/menu/WordMenuEditor.tsx`:

```tsx
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { X, Save } from 'lucide-react'
import { extractWordEditable, applyWordEdits, type WordEditableBlock } from '@/lib/menuDesign'

// Converts a CSS style string ("font-size:24pt; color:#123456") to a React style object.
function styleToObject(style: string): Record<string, string> {
  const obj: Record<string, string> = {}
  style.split(';').forEach((pair) => {
    const idx = pair.indexOf(':')
    if (idx === -1) return
    const key = pair.slice(0, idx).trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
    const val = pair.slice(idx + 1).trim()
    if (key && val) obj[key] = val
  })
  return obj
}

function lineStyle(block: WordEditableBlock): Record<string, string> {
  const obj = styleToObject(block.style)
  if (block.tag === 'u') obj.textDecoration = 'underline'
  if (block.tag === 'strong' || block.tag === 'b') obj.fontWeight = 'bold'
  if (block.tag === 'em' || block.tag === 'i') obj.fontStyle = 'italic'
  return obj
}

export default function WordMenuEditor({ html, onClose, onSave }: {
  html: string
  onClose: () => void
  onSave: (html: string) => void
}) {
  const [blocks, setBlocks] = useState<WordEditableBlock[]>([])

  useEffect(() => { setBlocks(extractWordEditable(html)) }, [html])

  const update = (key: string, text: string) => {
    setBlocks((prev) => prev.map((b) => (b.key === key ? { ...b, text } : b)))
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
        className="mt-8 w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Edit Word Menu</h3>
            <p className="text-[11px] text-gray-400">Text edits only — underline, size and layout from the Word file are kept.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto bg-gray-50 p-5">
          {blocks.map((b) => (
            <input
              key={b.key}
              value={b.text}
              onChange={(e) => update(b.key, e.target.value)}
              style={lineStyle(b) as CSSProperties}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button onClick={onClose}
            className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={() => onSave(applyWordEdits(html, blocks))}
            className="flex h-9 items-center gap-2 rounded-lg bg-maroon px-4 text-xs font-bold text-white transition-colors hover:bg-maroon-dark">
            <Save size={13} /> Save Changes
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build` (from `frontend`).
Expected: TypeScript compiles and the build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/menu/WordMenuEditor.tsx
git commit -m "feat(menu): word menu line editor modal"
```

---

## Task 7: Frontend — Menu Generator upload, single design, edit wiring

**Files:**
- Modify: `frontend/src/pages/menu/MenuGenerator.tsx`

- [ ] **Step 1: Update imports**

In `frontend/src/pages/menu/MenuGenerator.tsx`:

1. Line 8 — add `parseWordFile` to the `@/api/inquiries` import:

```tsx
import { getMenuVersions, createMenuVersion, parseWordFile } from '@/api/inquiries'
```

2. Line 6 — add `buildWordPageHtml` and `extractTemplatePalette` to the `@/lib/menuDesign` import:

```tsx
import { parseMenuDesigns, downloadMenuDesignPdf, extractMenuEditable, applyMenuEdits, detectPageFonts, detectPageColors, scopeMenuHtml, buildWordPageHtml, extractTemplatePalette, FONT_OPTIONS, type MenuDesign, type MenuEditablePage, type MenuFonts, type MenuColors } from '@/lib/menuDesign'
```

3. Line 12 — add `Upload` to the lucide-react import:

```tsx
import { ArrowLeft, Sparkles, RotateCcw, Loader2, Phone, Calendar, DollarSign, MessageSquare, FileText, User, Users, Layout, Palette, FileDown, Save, History, Eye, ChevronDown, ChevronUp, X, Pencil, Plus, Trash2, Upload } from 'lucide-react'
```

4. After the `INQUIRY_STATUSES, PAYMENT_STATUSES` import (line 14), add:

```tsx
import { getErrorMessage } from '@/lib/apiError'
import WordMenuEditor from '@/components/menu/WordMenuEditor'
```

- [ ] **Step 2: Add state**

In the "AI Menu Designer" state block (after line 43 `editColors`), add:

```tsx
const [uploadingWord, setUploadingWord] = useState(false)
const [editingWordDesignId, setEditingWordDesignId] = useState<string | null>(null)
```

- [ ] **Step 3: Add the upload + save-word-edit handlers**

After `handleLoadVersion` (after line 223), add:

```tsx
const handleWordUpload = async (file?: File) => {
  if (!file) return
  if (!selectedCat || !selectedFile) {
    toast.error('Select a template first')
    return
  }
  setUploadingWord(true)
  try {
    const { html } = await parseWordFile(file)
    const cleaned = sanitizeMenuHtml(html)
    const templateUrl = getTemplateUrl(selectedCat, selectedFile)
    const palette = await extractTemplatePalette(templateUrl)
    const pageHtml = buildWordPageHtml(cleaned, templateUrl, palette)
    const design: MenuDesign = {
      id: `word_${Date.now()}`,
      name: 'Word Menu',
      pages: [{ html: pageHtml, index: 0 }],
      raw: cleaned,
    }
    setDesigns([design])
    setDesignMenuText(cleaned.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    toast.success('Word menu imported — 1 design ready')
  } catch (err) {
    toast.error(getErrorMessage(err, 'Word file import failed'))
  } finally {
    setUploadingWord(false)
  }
}

const handleSaveWordEdit = (newHtml: string) => {
  setDesigns((prev) => prev.map((d) =>
    d.id === editingWordDesignId
      ? { ...d, pages: [{ ...d.pages[0], html: newHtml }], raw: newHtml }
      : d
  ))
  setEditingWordDesignId(null)
  toast.success('Design updated. Click "Save Version" to keep it.')
}
```

Note: `sanitizeMenuHtml` and `getTemplateUrl` are already imported in this file.

- [ ] **Step 4: Add the upload control above the menu textarea**

Replace the block at lines 364-367:

```tsx
        <label className="mb-2 block text-[11px] font-bold uppercase text-gray-500">Labeled Menu List</label>
        <textarea value={designMenuText} onChange={(e) => setDesignMenuText(e.target.value)}
```

with:

```tsx
        <div className="mb-2 flex items-center justify-between">
          <label className="block text-[11px] font-bold uppercase text-gray-500">Labeled Menu List</label>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50">
            <Upload size={12} /> {uploadingWord ? 'Importing…' : 'Upload Word File (.doc / .docx)'}
            <input type="file" className="hidden" accept=".doc,.docx" disabled={uploadingWord}
              onChange={(e) => { handleWordUpload(e.target.files?.[0]); e.target.value = '' }} />
          </label>
        </div>
        <textarea value={designMenuText} onChange={(e) => setDesignMenuText(e.target.value)}
```

- [ ] **Step 5: Branch Edit and hide Regenerate for word designs**

In the designs grid card (around lines 457-470), replace the two action blocks:

```tsx
                  <button onClick={() => handleOpenEdit(design)}
                    className="mb-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 text-[11px] font-medium text-amber-700 transition-colors hover:bg-gold/20">
                    <Pencil size={12} /> Edit Items
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => handleDownloadDesignPdf(design)} disabled={downloadingPdf === design.id}
                      className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-maroon text-[11px] font-medium text-white transition-colors hover:bg-maroon-dark disabled:opacity-50">
                      {downloadingPdf === design.id ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />} Download PDF
                    </button>
                    <button onClick={() => handleRegenerateDesign(design)} disabled={regeneratingIdx !== null}
                      className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-gray-200 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50">
                      {regeneratingIdx === design.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Regenerate
                    </button>
                  </div>
```

with:

```tsx
                  {design.id.startsWith('word_') ? (
                    <button onClick={() => setEditingWordDesignId(design.id)}
                      className="mb-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 text-[11px] font-medium text-amber-700 transition-colors hover:bg-gold/20">
                      <Pencil size={12} /> Edit Items
                    </button>
                  ) : (
                    <button onClick={() => handleOpenEdit(design)}
                      className="mb-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 text-[11px] font-medium text-amber-700 transition-colors hover:bg-gold/20">
                      <Pencil size={12} /> Edit Items
                    </button>
                  )}
                  {design.id.startsWith('word_') ? (
                    <button onClick={() => handleDownloadDesignPdf(design)} disabled={downloadingPdf === design.id}
                      className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-maroon text-[11px] font-medium text-white transition-colors hover:bg-maroon-dark disabled:opacity-50">
                      {downloadingPdf === design.id ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />} Download PDF
                    </button>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => handleDownloadDesignPdf(design)} disabled={downloadingPdf === design.id}
                        className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-maroon text-[11px] font-medium text-white transition-colors hover:bg-maroon-dark disabled:opacity-50">
                        {downloadingPdf === design.id ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />} Download PDF
                      </button>
                      <button onClick={() => handleRegenerateDesign(design)} disabled={regeneratingIdx !== null}
                        className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-gray-200 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50">
                        {regeneratingIdx === design.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Regenerate
                      </button>
                    </div>
                  )}
```

- [ ] **Step 6: Branch Edit/Regenerate in the version viewer for word designs**

In the version viewer modal (lines 513-524), replace the Edit button:

```tsx
                          <button onClick={() => { setDesigns(v.designs ?? []); setViewingVersion(null); handleOpenEdit(d) }}
                            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 text-[11px] font-medium text-amber-700 transition-colors hover:bg-gold/20">
                            <Pencil size={12} /> Edit
                          </button>
```

with:

```tsx
                          <button onClick={() => { setDesigns(v.designs ?? []); setViewingVersion(null); if (d.id.startsWith('word_')) setEditingWordDesignId(d.id); else handleOpenEdit(d) }}
                            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 text-[11px] font-medium text-amber-700 transition-colors hover:bg-gold/20">
                            <Pencil size={12} /> Edit
                          </button>
```

and wrap the Regenerate button (lines 521-524) so it is hidden for word designs:

```tsx
                          {!d.id.startsWith('word_') && (
                            <button onClick={() => { setDesigns(v.designs ?? []); setViewingVersion(null); handleRegenerateDesign(d) }} disabled={regeneratingIdx !== null}
                              className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50">
                              {regeneratingIdx === d.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Regenerate
                            </button>
                          )}
```

- [ ] **Step 7: Render the WordMenuEditor modal**

After the closing of the Edit Design Modal block (after line 649, before the final `</div>` at line 650), add:

```tsx
      {/* Word Import Edit Modal */}
      {editingWordDesignId !== null && (() => {
        const design = designs.find((d) => d.id === editingWordDesignId)
        if (!design) return null
        return (
          <WordMenuEditor
            html={design.pages[0]?.html ?? ''}
            onClose={() => setEditingWordDesignId(null)}
            onSave={handleSaveWordEdit}
          />
        )
      })()}
```

- [ ] **Step 8: Verify build and lint**

Run: `npm run build` then `npm run lint` (from `frontend`).
Expected: both pass with no errors.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/menu/MenuGenerator.tsx
git commit -m "feat(menu): word file upload with single template-matched editable design"
```

---

## Task 8: End-to-end manual verification

- [ ] **Step 1: Start the backend and frontend**

Run the backend (`uvicorn app.main:app --reload --port 8000` from `backend`) and frontend (`npm run dev` from `frontend`), then open the Menu Generator for an inquiry.

- [ ] **Step 2: Upload a .docx menu**

Create a short `.docx` in Word (centered "WEDDING MENU" title, an underlined section heading like "STARTERS", a few dish lines). Select a template, click **Upload Word File**, pick the file.
Expected: exactly ONE design card appears; the template picture fills the page; the Word underlines, font sizes and centring are visible; text colour matches the template.

- [ ] **Step 3: Edit a line**

Click **Edit Items** on the word design → the line editor shows the lines with their Word formatting; change a dish name → **Save Changes** → the preview updates the text but keeps underline/size/layout.

- [ ] **Step 4: Download PDF**

Click **Download PDF**.
Expected: a single A4 PDF with the template filling the whole sheet and the edited menu centered.

- [ ] **Step 5: Save Version and reload**

Click **Save Version**, reopen **Menu History**, **View** the version → Edit still works via the word editor, Download PDF works, and no Regenerate button appears for the word design.

- [ ] **Step 6: Upload a .doc menu (if LibreOffice available)**

Save a copy of the menu as legacy `.doc` in Word, upload it.
Expected: same result as `.docx`. (Locally this needs LibreOffice installed and on PATH; in the Docker image it works out of the box.)

- [ ] **Step 7: Commit any follow-up fixes**

```bash
git add -A
git commit -m "fix(menu): polish word import flow"
```

---

## Self-Review Notes

- Spec coverage: upload control (Tasks 4, 7) · format preservation (Tasks 1-3) · template background (Task 5 `buildWordPageHtml`) · template-matched colours (Task 5 `extractTemplatePalette`) · single design (Task 7 `setDesigns([design])`) · editable lines keeping formatting (Tasks 5-7) · PDF download (existing `downloadMenuDesignPdf`, Task 7 keeps the button) · all in the Menu Generator page (Task 7).
- Type consistency: `TemplatePalette`, `WordEditableBlock`, `extractWordEditable`, `applyWordEdits`, `buildWordPageHtml`, `extractTemplatePalette` are defined in Task 5 and consumed in Tasks 6-7 with identical names/signatures. `parseWordFile` returns `{ html, file_name }` in Task 4 and is destructured as `{ html }` in Task 7.
- Frontend tests: the repo has no JS test runner (only `tsc` + `vite build`), so frontend verification is via `npm run build` / `npm run lint` plus the manual checks in Task 8.
- Backend tests need the test Postgres with seeded users, same as the existing suite.
