# Multi-Follow-Up System Design

## Objective
Replace the single `follow_up_date` column + `FollowUpHistory` audit table with a proper `follow_ups` table enabling multiple follow-up entries (2-3) before an inquiry transitions from "Follow-up" to "Client Confirmation".

## Current System
- `Inquiry.follow_up_date` — single date column on inquiries
- `FollowUpHistory` table — tracks every change to that single date
- Auto-transition from NEW_INQUIRY → FOLLOWUP when `follow_up_date` updated via PUT
- Inline date editor in InquiryDetail (admin/sales_head only)
- Historical timeline of date changes in InquiryDetail

## New System

### Data Model

**New `follow_ups` table:**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| inquiry_id | UUID | FK → inquiries.id, CASCADE |
| follow_up_date | Date | NOT NULL |
| remarks | Text | nullable |
| created_by | UUID | FK → users.id |
| created_at | DateTime | auto |
| updated_at | DateTime | auto |

**Removed:**
- `Inquiry.follow_up_date` column
- `FollowUpHistory` table

### Migration
1. Create `follow_ups` table
2. For each inquiry with a non-null `follow_up_date`, create an initial FollowUp entry from that date (with no remarks)
3. For each entry in `FollowUpHistory`, create a FollowUp entry using the `new_date` if it differs from inquiry's `follow_up_date`
4. Drop `follow_up_date` column from inquiries
5. Drop `follow_up_history` table

### Backend API

**POST /api/inquiries** (create — modified)
- Accepts `follow_up_date` and `follow_up_remarks` (optional)
- If `follow_up_date` provided → creates inquiry + first FollowUp entry, sets status = FOLLOWUP
- If `follow_up_date` not provided → creates inquiry with status = NEW_INQUIRY (no FollowUp)

**PUT /api/inquiries/{id}** (modified)
- Remove auto-transition logic for `follow_up_date` (no longer a column)
- Remove history-logging code

**GET /api/inquiries/{id}/follow-ups** (new)
- Returns all FollowUps for an inquiry, ordered by `follow_up_date` ASC

**POST /api/inquiries/{id}/follow-ups** (new)
- Body: `{ follow_up_date: string, remarks?: string }`
- Creates a new FollowUp entry
- If inquiry status is NEW_INQUIRY, auto-transitions to FOLLOWUP
- Returns the created FollowUp

**DELETE /api/inquiries/{id}/follow-ups/{follow_up_id}** (new)
- Deletes a FollowUp entry (optional, for UX flexibility)

### Frontend

**InquiryForm.tsx Stage 1**
- Visually unchanged — same "Follow-up Date" field
- No "Follow-up Remarks" in Stage 1 (remarks added later in detail view)
- POST to `/api/inquiries` sends `follow_up_date` → first FollowUp entry created on backend

**InquiryDetail.tsx**
- **Remove:** Inline follow-up date editor (the editable date input + save/cancel buttons)
- **Remove:** Follow-up History timeline section
- **Add:** "Follow-ups" section in Stage 1 area showing:
  - Table/list of existing follow-ups: date, remarks, created_by_name, created_at
  - "Add Follow-up" button → opens inline form with date + remarks input + Save button
  - After save, list refreshes
- **Keep:** Status dropdown unchanged (user can transition to Client Confirmation when ready)

**InquiryList.tsx**
- No changes to the list or action buttons
- "Follow-up" action button still transitions status to `followup`

**API layer (`inquiries.ts`)**
- Add `getFollowUps(id)` — calls GET /inquiries/{id}/follow-ups
- Add `addFollowUp(id, data)` — calls POST /inquiries/{id}/follow-ups
- Remove `getFollowUpHistory(id)` (deprecated)
- Modify `createInquiry(data)` — now also accepts optional `follow_up_remarks`

**Types (`inquiry.ts`)**
- Add `FollowUp` type: `{ id, inquiry_id, follow_up_date, remarks, created_by, created_by_name?, created_at }`
- Remove `follow_up_date` from `Inquiry` type

### Status Flow Unchanged
- NEW_INQUIRY → FOLLOWUP → CLIENT_CONFIRMATION → MENU_SENT → ADVANCE_RECEIVE → OPERATION_HANDOVER
- Auto-transition from NEW_INQUIRY to FOLLOWUP happens when first FollowUp is added
- User manually transitions from FOLLOWUP to CLIENT_CONFIRMATION via the status dropdown

### Data Migration Strategy
1. Run `CREATE TABLE follow_ups (...)` via Alembic
2. For each inquiry with `follow_up_date IS NOT NULL`, INSERT INTO follow_ups (id, inquiry_id, follow_up_date, remarks, created_by, created_at) — using created_by from the inquiry, created_at from created_at
3. Optionally migrate FollowUpHistory entries as additional follow-ups
4. ALTER TABLE inquiries DROP COLUMN follow_up_date
5. DROP TABLE follow_up_history
