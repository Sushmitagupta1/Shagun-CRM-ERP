# Lalit Operations Enhancements — Design

**Date:** 2026-08-13
**Scope:** Bring the Operations Manager (Lalit) dashboard and Event View in line with the PRD's Lalit section, **excluding Quick Actions**.

## Current state (summary)

The Operations dashboard shows 4 KPI cards, Today's Schedule, and an Upcoming Events table. The Event View (`/events/:id`) shows Event Details, Menu download, Inventory List, Vendor Details, Kitchen Inventory, Closure Summary, Upload History, and Complete Event. Several PRD items are missing: Pending Vendor Requests KPI, All Inquiries table, PPT/Ingredient/Semi-finished downloads, Transfer Panel, Photos, Event Timeline, Vendor Payment Status, Warehouse Requests, and real (non-hardcoded) KPIs.

## Goal

Deliver the full Lalit PRD section except Quick Actions:

1. KPI cards: Upcoming Events, Today's Events, Pending Kitchen Plans, Pending Vendor Requests, Pending Warehouse Requests (real values)
2. Event table (confirmed) — already present
3. All inquiry table
4. Menu + PPT download (Event View)
5. View Ingredient request / Semi-finished item list (download buttons)
6. Warehouse Request flow: Lalit uploads/creates requests → sent to THOL → THOL issues → Lalit receives
7. Transfer Panel: Items Returned, Direct Transfers (with 1st→2nd event), Wastage
8. Photos: Before Event, Setup Photo, After Event Cleaning (upload + view)
9. Complete Event — already present
10. Event Timeline: Planning → Kitchen → Warehouse Request → Execution → Completion → Settlement
11. Vendor Panel: Vendor Name, Item Name, Total Cost, Payment Status (add payment status column)

## Assumptions (approved by user)

- **Pending Vendor Requests** KPI = count of handover (confirmed) events that have not uploaded a vendor excel.
- **Direct Transfers** get a target-event selector (`InventoryMovement.to_inquiry_id`); the existing excel format does not carry a second event name.

## Data model changes (new Alembic migration)

### `warehouse_requests`
| column | type | notes |
|---|---|---|
| id | UUID PK | |
| inquiry_id | UUID FK inquiries (cascade), index | |
| item_name | String(255) | |
| quantity | Float | |
| unit | String(50) nullable | |
| status | String(20) default `pending` | `pending` → `issued` → `received` |
| requested_by | UUID FK users | |
| issued_by | UUID FK users nullable | |
| received_by | UUID FK users nullable | |
| notes | Text nullable | |
| created_at / updated_at | timestamps | |

### `event_photos`
| column | type | notes |
|---|---|---|
| id | UUID PK | |
| inquiry_id | UUID FK inquiries (cascade), index | |
| category | String(30) | `before_setup` \| `setup` \| `after_cleaning` |
| file_name | String(255) | |
| file_path | String(512) | |
| uploaded_by | UUID FK users | |
| created_at / updated_at | timestamps | |

### `event_vendors` — add column
- `payment_status` String(20) default `unpaid` (`unpaid` | `paid`)

### `inventory_movements` — add column
- `to_inquiry_id` UUID FK inquiries nullable (for direct transfers)

## Backend endpoints

### Events router additions
| Method | Path | Purpose | Roles |
|---|---|---|---|
| POST | `/api/events/{inquiry_id}/warehouse-requests` | Create requests from ingredient rows (body optional: list of items, or "from ingredient plan") | admin, operations_manager |
| GET | `/api/events/{inquiry_id}/warehouse-requests` | List requests for event | admin, operations_manager, kitchen, warehouse |
| PATCH | `/api/events/{inquiry_id}/warehouse-requests/{request_id}/issue` | THOL marks issued | admin, warehouse |
| PATCH | `/api/events/{inquiry_id}/warehouse-requests/{request_id}/receive` | Lalit marks received | admin, operations_manager |
| POST | `/api/events/{inquiry_id}/photos` | Upload photo (multipart, `category` form field) | admin, operations_manager |
| GET | `/api/events/{inquiry_id}/photos` | List photos | any auth |
| GET | `/api/events/{inquiry_id}/photos/{photo_id}/download` | Download photo file | any auth |
| POST | `/api/events/{inquiry_id}/transfers` | Create direct transfer (item, qty, to_inquiry_id) | admin, operations_manager |
| GET | `/api/events/{inquiry_id}/transfers` | List transfers (movement_type = transferred) | any auth |

