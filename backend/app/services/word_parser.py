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
