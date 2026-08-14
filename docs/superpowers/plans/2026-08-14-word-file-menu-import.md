# Word File Menu Import + Word Export — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a menu planner upload a `.doc`/`.docx` menu file in the Menu Generator, have Gemini fix only the spelling (content, categories and structure unchanged), see ONE editable preview on the selected template background with template-matched colours, and download a `.docx` where the template picture fills the page background and the text is beautifully formatted on top (page structure like the original Word file — 3-4 categories per page).

**Architecture:** A stateless backend endpoint (`POST /api/menu/parse-word`) extracts structured lines (`text`, `is_heading`, `page`) from the uploaded Word file via python-docx (converting `.doc` → `.docx` with LibreOffice headless). The frontend calls Gemini (`polishMenuText`, existing client-side key) for spelling only, groups lines into pages, renders a single template-background preview, and posts the final lines to `POST /api/menu/export-word`, which builds a `.docx` with python-docx (template image in the section header = full-page background; centered text; heading colour/size + dish colour).

**Tech Stack:** FastAPI (backend), python-docx + LibreOffice (word parsing/export), React 19 + TypeScript (frontend), Gemini via `frontend/src/lib/ai.ts`.

**Spec:** `docs/superpowers/specs/2026-08-14-word-file-menu-import-design.md`

---

## File Structure

- **Create** `backend/app/services/word_parser.py` — `word_to_lines(file_bytes, filename)` (extension/size validation, `.doc`→`.docx` via soffice, heading + page-break detection).
- **Create** `backend/app/services/word_export.py` — `build_menu_docx(lines, template_path, colors) -> bytes`.
- **Create** `backend/app/routers/menu_word.py` — `POST /api/menu/parse-word` + `POST /api/menu/export-word` (JWT-protected).
- **Modify** `backend/app/main.py` — register the router.
- **Modify** `backend/app/config.py` — add `TEMPLATES_DIR` setting.
- **Modify** `backend/requirements.txt` — add `python-docx==1.1.2`.
- **Modify** `backend/Dockerfile` — install `libreoffice-writer-nogui` + fonts.
- **Create** `backend/tests/test_word_parser.py` — unit tests (no DB).
- **Create** `backend/tests/test_word_export.py` — unit tests (no DB).
- **Create** `backend/tests/test_menu_word.py` — API tests (needs the test Postgres).
- **Modify** `frontend/src/lib/ai.ts` — add `polishMenuText`.
- **Modify** `frontend/src/api/inquiries.ts` — add `parseWordFile`, `downloadWordMenu`.
- **Modify** `frontend/src/types/inquiry.ts` — add `wordLines?: WordLine[]` to `MenuDesignPayload`.
- **Modify** `frontend/src/lib/menuDesign.ts` — add `TemplatePalette`, `WordLine`, `extractTemplatePalette`, `wordLinesToHtml`, `groupWordLines`, `extractWordLinesFromHtml`, `buildWordPageHtml`; add `wordLines?` to `MenuDesign`.
- **Create** `frontend/src/components/menu/WordMenuEditor.tsx` — line editor modal.
- **Modify** `frontend/src/pages/menu/MenuGenerator.tsx` — upload control, polish flow, single preview, edit, Download Word.

---

## Task 1: Backend — word parsing service (unit tests)

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/app/services/word_parser.py`
- Test: `backend/tests/test_word_parser.py`

- [ ] **Step 1: Add python-docx to requirements**

In `backend/requirements.txt`, after the `openpyxl==3.1.5` line add:

```
python-docx==1.1.2
```

- [ ] **Step 2: Write the failing unit test**

Create `backend/tests/test_word_parser.py`:

```python
import io
import zipfile

import pytest

from app.services.word_parser import word_to_lines


def build_docx(paragraphs: list[tuple[str, list[str]]]) -> bytes:
    """paragraphs: list of (pPr_xml, [run_xml, ...]). Run xml may contain
    <w:br w:type="page"/> for a page break. Includes a minimal styles.xml so
    python-docx can resolve paragraph styles."""
    body = []
    for ppr, runs in paragraphs:
        ppr_xml = f"<w:pPr>{ppr}</w:pPr>" if ppr else ""
        body.append(f"<w:p>{ppr_xml}{''.join(runs)}</w:p>")
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{''.join(body)}</w:body></w:document>"
    )
    styles_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'
        '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>'
        "</w:styles>"
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
        "</Types>"
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        "</Relationships>"
    )
    doc_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        "</Relationships>"
    )
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", rels)
        zf.writestr("word/document.xml", document_xml)
        zf.writestr("word/_rels/document.xml.rels", doc_rels)
        zf.writestr("word/styles.xml", styles_xml)
    return buf.getvalue()


def test_heading_detection():
    data = build_docx([
        ("", ['<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">STARTERS</w:t></w:r>']),
        ("", ['<w:r><w:t xml:space="preserve">Paneer Tikka</w:t></w:r>']),
        ("", ['<w:r><w:t xml:space="preserve">MAIN COURSE:</w:t></w:r>']),
        ('<w:pStyle w:val="Heading1"/>', ['<w:r><w:t xml:space="preserve">DESSERTS</w:t></w:r>']),
    ])
    lines = word_to_lines(data, "menu.docx")
    assert [l["text"] for l in lines] == ["STARTERS", "Paneer Tikka", "MAIN COURSE:", "DESSERTS"]
    assert [l["is_heading"] for l in lines] == [True, False, True, True]