### Event bundle additions (`GET /api/events/{inquiry_id}`)
- `presentation_file_name`, `presentation_uploaded`
- `ingredient_file_name`, `ingredient_uploaded`
- `kitchen_inventory_file_name`, `kitchen_inventory_uploaded`
- `warehouse_requests: []` (with status labels + actor names)
- `photos: []` (id, category, file_name, uploaded_at, uploaded_by_name)
- `transfers: []` (item, qty, unit, from_event, to_event, date)
- `timeline: []` — computed stages:
  1. Planning — inquiry created (status: completed, date: created_at)
  2. Kitchen — ingredient or kitchen_inventory uploaded (pending/completed)
  3. Warehouse Request — any request created (pending/completed)
  4. Execution — event_date within 1 day (pending/active/completed)
  5. Completion — `is_completed` (pending/completed)
  6. Settlement — settlement exists (pending/completed)
- `vendors[]` now includes `payment_status`

### Dashboard KPIs (operations)
- `pending_kitchen_plans` → count of OPERATION_HANDOVER events without `kitchen_inventory_file_name`
- `pending_vendor_requests` → count of OPERATION_HANDOVER events without `vendor_file_name`
- `pending_warehouse_requests` → count of `WarehouseRequest.status == 'pending'`
- Add `pending_vendor_requests` to `OperationsKPIs` schema

### Vendor save endpoint
- `POST /api/events/{inquiry_id}/vendors` now also accepts `payment_status` per vendor row.

## Frontend

### Operations Dashboard (`OperationsDashboard.tsx`)
- 5 KPI cards (add Pending Vendor Requests)
- Add **All Inquiries** table section: uses `useInquiries()` (no status filter), shows Client, Phone, Event Type, Event Date, Pax, Status pill, eye → Event View.

### Event View (`EventView.tsx`)
- **Documents section**: add PPT / Ingredient Excel / Semi-finished (kitchen inventory) download buttons alongside Menu.
- **Vendor Details**: add Payment Status column (select unpaid/paid), included in save payload.
- **Warehouse Requests** section:
  - Lalit: "Send Request to THOL" (creates from ingredient plan) + per-request "Receive" button
  - THOL (warehouse): per-request "Issue" button
  - Table: Item, Qty, Unit, Status, Requested By, Actions
- **Transfer Panel** section: three tables — Items Returned, Direct Transfers, Wastage; plus "Add Direct Transfer" form (item, qty, target event select) for Lalit.
- **Photos** section: 3 category groups with upload buttons (Lalit) and thumbnail grid with download.
- **Event Timeline** section: vertical stepper showing 6 stages with status badges + dates.
- Gate all edits/actions on `!data.is_completed` (existing `canEdit` pattern) and role.

## API client / hooks
- `frontend/src/types/event.ts`: add `WarehouseRequest`, `EventPhoto`, `TransferRow`, `TimelineStage`, new bundle fields, `payment_status` on vendor.
- `frontend/src/api/events.ts`: add `warehouseRequests`, `createWarehouseRequests`, `issueWarehouseRequest`, `receiveWarehouseRequest`, `uploadEventPhoto`, `eventPhotos`, `downloadPhoto`, `createTransfer`, `eventTransfers`.
- `frontend/src/hooks/useEvents.ts`: add corresponding mutations/queries; invalidate `['events', id]` after each.

## Tests (backend)
- Warehouse request lifecycle: create → THOL issue → Lalit receive; role guards; completion lock.
- Photo upload + list + download; role guards.
- Direct transfer create + list with to-event.
- Vendor payment_status save.
- Operations KPI real values (pending kitchen/vendor/warehouse).
- Event timeline stages in bundle.

## Out of scope
- Quick Actions (per user)
- Client Reminder (birthday/anniversary) widgets
- Finance role / other dashboards
- Activity log writes
