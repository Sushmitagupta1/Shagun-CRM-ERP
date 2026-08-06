# File Upload for Menu & Presentation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fake local-state "uploads" with real file upload from device storage for Menu and Presentation sections in InquiryDetail.

**Architecture:** Files stored on server in `/app/uploads/{inquiry_id}/{type}/` with Docker volume mount for persistence. New columns on Inquiry model track original filename and server path. Upload via `multipart/form-data` endpoint, download via dedicated file-serve endpoint.

**Tech Stack:** FastAPI (Python 3.12), SQLAlchemy async, Alembic, React 19, Axios, Docker

---

## File Structure

**Backend files to modify:**
- `backend/app/config.py` — add UPLOAD_DIR, MAX_UPLOAD_SIZE, ALLOWED_EXTENSIONS
- `backend/app/models/inquiry.py` — add 4 file columns
- `backend/app/schemas/inquiry.py` — add file_name fields to InquiryResponse
- `backend/app/routers/inquiries.py` — add upload + download endpoints
- `backend/alembic/versions/9013_add_file_upload_columns.py` — new migration
- `docker-compose.yml` — add uploads volume mount

**Frontend files to modify:**
- `frontend/src/types/inquiry.ts` — add `menu_file_name`, `presentation_file_name`
- `frontend/src/api/inquiries.ts` — add `uploadInquiryFile` function
- `frontend/src/pages/inquiries/InquiryDetail.tsx` — replace fake upload with real file upload + download

---

### Task 1: Backend Config + Model + Schema + Migration

**Files:**
- Modify: `backend/app/config.py`
- Modify: `backend/app/models/inquiry.py`
- Modify: `backend/app/schemas/inquiry.py`
- Create: `backend/alembic/versions/9013_add_file_upload_columns.py`

- [ ] **Step 1: Add upload settings to config**

Edit `backend/app/config.py`. Add after `ENVIRONMENT`:

```python
    UPLOAD_DIR: str = "/app/uploads"
    MAX_UPLOAD_SIZE: int = 20 * 1024 * 1024  # 20 MB
    ALLOWED_EXTENSIONS: list[str] = [
        ".pdf", ".docx", ".xlsx", ".pptx", ".ppt",
        ".jpg", ".jpeg", ".png", ".webp", ".txt", ".csv",
    ]
```

- [ ] **Step 2: Add file columns to Inquiry model**

Edit `backend/app/models/inquiry.py`. Add after `menu_content` (line 49):

```python
    menu_file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    menu_file_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    presentation_file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    presentation_file_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
```

- [ ] **Step 3: Add file_name fields to InquiryResponse schema**

Edit `backend/app/schemas/inquiry.py`. Add after `menu_content` (line 65):

```python
    menu_file_name: str | None = None
    presentation_file_name: str | None = None
```

- [ ] **Step 4: Create migration**

Create `backend/alembic/versions/9013_add_file_upload_columns.py`:

```python
"""add file upload columns

Revision ID: 9013
Revises: 9012
Create Date: 2026-07-30 14:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "9013"
down_revision: Union[str, None] = "9012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("inquiries", sa.Column("menu_file_name", sa.String(255), nullable=True))
    op.add_column("inquiries", sa.Column("menu_file_path", sa.String(512), nullable=True))
    op.add_column("inquiries", sa.Column("presentation_file_name", sa.String(255), nullable=True))
    op.add_column("inquiries", sa.Column("presentation_file_path", sa.String(512), nullable=True))


def downgrade() -> None:
    op.drop_column("inquiries", "presentation_file_path")
    op.drop_column("inquiries", "presentation_file_name")
    op.drop_column("inquiries", "menu_file_path")
    op.drop_column("inquiries", "menu_file_name")
```

Verify migration links correctly. Run:

```bash
docker exec shaguncrm-backend-1 alembic upgrade head
```

Expected output: "INFO  [alembic.runtime.migration] Running upgrade 9012 -> 9013, add file upload columns"

---

### Task 2: Backend Upload & Download Endpoints

**Files:**
- Modify: `backend/app/routers/inquiries.py`

- [ ] **Step 1: Add imports at top of file**

Edit `backend/app/routers/inquiries.py`. Add after the existing imports (line 14):

```python
import os
from fastapi import UploadFile, File
from app.config import settings
```

- [ ] **Step 2: Add upload endpoint**

Add after `download_menu` function (after line 172):

```python
ALLOWED_ROLES = {
    "menu": {"admin", "menu_planner"},
    "presentation": {"admin", "presentation_exec"},
}

@router.post("/{inquiry_id}/upload")
async def upload_inquiry_file(
    inquiry_id: uuid.UUID,
    file_type: str = Query(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file_type not in ("menu", "presentation"):
        raise HTTPException(status_code=400, detail="file_type must be 'menu' or 'presentation'")
    if current_user.role.name not in ALLOWED_ROLES[file_type]:
        raise HTTPException(status_code=403, detail="Not authorized")
    inquiry = await get_inquiry_or_404(db, inquiry_id)

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type '{ext}' not allowed")
    import shutil
    content = await file.read()
    if len(content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 20MB)")

    upload_dir = os.path.join(settings.UPLOAD_DIR, str(inquiry_id), file_type)
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, file.filename or "unnamed")
    with open(file_path, "wb") as f:
        f.write(content)

    setattr(inquiry, f"{file_type}_file_name", file.filename)
    setattr(inquiry, f"{file_type}_file_path", file_path)
    await db.commit()
    await db.refresh(inquiry)

    return {"file_name": file.filename, "file_path": file_path}
```

