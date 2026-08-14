# Lalit Bhai — Event Inventory Lifecycle — Design

## Goal

Bring the Operations Manager (Lalit) inventory workflow in line with the approved requirements: a full per-event inventory lifecycle (request → receive → transfer → return → close), a structured audit trail, view-only inventory for Chef (kitchen) and Store (warehouse), and a read-only closure summary.

## Current state (summary)

- `event_inventory_items`: `item_name`, `received_qty`, `transfer_count`, `returned_qty`, `remark`. Required qty is derived at Excel upload time but **not persisted** on the row.
- `inventory_file_versions`: uploaded Excel files with parse metadata.
- `event_vendors`: `vendor_name`, `service_name`, `rate`, `total_cost`, `payment_status`, `remark`. Edits already require a remark.
- `inventory_movements`: direct transfers (`to_inquiry_id`) and wastage (`movement_type`).
- `activity_logs`: generic `(action, entity_type, entity_id, details JSON)` — not suitable for the structured per-field audit the spec requires.
- `is_completed` on `inquiries` already locks most edits server-side and hides edit UI.

## Assumptions (approved by user)

1. Full feature: DB + backend + frontend (Operations, Chef, Store) + audit trail, deployed to Railway.
2. `received_qty` is **computed** = `required_qty − not_received_count`. Never manually entered.
3. `received_tag` is **computed**: `Yes` when `not_received_count = 0`, `No` when `not_received_count ≥ required_qty`, else `Half`.
4. Transfer Item Count + Transfer Event Name are **manual** columns entered by Lalit; independent of the existing Direct Transfers panel/movements.
5. Breakage/Missing Items Count is a **manual** per-item column; feeds closure Wastage/Missing total. Existing wastage movements are unaffected.
6. Audit trail is a single **Audit Trail section** on the Event Details page; visible even after completion.
7. Required-qty edits require a remark (rule 4.1); ops columns (`not_received_count`, `transfer_count`, `breakage_count`, `returned_qty`, `transfer_event`) do not (rule 4.2).
8. Chef DB = `kitchen` dashboard; Store DB = `warehouse` dashboard. Both view-only for inventory.

## Data model (new Alembic migration)

### `event_inventory_items` — add columns
| column | type | notes |
|---|---|---|
| `required_qty` | Float nullable | persisted from Excel; editable with mandatory remark |
| `not_received_count` | Float default 0 | ops-editable, no remark |
| `breakage_count` | Float default 0 | ops-editable, no remark |
| `transfer_event` | String(255) nullable | manual target-event name, ops-editable |

Existing columns `received_qty`, `transfer_count`, `returned_qty`, `remark` stay. Backfill `required_qty` from the latest inventory file-version parse where possible; otherwise null.

### `event_audit_logs` (new table)
| column | type | notes |
|---|---|---|
| id | UUID PK | UUIDMixin |
| inquiry_id | UUID FK inquiries (cascade), index | |
| user_id | UUID FK users | |
| action | String(50) | `upload`, `edit`, `receive_all`, `return_all`, `complete` |
| entity_type | String(50) | `inventory_item`, `vendor`, `event`, `file` |
| entity_id | UUID nullable | row id where applicable |
| field | String(50) nullable | e.g. `required_qty`, `not_received_count` |
| old_value | String nullable | |
| new_value | String nullable | |
| remark | Text nullable | |
| created_at | DateTime(tz) | |

## Backend

### Computed fields in bundle (`GET /api/events/{inquiry_id}`)
Each inventory row returns: `required_qty`, `received_qty` (computed), `not_received_count`, `received_tag` (computed), `transfer_count`, `returned_qty`, `transfer_event`, `breakage_count`, `remark`.

Closure summary totals become: Total Required, Total Received (computed), Total Not Received, Total Transferred, Total Returned to Thol, Wastage/Missing (sum of `breakage_count`), Pending/Difference (`required − received − breakage`).

### Endpoints
| Method | Path | Purpose | Roles |
|---|---|---|---|
| PATCH | `/api/events/{id}/inventory-items/{item_id}` | Single-field edit + optional remark | admin, operations_manager |
| POST | `/api/events/{id}/inventory/receive-all` | Bulk received = required − not_received | admin, operations_manager |
| POST | `/api/events/{id}/inventory/return-all` | Bulk returned = required − not_received − transfer (floored at 0) | admin, operations_manager |
| GET | `/api/events/{id}/audit` | Structured audit trail | admin, operations_manager, kitchen, warehouse |

### Business rules (server-enforced)
- Editing `required_qty` (or any Excel-sourced field) **requires** a non-empty remark; ops fields do not.
- All mutation endpoints return 400/403 when `is_completed`.
- Each successful mutation writes 1+ `event_audit_logs` rows with old/new values.
- `receive-all` never modifies `not_received_count`; `return-all` never modifies `not_received_count`/`transfer_count`.
- Vendor `save_vendors` also writes structured audit rows per changed field (in addition to the existing remark requirement).
- Excel uploads (`inquiries.py` inventory file path) and event completion write audit rows.

## Frontend

### Event Details (`EventView.tsx`)
- **Inventory table** rebuilt with columns: Sr No, Item Name, Required Qty, Received Qty (read-only computed), Not Received, Received Tag (pill: Yes=emerald / Half=amber / No=rose), Transfer Count, Returned to Thol, Transfer Event, Breakage/Missing, Remark.
- Toolbar above table: search bar, Upload Excel, View Excel, **Received All Inventory**, **All Items Returned to Thol**, minimize/expand.
- Inline cell editing: Excel-sourced fields open a remark-required dialog; ops fields edit inline without remark. All edits hidden when `is_completed`.
- **Audit Trail** section (bottom): Date/Time, User, Action, Field, Old Value, New Value, Remark. Read-only, always visible.
- **Vendor Details**: add search bar + minimize/expand (editing rules unchanged).
- **Kitchen Inventory**: add View/Download Excel buttons (stays view-only).

### Chef & Store dashboards
- Read-only Event Inventory table for handover events: item name, required, received, not received, received tag, remark. No edit controls, no buttons.

## Out of scope
- Client Reminder widgets, Finance role, activity_logs backfill, notifications for inventory events.
- Changes to the existing Direct Transfers panel or wastage movements.

## Testing (backend)
- Computed received_qty / received_tag correctness.
- receive-all preserves not_received exceptions; return-all formula `required − not_received − transfer`.
- Remark required for required_qty edits; not required for ops fields.
- Audit rows written for edits, receive-all, return-all, upload, completion; readable after completion.
- Completion lock on all new mutation endpoints.
- Kitchen/warehouse roles blocked from all mutations.