def test_page_breaks_tracked():
    data = build_docx([
        ("", ['<w:r><w:t xml:space="preserve">Menu A</w:t></w:r>']),
        ("", ['<w:r><w:br w:type="page"/><w:t xml:space="preserve">DESSERTS</w:t></w:r>']),
        ("", ['<w:r><w:t xml:space="preserve">Gulab Jamun</w:t></w:r>']),
        ("", ['<w:r><w:t xml:space="preserve">Line break</w:t><w:br/><w:t xml:space="preserve">continues</w:t></w:r>']),
    ])
    lines = word_to_lines(data, "menu.docx")
    assert [l["page"] for l in lines] == [0, 1, 1, 1]
    assert lines[3]["text"] == "Line break continues"


def test_blank_paragraphs_skipped():
    data = build_docx([
        ("", ['<w:r><w:t xml:space="preserve">   </w:t></w:r>']),
        ("", ['<w:r><w:t xml:space="preserve">Paneer</w:t></w:r>']),
    ])
    lines = word_to_lines(data, "menu.docx")
    assert len(lines) == 1
    assert lines[0]["text"] == "Paneer"


def test_empty_document_raises():
    data = build_docx([])
    with pytest.raises(ValueError):
        word_to_lines(data, "menu.docx")


def test_rejects_bad_extension():
    with pytest.raises(ValueError):
        word_to_lines(b"hello", "menu.txt")


def test_rejects_oversize_file():
    with pytest.raises(ValueError):
        word_to_lines(b"x" * (10 * 1024 * 1024 + 1), "menu.docx")


def test_doc_without_soffice_raises_runtime_error(monkeypatch):
    monkeypatch.setattr("app.services.word_parser.shutil.which", lambda name: None)
    with pytest.raises(RuntimeError):
        word_to_lines(b"not a real doc", "menu.doc")
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
from docx.oxml.ns import qn

MAX_FILE_BYTES = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {".doc", ".docx"}
MAX_HEADING_TEXT_LENGTH = 40


def _run_soffice(src_path: str, out_dir: str) -> str:
    """Convert a legacy .doc file to .docx via headless LibreOffice."""
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


def _paragraph_has_page_break(para) -> bool:
    for run in para.runs:
        for br in run._element.findall(qn("w:br")):
            if br.get(qn("w:type")) == "page":
                return True
    return False


def _is_heading(para) -> bool:
    text = "".join(run.text or "" for run in para.runs).strip()
    if not text:
        return False
    style_name = (para.style.name or "").strip()
    if style_name.lower().startswith("heading"):
        return True
    if any(run.font.bold for run in para.runs):
        return True
    return len(text) <= MAX_HEADING_TEXT_LENGTH and text.upper() == text and text.endswith(":")


def word_to_lines(file_bytes: bytes, filename: str) -> list[dict]:
    """Parse a .doc/.docx into menu lines: [{text, is_heading, page}].

    Raises ValueError for bad extension / oversize / empty document, and
    RuntimeError when .doc conversion is impossible or fails."""
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
        doc = Document(target)
        lines: list[dict] = []
        page = 0
        for para in doc.paragraphs:
            if _paragraph_has_page_break(para):
                page += 1
            text = " ".join("".join(run.text or "" for run in para.runs).split())
            if not text:
                continue
            lines.append({"text": text, "is_heading": _is_heading(para), "page": page})
        if not lines:
            raise ValueError("No readable text found in the Word file")
        return lines
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `python -m pytest tests/test_word_parser.py -v` (from `backend`).
Expected: 7 passed.

- [ ] **Step 7: Commit**

```bash
git add backend/requirements.txt backend/tests/test_word_parser.py backend/app/services/word_parser.py
git commit -m "feat(menu): word parser extracting lines, headings and page breaks"
```

---

## Task 2: Backend — .docx export builder (unit tests)

**Files:**
- Create: `backend/app/services/word_export.py`
- Test: `backend/tests/test_word_export.py`

- [ ] **Step 1: Write the failing unit test**

Create `backend/tests/test_word_export.py`:

