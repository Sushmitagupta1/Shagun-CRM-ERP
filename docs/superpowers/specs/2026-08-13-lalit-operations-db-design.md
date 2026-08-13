# Lalit Bhai Operations DB — Design

**Date:** 2026-08-13
**Status:** Approved (2026-08-13)
**Roles affected:** `operations_manager` (Lalit), `kitchen`, `admin`, `warehouse`

## Goal

Deliver the **Operations DB** feature set for Lalit Bhai in the Shagun CRM:

1. Operations Home: remove the Completion Rate card; Today's Schedule shows **real events** (no sample data); clicking an event opens the Event View page with all details.
2. New **Event** sidebar item leading to an Event/Event List page.
3. Excel preview shows **complete data** (remove the 200-row and 12-col caps).
4. Repeated inventory Excel uploads per event create **upload history** with per-version date/time; latest shown by default; older files accessible in an Excel History view.
5. **Event View** page with a hierarchical, screenshot-style layout:

   Event Details → Documents (Menu) → Inventory List → Vendor Details → Kitchen Inventory → Inventory Closure Summary → Mark Event as Completed

6. Once the event is marked completed, all editing is locked for everyone and status is clearly visible.

## Design Decisions (from clarifying questions)

- **Data source:** Vendor Details, Kitchen Inventory, and Inventory Closure Summary are **derived from Excel uploads** (auto-populated), not manually entered.
- **Editing:** Numbers auto-populate from Excel/movement files, but select fields stay editable ("blue fields") with a **mandatory Remark** whenever a value is changed.
- **Required Qty source:** The kitchen's **Ingredient Excel** upload defines the required list; Received/Transferred/Returned/Wastage come from their movement files. Items in the required plan with no received entry count as "Not Received".
- **Mark Event as Completed:** A new `is_completed` flag on `Inquiry` + `completed_at` timestamp. Once set by Lalit (ops), the entire Event View becomes read-only for everyone.
- **Excel history scope:** Only inventory movement files (`received`, `returned`, `transferred`, `wastage`) get version history. Menu, presentation, ingredient files keep current single-file behavior.
- **Event List scope:** All `operation_handover` events (current + upcoming), newest first.

## Data Model (new alembic migration)

### `inquiry` (modified)
- `is_completed: bool` (default `False`, nullable `False`)
- `completed_at: datetime | None`

### `inventory_file_versions` (new table)
One row per inventory movement upload — this is the Excel upload history.

| column | type | notes |
|---|---|---|
| id | UUID PK | `UUIDMixin` |
| inquiry_id | FK → inquiries.id (CASCADE) | indexed |
| movement_type | str(50) | `received` / `returned` / `transferred` / `wastage` |
| file_name | str(255) | |
| file_path | str(512) | |
| version_no | int | per `(inquiry_id, movement_type)`, starts at 1, increments on each upload |
| uploaded_by | FK → users.id | |
| created_at | datetime | `TimestampMixin` — upload date/time shown in history |

### `event_inventory_items` (new table)
Editable overrides + remarks per inventory item, keyed by `(inquiry_id, item_name)`. Rows are created lazily on first save/edit. Base values are always derived live from the Ingredient Excel + movement files at read time; where an override row exists, its value wins.

| column | type | notes |
|---|---|---|
| id | UUID PK | |
| inquiry_id | FK → inquiries.id (CASCADE) | indexed |
| item_name | str(255) | unique within inquiry |
| received_qty | float \| None | override for `received` qty |
| transfer_count | float \| None | override for `transferred` count |
| returned_qty | float \| None | override for `returned` qty |
| remark | str(Text) \| None | editable; **mandatory** when any value is changed |
| created_at / updated_at | datetime | |

### `event_vendors` (new table)
Auto-filled from a new **vendor Excel** upload.

| column | type | notes |
|---|---|---|
| id | UUID PK | |
| inquiry_id | FK → inquiries.id (CASCADE) | indexed |
| vendor_name | str(255) | |
| service_name | str(255) | |
| rate | Numeric(12,2) | ₹ |
| total_cost | Numeric(12,2) | ₹ |
| remark | str(Text) \| None | |
| created_at / updated_at | datetime | |

**Total Vendor Cost** = `SUM(total_cost)` per event.

### `kitchen_inventory_items` (new table)
Auto-filled from a new **kitchen_inventory Excel** upload. View-only for Lalit.

