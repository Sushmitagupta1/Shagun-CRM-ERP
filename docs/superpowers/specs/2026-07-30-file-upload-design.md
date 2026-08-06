# File Upload for Menu & Presentation

**Date:** 2026-07-30
**Status:** Draft

## Objective

Add real file upload from device storage for the Menu and Presentation sections in InquiryDetail. Currently these sections use fake "uploads" that only set local state + boolean flags. Replace with actual file storage on the server.

## Scope

- Menu section: keep existing AI-generated text menu + `.txt` download, add real file upload
- Presentation section: replace fake local-state upload with real file upload
- No changes to MenuGenerator, role visibility, section names, or layout

## Backend

### Model Changes (`models/inquiry.py`)

New columns on `Inquiry`:

| Column | Type | Purpose |
|---|---|---|
| `menu_file_name` | `String(255) \| None` | Original uploaded filename for menu |
| `menu_file_path` | `String(512) \| None` | Server path to uploaded menu file |
| `presentation_file_name` | `String(255) \| None` | Original uploaded filename for presentation |
| `presentation_file_path` | `String(512) \| None` | Server path to uploaded presentation file |

### Schema Changes (`schemas/inquiry.py`)

- `InquiryResponse`: add `menu_file_name`, `presentation_file_name` fields
- No changes to `InquiryCreate` or `InquiryUpdate` (uploads use separate endpoint)

### Configuration (`config.py`)

Add:
- `UPLOAD_DIR: str = "/app/uploads"`
- `MAX_UPLOAD_SIZE: int = 20 * 1024 * 1024` (20 MB)
- `ALLOWED_EXTENSIONS: set = {".pdf", ".docx", ".xlsx", ".pptx", ".ppt", ".jpg", ".jpeg", ".png", ".webp", ".txt", ".csv"}`

### Docker Compose

Add volume mount:
```yaml
volumes:
  - ./uploads:/app/uploads
```

### New Endpoints (`routers/inquiries.py`)

**`POST /api/inquiries/{inquiry_id}/upload?type=menu|presentation`**
- Accepts `multipart/form-data` with field `file`
- Validates: inquiry exists
- Role validation: `menu` upload allowed for admin/menu_planner; `presentation` upload allowed for admin/presentation_exec
- Validates: file size ≤ 20 MB, extension in allowed set
- Saves to `{UPLOAD_DIR}/{inquiry_id}/{type}/{original_filename}`
- Namespace subdirectories per inquiry to avoid collisions
- Overwrites if a file with the same name exists
- Updates inquiry record (`menu_file_name`, `menu_file_path` or `presentation_file_name`, `presentation_file_path`)
- Returns JSON: `{ "file_name": "...", "file_path": "..." }`

**`GET /api/inquiries/{inquiry_id}/file/{file_type}`** where `file_type` = `menu` or `presentation`
- Reads file path from inquiry record
- Returns file as `FileResponse` with original filename as `Content-Disposition` attachment
- 404 if no file uploaded

### Migration

New Alembic revision adding the four columns to `inquiries` table.

## Frontend

### API (`api/inquiries.ts`)

Add:
```typescript
export async function uploadInquiryFile(
  id: number,
  type: 'menu' | 'presentation',
  file: File
): Promise<{ file_name: string; file_path: string }>
```
- Uses `FormData` with `multipart/form-data` content type

### Types (`types/inquiry.ts`)

Add to `Inquiry` interface:
```typescript
menu_file_name?: string | null
presentation_file_name?: string | null
```

### InquiryDetail Changes (`pages/inquiries/InquiryDetail.tsx`)

**Menu section:**
- Remove fake `handleFileUpload` for menu
- Add real `<input type="file" hidden>` ref + trigger button
- On file select: call `uploadInquiryFile(id, 'menu', file)`, on success refresh inquiry
- Show uploaded file name next to AI text menu area
- Add download button for uploaded file via `GET /api/inquiries/{id}/file/menu`
- Keep existing AI text `.txt` download button unchanged

**Presentation section:**
- Same pattern: real file input → upload → refresh → show download
- Keep "View" button (opens file in new tab if browser can render it)
- Remove fake local state (`presentationFile`)

## Data Flow

```
User clicks "Upload Menu"
  → hidden <input type="file"> opens
  → User selects file
  → onchange: uploadInquiryFile(id, 'menu', file)
  → POST /api/inquiries/{id}/upload?type=menu (multipart)
  → Backend saves to /app/uploads/{id}/menu/{filename}
  → Backend updates inquiry.menu_file_name, menu_file_path
  → Frontend refetches inquiry
  → UI shows file name + download button
```

## Error Handling

- File too large (>20 MB): toast error
- Invalid file type: toast error
- Upload fails (network/server): toast error
- No file selected: disabled upload button
- Download when no file exists: 404 toast

## Out of Scope

- Cloud storage (S3, etc.) — local server storage only
- File preview/thumbnails in browser — just download/view
- Multiple file versions — overwrite on re-upload
- Ingredient/settlement file uploads — only menu and presentation