```python
import io
import os

import pytest

from docx import Document

from app.services.word_export import build_menu_docx


def _tiny_png(tmp_path) -> str:
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (4, 4), (200, 180, 120)).save(buf, format="PNG")
    path = os.path.join(str(tmp_path), "bg.png")
    with open(path, "wb") as f:
        f.write(buf.getvalue())
    return path


def test_build_menu_docx_with_background(tmp_path):
    img = _tiny_png(tmp_path)
    data = build_menu_docx(
        [
            {"text": "STARTERS", "is_heading": True, "page": 0},
            {"text": "Paneer Tikka", "is_heading": False, "page": 0},
        ],
        img,
        {"heading": "#5A0016", "item": "#8C6A1F", "desc": "#4B5563"},
    )
    doc = Document(io.BytesIO(data))
    texts = [p.text for p in doc.paragraphs]
    assert "STARTERS" in texts
    assert "Paneer Tikka" in texts
    head = next(p for p in doc.paragraphs if p.text == "STARTERS")
    assert head.runs[0].bold is True
    assert head.runs[0].font.size.pt == 16
    assert str(head.runs[0].font.color.rgb) == "5A0016"
    header = doc.sections[0].header
    assert len(header.paragraphs[0].runs) == 1
    assert "<w:drawing>" in header.paragraphs[0].runs[0]._element.xml


def test_build_menu_docx_without_background():
    data = build_menu_docx(
        [{"text": "Paneer", "is_heading": False, "page": 0}],
        None,
        {"heading": "#5A0016", "item": "#8C6A1F", "desc": "#4B5563"},
    )
    doc = Document(io.BytesIO(data))
    assert doc.paragraphs[0].text == "Paneer"
    assert len(doc.sections[0].header.paragraphs[0].runs) == 0


def test_build_menu_docx_page_breaks():
    data = build_menu_docx(
        [
            {"text": "STARTERS", "is_heading": True, "page": 0},
            {"text": "Paneer Tikka", "is_heading": False, "page": 0},
            {"text": "DESSERTS", "is_heading": True, "page": 1},
        ],
        None,
        {"heading": "#5A0016", "item": "#8C6A1F", "desc": "#4B5563"},
    )
    doc = Document(io.BytesIO(data))
    assert 'w:type="page"' in doc.element.xml


def test_build_menu_docx_bad_hex_color_falls_back():
    data = build_menu_docx(
        [{"text": "Paneer", "is_heading": True, "page": 0}],
        None,
        {"heading": "not-a-color", "item": "#8C6A1F", "desc": "#4B5563"},
    )
    doc = Document(io.BytesIO(data))
    assert str(doc.paragraphs[0].runs[0].font.color.rgb) == "5A0016"


def test_build_menu_docx_missing_template_path_ignored():
    data = build_menu_docx(
        [{"text": "Paneer", "is_heading": False, "page": 0}],
        "C:/does/not/exist/bg.png",
        {"heading": "#5A0016", "item": "#8C6A1F", "desc": "#4B5563"},
    )
    doc = Document(io.BytesIO(data))
    assert doc.paragraphs[0].text == "Paneer"


def _first_template():
    base = os.path.join(os.path.dirname(__file__), "..", "templates")
    if not os.path.isdir(base):
        return None
    for cat in sorted(os.listdir(base)):
        cat_dir = os.path.join(base, cat)
        if not os.path.isdir(cat_dir):
            continue
        files = sorted(
            f for f in os.listdir(cat_dir)
            if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".jfif"))
        )
        if files:
            return os.path.join(cat_dir, files[0])
    return None


def test_build_menu_docx_with_real_template_image():
    """Real template images (incl. EXIF-heavy .jfif and .webp) must not break
    the export — python-docx cannot parse some of them directly, so the builder
    re-encodes the image via PIL first."""
    path = _first_template()
    if not path:
        pytest.skip("No template image available for the export test")
    data = build_menu_docx(
        [{"text": "STARTERS", "is_heading": True, "page": 0}],
        path,
        {"heading": "#5A0016", "item": "#8C6A1F", "desc": "#4B5563"},
    )
    doc = Document(io.BytesIO(data))
    assert doc.paragraphs[0].text == "STARTERS"
    assert len(doc.sections[0].header.paragraphs[0].runs) == 1
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python -m pytest tests/test_word_export.py -v` (from `backend`).
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.word_export'`.

- [ ] **Step 3: Write the minimal implementation**

Create `backend/app/services/word_export.py`:

```python
import io
import os

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.shared import Mm, Pt, RGBColor

PAGE_WIDTH = Mm(210)
PAGE_HEIGHT = Mm(297)


def _hex_color(value: str | None, default: str) -> RGBColor:
    v = (value or "").strip().lstrip("#")
    if len(v) == 6:
        try:
            return RGBColor(int(v[0:2], 16), int(v[2:4], 16), int(v[4:6], 16))
        except ValueError:
            pass
    return RGBColor(int(default[1:3], 16), int(default[3:5], 16), int(default[5:7], 16))


def _load_template_image(template_path: str) -> io.BytesIO:
    """Re-encode the template to a clean PNG so python-docx can always embed
    it. python-docx cannot parse some real-world images (EXIF-heavy .jfif files
    from WhatsApp, .webp, etc.), so we normalize them through PIL first."""
    from PIL import Image

    buf = io.BytesIO()
    with Image.open(template_path) as img:
        img.convert("RGB").save(buf, format="PNG")
    buf.seek(0)
    return buf


def build_menu_docx(lines: list[dict], template_path: str | None, colors: dict) -> bytes:
    """Build a .docx: template image as full-page background (in the header,
    behind the body text) + centered menu text with template-matched colours."""
    doc = Document()
    section = doc.sections[0]
    section.page_width = PAGE_WIDTH
    section.page_height = PAGE_HEIGHT
    section.top_margin = Mm(0)
    section.bottom_margin = Mm(0)
    section.left_margin = Mm(0)
    section.right_margin = Mm(0)
    section.header_distance = Mm(0)
    section.footer_distance = Mm(0)

    normal = doc.styles["Normal"]
    normal.font.name = "Georgia"
    normal.font.size = Pt(12)

    if template_path and os.path.isfile(template_path):
        header = section.header
        header.is_linked_to_previous = False
        hpara = header.paragraphs[0]
        hpara.alignment = WD_ALIGN_PARAGRAPH.CENTER
        hpara.paragraph_format.space_before = Pt(0)
        hpara.paragraph_format.space_after = Pt(0)
        hpara.add_run().add_picture(_load_template_image(template_path), width=PAGE_WIDTH, height=PAGE_HEIGHT)

    heading_color = _hex_color(colors.get("heading"), "#5A0016")
    item_color = _hex_color(colors.get("item"), "#8C6A1F")

    last_page = 0
    for i, line in enumerate(lines):
        if i > 0 and line.get("page", 0) > last_page:
            doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
        last_page = line.get("page", 0)
        para = doc.add_paragraph()
        para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        para.paragraph_format.left_indent = Mm(18)
        para.paragraph_format.right_indent = Mm(18)
        run = para.add_run(line.get("text", ""))
        if line.get("is_heading"):
            run.bold = True
            run.font.size = Pt(16)
            run.font.color.rgb = heading_color
            para.paragraph_format.space_before = Pt(14)
            para.paragraph_format.space_after = Pt(6)
        else:
            run.font.size = Pt(12)
            run.font.color.rgb = item_color
            para.paragraph_format.space_after = Pt(4)

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python -m pytest tests/test_word_export.py -v` (from `backend`).
Expected: 6 passed. (Includes the real-template regression test — `python-docx` cannot parse EXIF-heavy `.jfif`/`.webp` images directly, so `build_menu_docx` re-encodes the template to PNG via PIL.)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/word_export.py backend/tests/test_word_export.py
git commit -m "feat(menu): docx export builder with template background"
```

---

## Task 3: Backend — parse-word + export-word endpoints (API tests)

**Files:**
- Create: `backend/app/routers/menu_word.py`
- Modify: `backend/app/config.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_menu_word.py`

- [ ] **Step 1: Write the failing API test**

Create `backend/tests/test_menu_word.py`:

```python
import io
import os
import zipfile