| column | type | notes |
|---|---|---|
| id | UUID PK | |
| inquiry_id | FK → inquiries.id (CASCADE) | indexed |
| item_name | str(255) | |
| prepared_qty | float | |
| unit | str(50) \| None | |
| used_qty | float | |
| remaining_qty | float | |
| remark | str(Text) \| None | |
| created_at / updated_at | datetime | |

## Backend Endpoints

### New `backend/app/routers/events.py` (prefix `/api/events`)

- **`GET /api/events`** — list all `operation_handover` inquiries, ordered by `event_date` asc (upcoming first). Response items: id, client_name, event_type, event_date, venue, pax, status, is_completed.
- **`GET /api/events/{inquiry_id}`** — full Event View bundle:
  - `inquiry`: inquiry fields + `sales_head_name` (resolved from `assigned_to` user full_name) + `is_completed` + `completed_at`
  - `documents`: menu file info (`file_name`, exists)
  - `inventory`: `rows` merged from `event_inventory_items` + latest movement data + derived status fields
  - `vendors`: rows + `total_vendor_cost`
  - `kitchen_inventory`: rows
  - `closure`: computed totals (see Closure Summary below)
  - `upload_history`: list of `inventory_file_versions` (latest first), each with version_no, movement_type, file_name, uploaded_at, uploaded_by_name
- **`POST /api/events/{inquiry_id}/inventory-items`** — bulk save edited inventory rows (received_qty, transfer_count, returned_qty, remark). Upserts `event_inventory_items` rows. Authorized roles: `admin`, `operations_manager`, `warehouse`. Validations:
  - Rejected with 400 if event is completed.
  - Rejected with 400 if any row has a changed value and no remark.
- **`POST /api/events/{inquiry_id}/complete`** — sets `is_completed = True`, `completed_at = now`. Authorized roles: `admin`, `operations_manager`.

### New file uploads (extend `FILE_TYPES` / `ALLOWED_ROLES` in `routers/inquiries.py`)

- **`vendor`** — roles: `admin`, `operations_manager`, `warehouse`. Parser reads columns: Vendor Name, Service Name, Rate, Total Cost, Remark. Replaces existing rows for the inquiry on re-upload.
- **`kitchen_inventory`** — roles: `admin`, `kitchen`. Parser reads columns: Item Name, Prepared Qty, Unit, Used Qty, Remaining Qty, Remark. Replaces existing rows on re-upload.

Both reuse the existing upload pattern (`upload_inquiry_file`), storing to `settings.UPLOAD_DIR/<inquiry_id>/<file_type>/`.

### Modified endpoints in `routers/inquiries.py`

- **`read_file_preview`** — remove `MAX_PREVIEW_ROWS = 200` and `MAX_PREVIEW_COLS = 12`; return **all** rows and columns.
- **`upload_inventory_movement_file`** — additionally insert an `inventory_file_versions` row with the next `version_no` for `(inquiry_id, movement_type)`. No inventory-row refresh needed: base values are derived live at read time from the Ingredient Excel + movements, and `event_inventory_items` overrides persist.

## Inventory List Derivation

For each item in the kitchen's **Ingredient Excel** (the required plan):

| column | source |
|---|---|
| Sr. No | row order |
| Item Name | ingredient file item |
| Required Qty | ingredient file qty |
| Received Qty | sum of `received` movements for the item (editable blue field) |
| Not Received Item Count | `1` if Received Qty == 0 else `0` |
| Received Status | `Received` if received >= required; `Partial` if 0 < received < required; `Not Received` if received == 0 |
| Transfer Item Count | sum of `transferred` movements for the item (editable) |
| Returned to THOL Qty | sum of `returned` movements for the item (editable) |
| Remark | editable; **mandatory when any value changes** |

If no Ingredient Excel is uploaded yet, the inventory section shows an empty state prompting for it.

## Vendor Details

- Auto-populated from the **vendor Excel** upload.
- Columns: Sr. No / Vendor Name / Service Name / Rate (₹) / Total Cost (₹) / Remark.
- **Total Vendor Cost** footer = `SUM(total_cost)`.
- Rate, Total Cost, Remark are editable blue fields (Remark mandatory on change).

## Kitchen Inventory

