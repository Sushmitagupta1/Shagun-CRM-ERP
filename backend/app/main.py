from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.inquiries import router as inquiries_router
from app.routers.settlements import router as settlements_router
from app.routers.dashboard import router as dashboard_router
from app.routers.notifications import router as notifications_router
from app.routers.menu import router as menu_router
from app.routers.templates import router as templates_router

app = FastAPI(title="Shagun Catering ERP API", version="1.0.0", docs_url="/api/docs", redoc_url="/api/redoc")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(inquiries_router)
app.include_router(settlements_router)
app.include_router(dashboard_router)
app.include_router(notifications_router)
app.include_router(menu_router)
app.include_router(templates_router)

from fastapi.responses import FileResponse
import os
import mimetypes

mimetypes.add_type("image/jpeg", ".jfif")
mimetypes.add_type("image/webp", ".webp")

@app.get("/api/templates/static/{category}/{file:path}")
async def serve_template(category: str, file: str):
    file_path = os.path.join("/app/templates", category, file)
    if not os.path.isfile(file_path):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="File not found")
    media_type, _ = mimetypes.guess_type(file_path)
    return FileResponse(file_path, media_type=media_type, headers={"Cache-Control": "no-store, no-cache, must-revalidate"})


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "shagun-erp"}


@app.get("/health")
async def health_check_bare():
    return {"status": "ok", "service": "shagun-erp"}
