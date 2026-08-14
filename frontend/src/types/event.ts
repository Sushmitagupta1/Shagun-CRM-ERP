export interface EventListItem {
  id: string
  client_name: string
  event_type: string
  event_date: string | null
  venue: string | null
  pax: number | null
  status: string
  is_completed: boolean
}

export interface EventInventoryRow {
  sr_no: number
  item_name: string
  required_qty: number
  received_qty: number
  not_received_count: number
  received_tag: string
  transfer_count: number
  returned_qty: number
  breakage_count: number
  transfer_event: string | null
  unit: string | null
  remark: string | null
}

export interface EventVendorRow {
  id: string
  vendor_name: string
  service_name: string | null
  rate: number | null
  total_cost: number | null
  payment_status: string
  remark: string | null
}

export interface KitchenInventoryRow {
  id: string
  item_name: string
  prepared_qty: number
  unit: string | null
  used_qty: number
  remaining_qty: number
  remark: string | null
}

export interface ClosureSummary {
  total_items: number
  total_required_qty: number
  total_received_qty: number
  not_received_qty: number
  transferred_qty: number
  returned_thol_qty: number
  wastage_qty: number
  breakage_qty: number
  pending_qty: number
}

export interface FileVersion {
  id: string
  movement_type: string
  file_name: string
  version_no: number
  uploaded_at: string
  uploaded_by_name: string | null
}

export interface EventDetail {
  id: string
  client_name: string
  client_phone: string | null
  event_type: string
  event_date: string | null
  pax: number | null
  status: string
  venue: string | null
  sales_head_name: string | null
  created_at: string
  is_completed: boolean
  completed_at: string | null
  menu: { file_name: string | null; uploaded: boolean }
  inventory: EventInventoryRow[]
  vendors: EventVendorRow[]
  total_vendor_cost: number
  kitchen_inventory: KitchenInventoryRow[]
  closure: ClosureSummary
  upload_history: FileVersion[]
  presentation_file_name: string | null
  ingredient_file_name: string | null
  kitchen_inventory_file_name: string | null
  warehouse_requests: WarehouseRequestRow[]
  photos: EventPhotoRow[]
  returns: TransferRow[]
  transfers: TransferRow[]
  wastage_rows: TransferRow[]
  timeline: TimelineStage[]
}

export interface InventoryItemSave {
  item_name: string
  required_qty?: number | null
  received_qty?: number | null
  not_received_count?: number | null
  transfer_count?: number | null
  returned_qty?: number | null
  remark?: string | null
}

export interface VendorSave {
  id: string
  rate?: number | null
  total_cost?: number | null
  payment_status?: string | null
  remark?: string | null
}

export interface WarehouseRequestRow {
  id: string
  item_name: string
  quantity: number
  unit: string | null
  status: string
  requested_by_name: string | null
  issued_by_name: string | null
  received_by_name: string | null
  notes: string | null
  created_at: string
}

export interface EventPhotoRow {
  id: string
  category: string
  file_name: string
  uploaded_at: string
  uploaded_by_name: string | null
}

export interface TransferRow {
  id: string
  item_name: string
  quantity: number
  unit: string | null
  from_event: string
  to_event: string | null
  created_at: string
}

export interface TimelineStage {
  key: string
  label: string
  status: string
  date: string | null
  description: string | null
}

export interface InventoryItemPatch {
  item_name: string
  field: string
  value: number | string | null
  remark?: string | null
}

export interface EventAuditRow {
  id: string
  action: string
  entity_type: string
  item_name: string | null
  field_name: string | null
  old_value: string | null
  new_value: string | null
  remark: string | null
  created_at: string
  user_name: string | null
}