- Auto-populated from the **kitchen_inventory Excel** upload.
- Columns: Sr. No / Item Name / Prepared Qty / Unit / Used Qty / Remaining Qty / Remark.
- **Lalit Bhai (operations_manager): view-only.** Upload control visible to `kitchen` and `admin` roles.

## Inventory Closure Summary

View-only, auto-computed, screenshot-style summary block:

| label | computed from |
|---|---|
| Total Items | count of inventory rows |
| Total Required Qty | sum of required_qty |
| Total Received Qty | sum of received_qty |
| Not Received Qty | sum of required_qty where received_qty == 0 |
| Transferred Qty | sum of transfer_count |
| Returned to THOL Qty | sum of returned_qty |
| Wastage Qty | sum of `wastage` movements |

## Frontend

### Routes (`frontend/src/routes/index.tsx`)
- Path `events` → Event List page (`allowedRoles: ['operations_manager', 'kitchen', 'admin']`)
- Path `events/:id` → Event View page (same roles)

### Sidebar (`frontend/src/components/layout/Sidebar.tsx`)
- New item: **Event** → `/events`, icon e.g. `CalendarDays` / `ClipboardList`, roles `['operations_manager', 'kitchen', 'admin']`.

### Event List page (`frontend/src/pages/events/EventList.tsx`)
- Table of all `operation_handover` events: Client Name, Event Type, Event Date, Venue, Pax, Status, Completed badge, View action.
- Row click / View → navigate to `/events/:id`.

### Event View page (`frontend/src/pages/events/EventView.tsx`)
Sections in flow order, each clearly separated:

1. **Event Details** — Event Name (client_name), Event Date, Pax, Event Type, Status, Client Name, Venue, Sales Head, Created Date.
2. **Documents** — Menu only (View / Download).
3. **Inventory List** — table with columns above; blue-field editing; **mandatory Remark** validation on save.
4. **Vendor Details** — table + Total Vendor Cost footer; blue-field editing with mandatory Remark; vendor Excel upload control.
5. **Kitchen Inventory** — table; view-only for Lalit; upload control for kitchen/admin.
6. **Inventory Closure Summary** — view-only summary block.
7. **Mark Event as Completed** button — on click, confirms, calls `POST /api/events/{id}/complete`, then the whole page becomes read-only with a clearly visible "Completed" status.

Sections 3, 4, 5 get minimize/maximize toggles.

### API client & types
- `frontend/src/api/events.ts` — `getEvents`, `getEventDetail`, `saveInventoryItems`, `completeEvent`, `uploadEventFile`.
- `frontend/src/types/event.ts` — `EventListItem`, `EventDetail`, `EventInventoryRow`, `EventVendor`, `KitchenInventoryItem`, `ClosureSummary`, `FileVersion`.
- New hooks in `frontend/src/hooks/useEvents.ts`.

### Operations Dashboard (`frontend/src/pages/operations/OperationsDashboard.tsx`)
- Remove the Completion Rate card (grid goes 5 → 4 KPI cards).
- Today's Schedule: real events for today from `useInquiries({ status: 'operation_handover' })`, filtered by `event_date === today`. No sample data.
- Clicking an event in Today's Schedule → navigate to `/events/:id`.
- "Upcoming Events" eye button → navigate to `/events/:id` (replaces the `InventoryPanelModal` launch).

### Excel Preview (`frontend/src/components/inventory/ExcelPreviewModal.tsx`)
- No frontend change required (rows come from backend; backend cap removal is sufficient). Table already scrolls horizontally.

## Error Handling

- Completed event → all write endpoints return 400 with a clear message; frontend hides/disabled edit controls.
- Missing Ingredient Excel → Inventory section shows empty state.
- Missing vendor/kitchen Excel → empty state with upload prompt.
- Mandatory Remark violation → 400 with row-level message; frontend marks the offending field.

## Testing

- Backend: pytest for `events` router — list, detail bundle merge, inventory-items save (mandatory remark, completed lock), complete event, vendor/kitchen parsers, version history increment, preview cap removal.
- Frontend: existing build (`npm run build`) + typecheck/lint; manual flow walkthrough for Lalit (ops) and kitchen roles.

## Out of Scope (YAGNI)

- Menu/presentation/ingredient file version history.
- Manual entry of vendor/kitchen data without Excel.
- Editing kitchen inventory by Lalit.
- Multi-event bulk operations.
