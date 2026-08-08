import os
import io
from fastapi import APIRouter
from fastapi.responses import JSONResponse, FileResponse

router = APIRouter(prefix="/api/templates", tags=["templates"])

TEMPLATES_DIR = "/app/templates"
THUMB_CACHE_DIR = "/tmp/template-thumbs"

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


@router.get("/thumb/{category}/{file:path}")
async def serve_template_thumbnail(category: str, file: str):
    """Serve a small (~320px) JPEG thumbnail of a template for the selection grid.
    Generated once, cached to disk, and served with immutable cache headers."""
    src = os.path.join(TEMPLATES_DIR, category, file)
    if not os.path.isfile(src):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="File not found")
    try:
        from PIL import Image
    except ImportError:
        # Pillow unavailable: fall back to the full-size image
        return FileResponse(src, headers={"Cache-Control": "public, max-age=86400"})

    cache_key = os.path.join(THUMB_CACHE_DIR, category, file.rsplit(".", 1)[0] + ".jpg")
    if not os.path.isfile(cache_key):
        os.makedirs(os.path.dirname(cache_key), exist_ok=True)
        img = Image.open(src)
        img.thumbnail((320, 320))
        if img.mode in ("RGBA", "P", "LA"):
            img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=78)
        with open(cache_key, "wb") as f:
            f.write(buf.getvalue())
    return FileResponse(cache_key, media_type="image/jpeg",
                        headers={"Cache-Control": "public, max-age=31536000, immutable"})
