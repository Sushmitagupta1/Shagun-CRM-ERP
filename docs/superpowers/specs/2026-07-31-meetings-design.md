# Meetings for Presentation (Inquiry-Scoped) — Design

Date: 2026-07-31

## Problem

The Presentation Dashboard shows a hardcoded "Today's Meetings" panel with fake testing data
(Sharma Family, Tata Corp, Mehta Family). The `Meetings Today` KPI card counts confirmed events
(`event_date == today` with status advance_receive/operation_handover) rather than actual
meetings. There is no way for the presentation executive (Shayank) to record a meeting against
an inquiry.

## Goal

- Remove the hardcoded testing data from the Presentation Dashboard.
- Let the presentation executive add meetings (date + time + remark) against an inquiry, in the
  Presentation section of the Inquiry Detail page.
- Show real meeting data in the Presentation Dashboard "Today's Meetings" panel and count real
  meetings in the `Meetings Today` KPI.

## Design

The feature mirrors the existing Follow-up feature exactly (the one used by the sales head).

### Backend

New `Meeting` model (registered in `backend/app/models/`):

- Table: `meetings`
- Columns:
  - `id` (UUID PK, via `UUIDMixin`)
  - `inquiry_id` (UUID FK -> `inquiries.id`, `ondelete="CASCADE"`, not null)
  - `meeting_at` (DateTime, not null) — date **and** time
  - `remarks` (Text, nullable)
  - `status` (String, default `scheduled`, allowed: `scheduled`, `completed`)
  - `created_by` (UUID FK -> `users.id`, not null)
  - `created_at` / `updated_at` (via `TimestampMixin`)

Schemas (`backend/app/schemas/inquiry.py`):

- `MeetingCreate`: `meeting_at: datetime`, `remarks: str | None`
- `MeetingStatusUpdate`: `status: Literal['scheduled', 'completed']`
- `MeetingResponse`: `id`, `inquiry_id`, `meeting_at`, `remarks`, `status`, `created_by`, `created_at`

Endpoints (`backend/app/routers/inquiries.py`, mirroring the follow-up endpoints):

- `GET /api/inquiries/{inquiry_id}/meetings` -> `list[MeetingResponse]`, ordered by `meeting_at` asc
- `POST /api/inquiries/{inquiry_id}/meetings` -> `MeetingResponse` (201), no status transition
- `PATCH /api/inquiries/{inquiry_id}/meetings/{meeting_id}` -> `MeetingResponse`, body
  `MeetingStatusUpdate`; 404 if meeting does not belong to the inquiry

Alembic migration: new revision creating the `meetings` table (name follows the existing
`9013_add_file_upload_columns.py` convention).

Dashboard (`backend/app/services/dashboard_service.py` + `backend/app/schemas/dashboard.py`):

- `client_meetings_today` KPI now counts meetings where `meeting_at` date == today (all statuses
  or non-completed — decision: all meetings scheduled for today, matching "Meetings Today").
- Presentation KPI response gains `today_meetings: list[{id, client_name, event_type, meeting_at,
  remarks, status}]` (meetings with `meeting_at` date == today, joined with inquiry client/event,
  ordered by time asc) for the dashboard panel.

### Frontend

`frontend/src/types/inquiry.ts`:

- `Meeting` interface: `id`, `inquiry_id`, `meeting_at`, `remarks: string | null`,
  `status: 'scheduled' | 'completed'`, `created_by`, `created_at`.

`frontend/src/api/inquiries.ts`:

- `getMeetings(id)` -> `Meeting[]`
- `addMeeting(id, data: { meeting_at: string; remarks?: string })` -> `Meeting`
- `updateMeetingStatus(id, meetingId, status)` -> `Meeting`

`frontend/src/pages/inquiries/InquiryDetail.tsx` — Presentation section (admin/presentation_exec):

- "Add Meeting" button toggling a small form: Date, Time, Remarks — styled like the Follow-ups
  form.
- Meeting list below: time badge, formatted date, remark, status badge (Scheduled/Completed),
  and a "Mark done" toggle (only for scheduled meetings).

`frontend/src/pages/presentation/PresentationDashboard.tsx`:

- Delete the hardcoded `todayMeetings` array.
- "Today's Meetings" panel renders `today_meetings` from the presentation KPI API; "pending"
  count = scheduled meetings; completed meetings render with the green check style.
- `Meetings Today` KPI now reflects the real count from the API (no frontend change needed beyond
  the API returning the real number).

### Error handling

- `POST` validates `meeting_at` is required (schema-level).
- `PATCH` returns 404 if the meeting does not exist or belongs to a different inquiry.
- Follow the existing pattern: `HTTPException` with a `detail` message, surfaced by the
  frontend mutation `onError` handlers.

### Testing

- No automated test framework is set up in this repo; verification is manual:
  1. Login as presentation exec, open an inquiry, add a meeting (date/time/remark).
  2. Confirm it appears in the meeting list with Scheduled status; mark it completed.
  3. Open the Presentation Dashboard; confirm the Today's Meetings panel shows the meeting
     (client + time + remark) and the KPI count includes it.

## Out of Scope (explicitly declined)

- Calendar page integration
- Notifications for meetings
- Editing or deleting meetings
- Meeting reminders
