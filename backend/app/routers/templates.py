import os
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/templates", tags=["templates"])

TEMPLATES_DIR = "/app/templates"

@router.get("")
async def list_template_categories():
    if not os.path.isdir(TEMPLATES_DIR):
        return []
    categories = []
    for entry in sorted(os.listdir(TEMPLATES_DIR)):
        full = os.path.join(TEMPLATES_DIR, entry)
        if os.path.isdir(full):
            files = sorted([
                f for f in os.listdir(full)
                if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".jfif"))
            ])
            categories.append({
                "name": entry,
                "files": files,
                "count": len(files),
            })
    return categories
