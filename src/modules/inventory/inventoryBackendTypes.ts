export type InventoryMovementDirection = "in" | "out";
export type InventoryMovementStatus = "draft" | "validated" | "posted" | "reversed" | "cancelled";

export type InventoryMovementType =
  | "opening_stock"
  | "purchase_receipt"
  | "sales_consumption"
  | "production_consumption"
  | "production_output"
  | "transfer_in"
  | "transfer_out"
  | "adjustment_in"
  | "adjustment_out"
  | "wastage"
  | "stock_count_variance"
  | "supplier_return";

export interface InventoryStockMovement {
  id: string;
  movement_no: string;
  movement_date: string;
  branch_id: string;
  store_id: string;
  item_id: string;
  movement_type: InventoryMovementType;
  direction: InventoryMovementDirection;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  source_type?: string;
  source_id?: string;
  posting_batch_id?: string;
  status: InventoryMovementStatus;
  created_at?: string;
}

export interface InventoryStockBalance {
  id: string;
  branch_id: string;
  store_id: string;
  item_id: string;
  quantity_on_hand: number;
  average_unit_cost: number;
  total_value: number;
  last_movement_at?: string;
}

export interface InventoryValidationFinding {
  severity: "warning" | "critical";
  field?: string;
  message: string;
  action: string;
}

export interface InventoryValidationSummary {
  ok: boolean;
  criticalCount: number;
  warningCount: number;
  findings: InventoryValidationFinding[];
}

export interface InventoryAdjustmentRequest {
  id: string;
  branch_id: string;
  store_id: string;
  item_id: string;
  direction: InventoryMovementDirection;
  quantity: number;
  unit_cost: number;
  reason: string;
  status: "draft" | "pending_approval" | "approved" | "posted" | "rejected" | "cancelled";
}
