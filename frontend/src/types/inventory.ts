export type InventoryMovementType = 'received' | 'returned' | 'transferred' | 'wastage'

export interface InventoryMovement {
  id: string
  inquiry_id: string
  movement_type: InventoryMovementType
  item_name: string
  quantity: number
  unit: string | null
  notes: string | null
  created_by: string
  created_at: string
}

export interface InventoryMovementCreate {
  movement_type: InventoryMovementType
  item_name: string
  quantity: number
  unit?: string | null
  notes?: string | null
}