import pytest

from docx import Document


def build_docx(paragraphs: list[tuple[str, list[str]]]) -> bytes:
    body = []
    for ppr, runs in paragraphs:
        ppr_xml = f"<w:pPr>{ppr}</w:pPr>" if ppr else ""
        body.append(f"<w:p>{ppr_xml}{''.join(runs)}</w:p>")
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{''.join(body)}</w:body></w:document>"
    )
    styles_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'
        "<w:style w:type=\"paragraph\" w:styleId=\"Heading1\"><w:name w:val=\"heading 1\"/></w:style>"
        "</w:styles>"
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
        "</Types>"
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        "</Relationships>"
    )
    doc_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        "</Relationships>"
    )
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", rels)
        zf.writestr("word/document.xml", document_xml)
        zf.writestr("word/_rels/document.xml.rels", doc_rels)
        zf.writestr("word/styles.xml", styles_xml)
    return buf.getvalue()


def _first_template():
    base = os.path.join(os.path.dirname(__file__), "..", "templates")
    if not os.path.isdir(base):
        return None, None
    for cat in sorted(os.listdir(base)):
        cat_dir = os.path.join(base, cat)
        if not os.path.isdir(cat_dir):
            continue
        files = sorted(
            f for f in os.listdir(cat_dir)
            if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".jfif"))
        )
        if files:
            return cat, files[0]
    return None, None