- [ ] **Step 3: Add file download endpoint**

Add after the upload endpoint:

```python
@router.get("/{inquiry_id}/file/{file_type}")
async def download_inquiry_file(
    inquiry_id: uuid.UUID,
    file_type: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file_type not in ("menu", "presentation"):
        raise HTTPException(status_code=400, detail="file_type must be 'menu' or 'presentation'")
    inquiry = await get_inquiry_or_404(db, inquiry_id)
    file_path = getattr(inquiry, f"{file_type}_file_path", None)
    file_name = getattr(inquiry, f"{file_type}_file_name", None)
    if not file_path or not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="No file uploaded")
    from fastapi.responses import FileResponse
    return FileResponse(
        path=file_path,
        filename=file_name,
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
    )
```

- [ ] **Step 4: Run migration**

```bash
docker exec shaguncrm-backend-1 alembic upgrade head
```

Expected: migration succeeds.

- [ ] **Step 5: Restart backend**

```bash
docker restart shaguncrm-backend-1
```

- [ ] **Step 6: Verify endpoints work**

```bash
# Test upload
echo "test menu content" > C:\Users\Janak\AppData\Local\Temp\opencode\test_menu.pdf
# Get a real inquiry ID first
$inquiryId = (curl.exe -s http://localhost/api/inquiries?per_page=1 | python -c "import sys,json; print(json.load(sys.stdin)['items'][0]['id'])")
# Test upload
curl.exe -s -X POST "http://localhost/api/inquiries/$inquiryId/upload?file_type=menu" -F "file=@C:\Users\Janak\AppData\Local\Temp\opencode\test_menu.pdf"
# Test download
curl.exe -s -I "http://localhost/api/inquiries/$inquiryId/file/menu"
```

---

### Task 3: Docker Compose Volume Mount

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add uploads volume to backend service**

Edit `docker-compose.yml`. Add volumes section to the backend service (after the `environment` block):

```yaml
    volumes:
      - ./uploads:/app/uploads
```

- [ ] **Step 2: Recreate backend container**

```bash
docker compose up -d backend
```

---

### Task 4: Frontend Types & API

**Files:**
- Modify: `frontend/src/types/inquiry.ts`
- Modify: `frontend/src/api/inquiries.ts`

- [ ] **Step 1: Add file_name fields to Inquiry type**

Edit `frontend/src/types/inquiry.ts`. Add after `menu_content` (line 28):

```typescript
  menu_file_name: string | null
  presentation_file_name: string | null
```

- [ ] **Step 2: Add uploadInquiryFile API function**

Edit `frontend/src/api/inquiries.ts`. Add at the end of the file:

```typescript
export async function uploadInquiryFile(
  id: string,
  fileType: 'menu' | 'presentation',
  file: File
): Promise<{ file_name: string; file_path: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await client.post(`/inquiries/${id}/upload?file_type=${fileType}`, formData)
  return response.data
}
```

---

### Task 5: Frontend InquiryDetail — Real File Upload

**Files:**
- Modify: `frontend/src/pages/inquiries/InquiryDetail.tsx`

- [ ] **Step 1: Remove fake presentationFile state and add refs**

Edit line 165:
```tsx
  // old: const [presentationFile, setPresentationFile] = useState<string | null>(null)
  const menuFileInputRef = useRef<HTMLInputElement>(null)
  const presentationFileInputRef = useRef<HTMLInputElement>(null)
```

Add `useRef` to the imports at the top of the file:
```tsx
import { useState, useRef } from 'react'
```

- [ ] **Step 2: Add upload handler function**

Replace the fake `handleFileUpload` function (lines 257-268) with:

```tsx
  const handleFileUpload = async (type: 'menu' | 'presentation') => {
    const fileInput = type === 'menu' ? menuFileInputRef : presentationFileInputRef
    fileInput.current?.click()
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>, type: 'menu' | 'presentation') => {
    const file = e.target.files?.[0]
    if (!file || !id) return
    try {
      await uploadInquiryFile(id, type, file)
      toast.success(`${type === 'menu' ? 'Menu' : 'Presentation'} uploaded`)
      refetch()
    } catch {
      toast.error('Upload failed')
    }
    if (e.target) e.target.value = ''
  }
```

Add `uploadInquiryFile` to imports from `@/api/inquiries`:
```tsx
import { getInquiry, updateInquiry, uploadInquiryFile, exportSingleInquiryExcel } from '@/api/inquiries'
```

- [ ] **Step 3: Update Menu section rendering**

Replace the Menu section (lines 527-571) to use `inquiry.menu_file_name` instead of `menuFile` state, and add hidden file input:

```tsx
      {/* === MENU SECTION === */}
      {(inquiry.menu_content || inquiry.menu_file_name || isAdmin || isMenuPlanner) && (
        <WorkflowSection icon={ChefHat} iconColor="text-purple-500" title="Menu"
          visibleRoles={['menu_planner', 'kitchen', 'operations_manager', 'warehouse', 'admin', 'sales_head', 'presentation_exec']}
          role={role}>
          <div className="space-y-3">
            {/* AI Text Menu */}
            {inquiry.menu_content && (
              <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-emerald-500" />
                  <span className="text-sm font-medium text-gray-900">AI-Generated Menu</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Ready</span>
                </div>
                <button onClick={handleDownloadMenu}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-medium hover:bg-gray-50">
                  <Download size={14} /> Download .txt
                </button>
              </div>
            )}
            {/* Uploaded Menu File */}
            <div className="flex items-center justify-between">
              <div>
                {inquiry.menu_file_name ? (
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-blue-500" />
                    <span className="text-sm font-medium text-gray-900">{inquiry.menu_file_name}</span>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">Uploaded</span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No menu file uploaded</p>
                )}
              </div>
              <div className="flex gap-2">
                {inquiry.menu_file_name && (
                  <a href={`/api/inquiries/${id}/file/menu`}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-medium hover:bg-gray-50">
                    <Download size={14} /> Download
                  </a>
                )}
                {(isAdmin || isMenuPlanner) && (
                  <>
                    <input type="file" ref={menuFileInputRef} className="hidden"
                      onChange={(e) => handleFileSelected(e, 'menu')} />
                    <button onClick={() => handleFileUpload('menu')}
                      className="flex h-8 items-center gap-1.5 rounded-lg bg-maroon px-3 text-xs font-bold text-white hover:bg-maroon-dark">
                      <Upload size={14} /> Upload Menu
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </WorkflowSection>
      )}
```

- [ ] **Step 4: Update Presentation section rendering**

Replace the Presentation section (lines 573-618) to use `inquiry.presentation_file_name` instead of `presentationFile` state:

```tsx
      {/* === PRESENTATION SECTION === */}
      {(inquiry.presentation_file_name || isAdmin || isPresentationExec) && (
        <WorkflowSection icon={Presentation} iconColor="text-indigo-500" title="Presentation"
          visibleRoles={['presentation_exec', 'kitchen', 'operations_manager', 'warehouse', 'admin', 'sales_head', 'menu_planner']}
          role={role}>
          <div className="flex items-center justify-between">
            <div>
              {inquiry.presentation_file_name ? (
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-emerald-500" />
                  <span className="text-sm font-medium text-gray-900">{inquiry.presentation_file_name}</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Uploaded</span>
                </div>
              ) : (
                <p className="text-sm text-gray-400">No presentation uploaded yet</p>
              )}
            </div>
            <div className="flex gap-2">
              {inquiry.presentation_file_name && (
                <a href={`/api/inquiries/${id}/file/presentation`} target="_blank" rel="noreferrer"
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-medium hover:bg-gray-50">
                  <Eye size={14} /> View
                </a>
              )}
              {(isAdmin || isPresentationExec) && (
                <>
                  <input type="file" ref={presentationFileInputRef} className="hidden"
                    onChange={(e) => handleFileSelected(e, 'presentation')} />
                  <button onClick={() => handleFileUpload('presentation')}
                    className="flex h-8 items-center gap-1.5 rounded-lg bg-maroon px-3 text-xs font-bold text-white hover:bg-maroon-dark">
                    <Upload size={14} /> Upload Presentation
                  </button>
                </>
              )}
            </div>
          </div>
        </WorkflowSection>
      )}
```

- [ ] **Step 5: Remove unused state variables**

Remove these lines (around 164-168):
```tsx
  const [menuFile, setMenuFile] = useState<string | null>(inquiry?.menu_content ? 'Menu.txt' : null)
  const [presentationFile, setPresentationFile] = useState<string | null>(null)
```
And remove `setMenuFile`, `setPresentationFile`, `setShowMenuUpload`, `setShowPresentationUpload` from the fake `handleFileUpload` (but handleFileUpload is already replaced in Step 2).

Also remove `showMenuUpload` and `showPresentationUpload` state declarations and their usage (menu upload toggle UI was removed in the new Menu section).

Check if `showMenuUpload` and `showPresentationUpload` are used elsewhere in the file. If so, remove those usages too.

---

### Task 6: Build Frontend & Deploy

- [ ] **Step 1: Build frontend**

```bash
Set-Location -LiteralPath "D:\Shagun CRM\frontend"; npm run build
```

- [ ] **Step 2: Deploy frontend**

```bash
& "C:\Program Files\Docker\Docker\resources\bin\docker.exe" cp "D:\Shagun CRM\frontend\dist\." shaguncrm-frontend-1:/usr/share/nginx/html/
```

- [ ] **Step 3: Restart backend**

```bash
& "C:\Program Files\Docker\Docker\resources\bin\docker.exe" restart shaguncrm-backend-1
```

- [ ] **Step 4: Notify user to hard refresh**

User opens `http://localhost` with `Ctrl+Shift+R` and tests the upload.
