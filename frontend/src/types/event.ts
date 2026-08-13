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
  received_status: string
  transfer_count: number
  returned_qty: number
  unit: string | null
  remark: string | null
}

export interface EventVendorRow {
  id: string
  vendor_name: string
  service_name: string | null
  rate: number | null
  total_cost: number | null
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
}

export interface InventoryItemSave {
  item_name: string
  received_qty?: number | null
  transfer_count?: number | null
  returned_qty?: number | null
  remark?: string | null
}

export interface VendorSave {
  id: string
  rate?: number | null
  total_cost?: number | null
  remark?: string | null
}
