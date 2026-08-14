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
