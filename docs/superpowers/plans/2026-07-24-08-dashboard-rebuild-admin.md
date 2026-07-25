# Plan 8: Rebuild Admin Dashboard per Doc Spec

## Context
The `Shagun Catering Report.docx` defines the exact spec for each dashboard. The current Admin Dashboard (`frontend/src/pages/admin/AdminDashboard.tsx`) has 10 KPIs in 2 rows, 3 charts, and a recent inquiries table. The doc requires 11 KPIs, 6 charts, 3 task panels, and quick actions.

## Gap: Current vs Doc Spec

### KPI Cards (Current: 10 → Doc: 11)
Current has: Total Inquiries, Confirmed, Cancelled, Upcoming Events, Today's Events, Pending Payments, Total Revenue, Outstanding, Kitchen Pending, Warehouse Pending

Doc requires:
1. Total Inquiries ✅
2. Confirmed Events ✅
3. Cancelled Inquiries ✅
4. Upcoming Events ✅
5. Today's Events ✅
6. Pending Kitchen Plans ✅
7. Pending Warehouse Requests ✅
8. **Pending FnF Settlements** ← NEW
9. Pending Payments ✅
10. Total Revenue ✅
11. Total Outstanding Amount ✅

**Change:** Add "Pending FnF Settlements" KPI card. Reorder to match doc (3 rows of ~4).

### Dashboard Charts (Current: 3 → Doc: 6)
Current has: Monthly Inquiry Trend, Inquiry Distribution (ConversionRate), Inquiry Volume (RevenueChart)

Doc requires:
1. Monthly Inquiry Trend ✅ (rename to match doc)
2. Inquiry Conversion Rate ✅ (already exists)
3. Monthly Revenue ✅ (already exists)
4. **Event Status Distribution** ← NEW (pie/donut chart showing status breakdown)
5. **Warehouse Stock Summary** ← NEW (bar chart showing stock levels)
6. **Payment Collection Trend** ← NEW (line chart showing payments over time)

**Change:** Add 3 new chart components: `EventStatusDistribution`, `WarehouseStockSummary`, `PaymentCollectionTrend`.

### Task Panels (Current: 0 → Doc: 3)
Doc requires:
1. **Pending User Approval** — list of users awaiting admin approval
2. **Pending Settlements** — settlements needing attention
3. **Pending Notifications** — unread notifications

**Change:** Add a 3-column task panel section below charts.

### Quick Actions (Current: 0 → Doc: 5)
Doc requires:
1. Create User (User name, Role, Password)
2. Create Inquiry (client name, phone number, event type, event date, pax, budget)
3. View/Download Reports (Monthly, Yearly, Event-wise)
4. AI Configuration
5. System Settings

**Change:** Add a quick actions grid at the bottom.

## Implementation Steps

### Step 1: Add new chart components
- Create `frontend/src/components/charts/EventStatusDistribution.tsx` (Recharts PieChart)
- Create `frontend/src/components/charts/WarehouseStockSummary.tsx` (Recharts BarChart)
- Create `frontend/src/components/charts/PaymentCollectionTrend.tsx` (Recharts LineChart)

### Step 2: Add new API hooks and types
- Extend `AdminKPIs` type in `frontend/src/types/dashboard.ts` with `pending_fnf_settlements`
- Add `useEventStatusDistribution`, `useWarehouseStockSummary`, `usePaymentCollectionTrend` hooks
- Add corresponding API functions (can reuse existing chart endpoints or add new ones)

### Step 3: Rebuild AdminDashboard.tsx
- Rearrange KPI cards: 3 rows of 4 (12th slot empty or use "Total Outstanding" as 11th)
- Add 6 charts in 2 rows of 3
- Add 3 task panels (Pending User Approval, Pending Settlements, Pending Notifications)
- Add Quick Actions section with action cards
- Keep Recent Inquiries table at bottom

### Step 4: Fix TS build errors
- Remove unused imports (`ChefHat` from KitchenDashboard, MenuPlannerDashboard; `CheckCircle` from WarehouseDashboard)

### Step 5: Verify build
- Run `npm run build` to confirm no errors

## Files to Modify
- `frontend/src/pages/admin/AdminDashboard.tsx` — main rebuild
- `frontend/src/types/dashboard.ts` — add `pending_fnf_settlements`
- `frontend/src/hooks/useDashboard.ts` — add new chart hooks
- `frontend/src/api/dashboard.ts` — add new chart API calls
- `frontend/src/components/charts/EventStatusDistribution.tsx` — NEW
- `frontend/src/components/charts/WarehouseStockSummary.tsx` — NEW
- `frontend/src/components/charts/PaymentCollectionTrend.tsx` — NEW
- `frontend/src/pages/kitchen/KitchenDashboard.tsx` — fix unused import
- `frontend/src/pages/menu/MenuPlannerDashboard.tsx` — fix unused import
- `frontend/src/pages/warehouse/WarehouseDashboard.tsx` — fix unused import

## Verification
- `npm run build` passes with 0 errors
- All 11 KPI cards render
- All 6 charts render with mock data
- 3 task panels display
- Quick actions grid displays
- Recent inquiries table still works
