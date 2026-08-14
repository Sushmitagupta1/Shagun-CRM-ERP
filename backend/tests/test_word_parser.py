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