async def login(client, username, password):
    resp = await client.post("/api/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, f"Login failed: {resp.status_code} {resp.text}"
    return resp.json()["access_token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


async def test_parse_word_docx_returns_lines(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    docx = build_docx([
        ("", ['<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">STARTERS</w:t></w:r>']),
        ("", ['<w:r><w:t xml:space="preserve">Paneer Tikka</w:t></w:r>']),
    ])
    resp = await client.post(
        "/api/menu/parse-word",
        headers=auth(token),
        files={"file": ("menu.docx", docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["file_name"] == "menu.docx"
    assert data["lines"] == [
        {"text": "STARTERS", "is_heading": True, "page": 0},
        {"text": "Paneer Tikka", "is_heading": False, "page": 0},
    ]


async def test_parse_word_rejects_unsupported_file(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    resp = await client.post("/api/menu/parse-word", headers=auth(token), files={"file": ("menu.txt", b"hello", "text/plain")})
    assert resp.status_code == 400


async def test_parse_word_requires_auth(client):
    resp = await client.post("/api/menu/parse-word", files={"file": ("menu.docx", b"x", "application/octet-stream")})
    assert resp.status_code in (401, 403)


async def test_export_word_returns_docx(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    cat, file = _first_template()
    if not file:
        pytest.skip("No template image available for the export test")
    resp = await client.post("/api/menu/export-word", headers=auth(token), json={
        "lines": [
            {"text": "STARTERS", "is_heading": True, "page": 0},
            {"text": "Paneer Tikka", "is_heading": False, "page": 0},
        ],
        "template_category": cat,
        "template_file": file,
        "colors": {"heading": "#5A0016", "item": "#8C6A1F", "desc": "#4B5563"},
    })
    assert resp.status_code == 200, resp.text
    assert "vnd.openxmlformats-officedocument.wordprocessingml" in resp.headers["content-type"]
    doc = Document(io.BytesIO(resp.content))
    texts = [p.text for p in doc.paragraphs]
    assert "STARTERS" in texts
    assert "Paneer Tikka" in texts
    head = next(p for p in doc.paragraphs if p.text == "STARTERS")
    assert head.runs[0].bold is True
    assert len(doc.sections[0].header.paragraphs[0].runs) == 1


async def test_export_word_empty_lines_rejected(client):
    token = await login(client, "admin@shaguncatering.com", "admin123")
    resp = await client.post("/api/menu/export-word", headers=auth(token), json={
        "lines": [],
        "template_category": "Wedding",
        "template_file": "x.jpg",
        "colors": {"heading": "#5A0016", "item": "#8C6A1F", "desc": "#4B5563"},
    })
    assert resp.status_code == 400
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python -m pytest tests/test_menu_word.py -v` (from `backend`).
Expected: FAIL with `404 Not Found` for `/api/menu/parse-word` (router not registered). Requires the test Postgres with seeded users to be up, as with the existing suite.

- [ ] **Step 3: Add the TEMPLATES_DIR setting**

In `backend/app/config.py`, after the `UPLOAD_DIR: str = "/app/uploads"` line (line 15), add:

```python
    TEMPLATES_DIR: str = "/app/templates"
```

- [ ] **Step 4: Implement the endpoints**

Create `backend/app/routers/menu_word.py`:

```python
import io
import os

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.config import settings
from app.middleware.auth import get_current_user
from app.models.user import User
from app.services.word_export import build_menu_docx
from app.services.word_parser import word_to_lines

router = APIRouter(prefix="/api/menu", tags=["menu-word"])

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


class WordLine(BaseModel):
    text: str
    is_heading: bool = False
    page: int = 0


class WordColors(BaseModel):
    heading: str = "#5A0016"
    item: str = "#8C6A1F"
    desc: str = "#4B5563"


class WordExportRequest(BaseModel):
    lines: list[WordLine]
    template_category: str
    template_file: str
    colors: WordColors = Field(default_factory=WordColors)


def _template_path(category: str, file: str) -> str:
    base = settings.TEMPLATES_DIR
    if not os.path.isdir(base):
        base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "templates"))
    base = os.path.abspath(base)
    candidate = os.path.abspath(os.path.join(base, category, os.path.basename(file)))
    if not candidate.startswith(base + os.sep) or not os.path.isfile(candidate):
        raise HTTPException(status_code=400, detail="Template file not found")
    return candidate


@router.post("/parse-word")
async def parse_word(file: UploadFile = File(...), _: User = Depends(get_current_user)):
    content = await file.read()
    try:
        lines = word_to_lines(content, file.filename or "")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"file_name": file.filename or "", "lines": lines}


@router.post("/export-word")
async def export_word(req: WordExportRequest, _: User = Depends(get_current_user)):
    if not req.lines:
        raise HTTPException(status_code=400, detail="No menu content to export")
    template_path = _template_path(req.template_category, req.template_file)
    try:
        data = build_menu_docx(
            [line.model_dump() for line in req.lines],
            template_path,
            req.colors.model_dump(),
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to build Word file: {e}")
    headers = {"Content-Disposition": 'attachment; filename="menu.docx"'}
    return StreamingResponse(io.BytesIO(data), media_type=DOCX_MIME, headers=headers)
```

- [ ] **Step 5: Register the router**

In `backend/app/main.py`, add the import after the other router imports (after line 14, the `events_router` import):

```python
from app.routers.menu_word import router as menu_word_router
```

and register it after `app.include_router(events_router)` (line 29):

```python
app.include_router(menu_word_router)
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `python -m pytest tests/test_menu_word.py -v` (from `backend`).
Expected: 5 passed.

- [ ] **Step 7: Run the full backend test suite**

Run: `python -m pytest -v` (from `backend`).
Expected: all existing tests still pass.

- [ ] **Step 8: Commit**

```bash
git add backend/app/routers/menu_word.py backend/app/config.py backend/app/main.py backend/tests/test_menu_word.py
git commit -m "feat(menu): parse-word and export-word endpoints"
```

---

## Task 4: Backend — LibreOffice in the Docker image

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

## Task 5: Frontend — menuDesign.ts word-import helpers

**Files:**
- Modify: `frontend/src/lib/menuDesign.ts`

- [ ] **Step 1: Add `wordLines` to the `MenuDesign` interface**

In `frontend/src/lib/menuDesign.ts`, after `paletteIndex?: number` (line 14), add:

```ts
  wordLines?: WordLine[]
```

- [ ] **Step 2: Add the helper exports at the end of the file**

Append the following at the end of `frontend/src/lib/menuDesign.ts` (after `downloadMenuDesignPdf`):

```ts
export interface TemplatePalette {
  heading: string
  item: string
  desc: string
}

export interface WordLine {
  text: string
  is_heading: boolean
  page: number
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

const escWord = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Converts parsed Word lines into simple HTML: one <p> per line, headings get
// the .word-heading class so the preview and edit styling can target them.
export function wordLinesToHtml(lines: WordLine[]): string {
  return lines
    .map((l) => (l.is_heading ? `<p class="word-heading">${escWord(l.text)}</p>` : `<p>${escWord(l.text)}</p>`))
    .join('\n')
}

// If the Word file had explicit page breaks, keep them; otherwise group so
// each page holds up to `categoriesPerPage` heading sections.
export function groupWordLines(lines: WordLine[], categoriesPerPage = 4): WordLine[] {
  if (lines.some((l) => l.page > 0)) return lines
  const out: WordLine[] = []
  let page = 0
  let sectionsOnPage = 0
  for (const l of lines) {
    if (l.is_heading) {
      if (sectionsOnPage >= categoriesPerPage) {
        page += 1
        sectionsOnPage = 0
      }
      sectionsOnPage += 1
    }
    out.push({ ...l, page })
  }
  return out
}

// Rebuilds lines from the HTML stored in a design's `raw` (used when a word
// design was loaded from a saved version and has no wordLines attached).
export function extractWordLinesFromHtml(html: string): WordLine[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return Array.from(doc.body.querySelectorAll('p'))
    .map((p) => ({
      text: (p.textContent ?? '').trim(),
      is_heading: p.classList.contains('word-heading'),
      page: 0,
    }))
    .filter((l) => l.text.length > 0)
}

// Wraps word-imported HTML on a template background with template-matched text
// colours. Used only for the on-screen single-page preview.
export function buildWordPageHtml(contentHtml: string, templateUrl: string, palette: TemplatePalette): string {
  const style = `<style>
    .word-menu-card {
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 40px;
      background-image: url('${templateUrl}');
      background-size: cover; background-position: center; background-repeat: no-repeat;
    }
    .word-menu-inner { width: 100%; text-align: center; }
    .word-menu-inner p { color: ${palette.item}; margin: 0.3em 0; font-size: 13px; }
    .word-menu-inner p.word-heading {
      color: ${palette.heading}; font-weight: bold; font-size: 18px;
      text-transform: uppercase; letter-spacing: 0.06em;
      margin: 0.7em 0 0.3em;
    }
  </style>`
  return `${style}<div class="word-menu-card"><div class="word-menu-inner">${contentHtml}</div></div>`
}
```

- [ ] **Step 3: Verify the build**

Run: `npm run build` (from `frontend`).
Expected: TypeScript compiles and the build succeeds. (`WordLine` is now exported in this task, so Task 6's `import type` resolves.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/menuDesign.ts
git commit -m "feat(menu): word-import helpers - palette, lines, grouping, template page"
```

---

## Task 6: Frontend — polishMenuText + API functions

**Files:**
- Modify: `frontend/src/lib/ai.ts`
- Modify: `frontend/src/api/inquiries.ts`
- Modify: `frontend/src/types/inquiry.ts`

- [ ] **Step 1: Add `polishMenuText` to ai.ts**

In `frontend/src/lib/ai.ts`, at the end of the file (after `buildMenuDesignPrompt`), add:

```ts
// ── AI Spelling Polish ──

// Fixes only spelling in a menu text; keeps categories, dish names' meaning,
// order and line structure unchanged.
export async function polishMenuText(text: string): Promise<AIResponse> {
  const prompt = `You are proofreading a catering menu. Fix ONLY spelling and obvious typos in the text below.
Rules:
- Do NOT change the categories, the dish names' meaning, the order of lines, or the number of lines.
- Do NOT add or remove lines, do NOT rephrase, do NOT restructure.
- Change only misspelled or mistyped words.
- Return ONLY the corrected text, keeping the exact same line breaks as the input. No extra commentary.

MENU TEXT:
${text}`
  return callGemini(prompt)
}
```

- [ ] **Step 2: Add `WordLine` to types/inquiry.ts**

In `frontend/src/types/inquiry.ts`, add an import at the top of the file (line 1) and re-export it so `api/inquiries.ts` can import `WordLine` from `@/types/inquiry`:

```ts
import type { WordLine } from '@/lib/menuDesign'

export type { WordLine }
```

and add `wordLines` to `MenuDesignPayload` (after `paletteIndex?: number`, line 81):

```ts
  wordLines?: WordLine[]
```

- [ ] **Step 3: Add `parseWordFile` and `downloadWordMenu` to inquiries.ts**

In `frontend/src/api/inquiries.ts`, add `WordLine` to the import from `@/types/inquiry` (line 3):

```ts
import type { Inquiry, InquiryCreate, FollowUp, Meeting, MenuVersion, MenuSlot, WordLine } from '@/types/inquiry'
```

then at the end of the file (after `downloadMenuSlotFile`), add:

```ts
export async function parseWordFile(file: File): Promise<{ file_name: string; lines: WordLine[] }> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await client.post('/menu/parse-word', formData)
  return response.data
}

export async function downloadWordMenu(payload: {
  lines: WordLine[]
  template_category: string
  template_file: string
  colors: { heading: string; item: string; desc: string }
}): Promise<void> {
  const response = await client.post('/menu/export-word', payload, { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'menu.docx')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}
```

- [ ] **Step 4: Verify the build**

Run: `npm run build` (from `frontend`).
Expected: TypeScript compiles and the build succeeds. (`WordLine` was exported by `menuDesign.ts` in Task 5, so the `import type` resolves.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/ai.ts frontend/src/api/inquiries.ts frontend/src/types/inquiry.ts
git commit -m "feat(menu): polishMenuText and word parse/export api clients"
```

---

## Task 7: Frontend — WordMenuEditor component

**Files:**
- Create: `frontend/src/components/menu/WordMenuEditor.tsx`

- [ ] **Step 1: Write the component**

Create `frontend/src/components/menu/WordMenuEditor.tsx`:

```tsx
import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Save } from 'lucide-react'
import type { WordLine } from '@/lib/menuDesign'

export default function WordMenuEditor({ lines, onClose, onSave }: {
  lines: WordLine[]
  onClose: () => void
  onSave: (lines: WordLine[]) => void
}) {
  const [draft, setDraft] = useState<WordLine[]>(lines.map((l) => ({ ...l })))

  const update = (index: number, text: string) => {
    setDraft((prev) => prev.map((l, i) => (i === index ? { ...l, text } : l)))
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
            <p className="text-[11px] text-gray-400">Text edits only — categories and layout from the Word file are kept.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto bg-gray-50 p-5">
          {draft.map((l, i) => (
            <input
              key={i}
              value={l.text}
              onChange={(e) => update(i, e.target.value)}
              className={`w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gold/30 ${l.is_heading ? 'font-bold uppercase' : ''}`}
            />
          ))}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button onClick={onClose}
            className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={() => onSave(draft)}
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

## Task 8: Frontend — Menu Generator upload, polish, single design, edit, download

**Files:**
- Modify: `frontend/src/pages/menu/MenuGenerator.tsx`

- [ ] **Step 1: Update imports**

In `frontend/src/pages/menu/MenuGenerator.tsx`:

1. Line 5 — add `polishMenuText` to the `@/lib/ai` import:

```tsx
import { generateMenuDesign, loadImageAsDataUrl, polishMenuText } from '@/lib/ai'
```

2. Line 6 — add the new helpers to the `@/lib/menuDesign` import:

```tsx
import { parseMenuDesigns, downloadMenuDesignPdf, extractMenuEditable, applyMenuEdits, detectPageFonts, detectPageColors, scopeMenuHtml, sanitizeMenuHtml, buildWordPageHtml, extractTemplatePalette, groupWordLines, wordLinesToHtml, extractWordLinesFromHtml, FONT_OPTIONS, type MenuDesign, type MenuEditablePage, type MenuFonts, type MenuColors, type TemplatePalette, type WordLine } from '@/lib/menuDesign'
```

3. Line 8 — add `parseWordFile` and `downloadWordMenu` to the `@/api/inquiries` import:

```tsx
import { getMenuVersions, createMenuVersion, parseWordFile, downloadWordMenu } from '@/api/inquiries'
```

4. Line 12 — add `Upload` to the lucide-react import:

```tsx
import { ArrowLeft, Sparkles, RotateCcw, Loader2, Phone, Calendar, DollarSign, MessageSquare, FileText, User, Users, Layout, Palette, FileDown, Save, History, Eye, ChevronDown, ChevronUp, X, Pencil, Plus, Trash2, Upload } from 'lucide-react'
```

5. After the `INQUIRY_STATUSES, PAYMENT_STATUSES` import (line 14), add:

```tsx
import { getErrorMessage } from '@/lib/apiError'
import WordMenuEditor from '@/components/menu/WordMenuEditor'
```

- [ ] **Step 2: Add state**

In the "AI Menu Designer" state block (after line 43 `editColors`), add:

```tsx
const [wordLines, setWordLines] = useState<WordLine[]>([])
const [wordPalette, setWordPalette] = useState<TemplatePalette | null>(null)
const [uploadingWord, setUploadingWord] = useState(false)
const [downloadingWord, setDownloadingWord] = useState(false)
const [editingWordDesignId, setEditingWordDesignId] = useState<string | null>(null)
```

- [ ] **Step 3: Add the upload, save-word-edit and download handlers**

After `handleLoadVersion` (after line 223), add:

```tsx
const isHeadingText = (t: string) => t.length <= 40 && (t === t.toUpperCase() || t.endsWith(':'))

const handleWordUpload = async (file?: File) => {
  if (!file) return
  if (!selectedCat || !selectedFile) {
    toast.error('Select a template first')
    return
  }
  setUploadingWord(true)
  try {
    const { lines } = await parseWordFile(file)
    const res = await polishMenuText(lines.map((l) => l.text).join('\n'))
    if (res.error) {
      toast.error('AI error: ' + res.error)
      return
    }
    const polished = (res.text || '').split('\n').map((t) => t.trim()).filter((t) => t.length > 0)
    const merged: WordLine[] = polished.length === lines.length
      ? lines.map((l, i) => ({ ...l, text: polished[i] }))
      : polished.map((t) => ({ text: t, is_heading: isHeadingText(t), page: 0 }))
    const grouped = groupWordLines(merged)
    setWordLines(grouped)
    const cleaned = sanitizeMenuHtml(wordLinesToHtml(grouped))
    const templateUrl = getTemplateUrl(selectedCat, selectedFile)
    const palette = await extractTemplatePalette(templateUrl)
    setWordPalette(palette)
    const design: MenuDesign = {
      id: `word_${Date.now()}`,
      name: 'Word Menu',
      pages: [{ html: buildWordPageHtml(cleaned, templateUrl, palette), index: 0 }],
      raw: cleaned,
      wordLines: grouped,
    }
    setDesigns([design])
    setDesignMenuText(grouped.map((l) => l.text).join('\n'))
    toast.success('Word menu imported — check the preview, edit if needed, then Download Word')
  } catch (err) {
    toast.error(getErrorMessage(err, 'Word file import failed'))
  } finally {
    setUploadingWord(false)
  }
}

const handleSaveWordEdit = (newLines: WordLine[]) => {
  setWordLines(newLines)
  setDesigns((prev) => prev.map((d) => {
    if (d.id !== editingWordDesignId) return d
    const cleaned = sanitizeMenuHtml(wordLinesToHtml(newLines))
    const templateUrl = getTemplateUrl(selectedCat, selectedFile)
    const palette = wordPalette ?? { heading: '#5A0016', item: '#8C6A1F', desc: '#4B5563' }
    return { ...d, pages: [{ ...d.pages[0], html: buildWordPageHtml(cleaned, templateUrl, palette) }], raw: cleaned, wordLines: newLines }
  }))
  setEditingWordDesignId(null)
  toast.success('Design updated. Click "Save Version" to keep it.')
}

const handleDownloadWord = async (design: MenuDesign) => {
  if (!selectedCat || !selectedFile) {
    toast.error('Select a template first')
    return
  }
  setDownloadingWord(true)
  try {
    await downloadWordMenu({
      lines: design.wordLines ?? extractWordLinesFromHtml(design.raw),
      template_category: selectedCat,
      template_file: selectedFile,
      colors: wordPalette ?? { heading: '#5A0016', item: '#8C6A1F', desc: '#4B5563' },
    })
    toast.success('Word file downloaded')
  } catch (err) {
    toast.error(getErrorMessage(err, 'Word export failed'))
  } finally {
    setDownloadingWord(false)
  }
}
```

Note: `getTemplateUrl` is already imported in this file (line 7); `sanitizeMenuHtml` is added in Step 1's `@/lib/menuDesign` import.

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

- [ ] **Step 5: Branch Edit and Download for word designs in the design card**

In the designs grid card, replace the action block (lines 456-471):

```tsx
                <div className="p-3">
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
                </div>
```

with:

```tsx
                <div className="p-3">
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
                    <button onClick={() => handleDownloadWord(design)} disabled={downloadingWord}
                      className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-maroon text-[11px] font-medium text-white transition-colors hover:bg-maroon-dark disabled:opacity-50">
                      {downloadingWord ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />} Download Word
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
                </div>
```

- [ ] **Step 6: Branch Edit / Download / hide Regenerate in the version viewer**

In the version viewer modal, replace the three action buttons (lines 513-524):

```tsx
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
```

with:

```tsx
                          <button onClick={() => { setDesigns(v.designs ?? []); setViewingVersion(null); if (d.id.startsWith('word_')) setEditingWordDesignId(d.id); else handleOpenEdit(d) }}
                            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 text-[11px] font-medium text-amber-700 transition-colors hover:bg-gold/20">
                            <Pencil size={12} /> Edit
                          </button>
                          <button onClick={() => d.id.startsWith('word_') ? handleDownloadWord(d) : handleDownloadDesignPdf(d)} disabled={downloadingWord || downloadingPdf === d.id}
                            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-maroon text-[11px] font-medium text-white transition-colors hover:bg-maroon-dark disabled:opacity-50">
                            {downloadingWord || downloadingPdf === d.id ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />} {d.id.startsWith('word_') ? 'Word' : 'PDF'}
                          </button>
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
            lines={design.wordLines ?? extractWordLinesFromHtml(design.raw)}
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
git commit -m "feat(menu): word file upload with gemini polish, single preview and word export"
```

- **Task 8 execution notes:** The plan's `wordLines` state was **removed** — nothing reads it (the lines live on the design object via `design.wordLines`, with `extractWordLinesFromHtml` as the fallback), so `tsc -b` failed with `TS6133: 'wordLines' is declared but its value is never read`. All four remaining states (`wordPalette`, `uploadingWord`, `downloadingWord`, `editingWordDesignId`) are used. Build (`npm run build`) and lint (`npm run lint`) both pass; the 5 oxlint warnings are pre-existing (`useAuth.ts`, etc.).

---

## Task 9: End-to-end manual verification

- [ ] **Step 1: Start the backend and frontend**

Run the backend (`uvicorn app.main:app --reload --port 8000` from `backend`) and frontend (`npm run dev` from `frontend`), then open the Menu Generator for an inquiry and select a template.

- [ ] **Step 2: Upload a .docx menu**

Create a short `.docx` in Word (e.g. bold "STARTERS", "Paneer Tikka", "Hara Bhara Kebab", then bold "MAIN COURSE:", "Dal Makhani", "Shahi Paneer"). Click **Upload Word File**, pick the file.
Expected: exactly ONE design card appears; the template picture fills the page; the text keeps its category structure; the spelling-polish has been applied; text colour matches the template.

- [ ] **Step 3: Edit a line**

Click **Edit Items** on the word design → the line editor shows the lines (headings shown bold/uppercase); change a dish name → **Save Changes** → the preview updates the text but keeps headings and layout.

- [ ] **Step 4: Download Word**

Click **Download Word**.
Expected: a `.docx` file downloads; opening it in Word shows the template picture filling every page as background with the centered menu text on top, headings bold and coloured.

- [ ] **Step 5: Save Version and reload**

Click **Save Version**, reopen **Menu History**, **View** the version → Edit still opens the word editor, the download button says Word, and no Regenerate button appears for the word design.

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
- Spec coverage: upload + parse (Tasks 1, 3, 5, 8) · spelling-only polish (Task 6 `polishMenuText`, Task 8 merge rule) · template background in Word (Tasks 2, 3 header image) · template-matched colours (Tasks 2, 5 `extractTemplatePalette`) · page structure like the Word file / 3-4 categories per page (Task 1 page breaks + Task 5 `groupWordLines`) · single editable preview (Tasks 7, 8) · Word-only output (Task 8 replaces the PDF button for word designs) · errors (Tasks 1, 3 mappings + Task 8 toasts).

- Type consistency: `WordLine` is defined in `menuDesign.ts` (Task 5) and type-imported by `types/inquiry.ts` (Task 6), `api/inquiries.ts` (Task 6), `WordMenuEditor.tsx` (Task 7) and `MenuGenerator.tsx` (Task 8) with the same `{ text, is_heading, page }` shape. `TemplatePalette` (Task 5) matches the `colors` payload shape in `downloadWordMenu` (Task 6). `wordLines?: WordLine[]` added to both `MenuDesign` (Task 5) and `MenuDesignPayload` (Task 6) so version-loaded word designs keep their lines.
- Frontend tests: the repo has no JS test runner (only `tsc` + `vite build`), so frontend verification is via `npm run build` / `npm run lint` plus the manual checks in Task 9.
- Backend tests need the test Postgres with seeded users (admin@shaguncatering.com / admin123), same as the existing suite. Tasks 1-2 are DB-free.
- The export test (`_first_template`) uses a real template file from `backend/templates` so the header-image code path is covered; it skips if no image exists. During execution this found that `python-docx` cannot parse some real templates (EXIF-heavy `.jfif`, `.webp`), so `build_menu_docx` re-encodes the template to PNG via PIL (`_load_template_image`) before embedding it.
