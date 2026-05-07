export type SalesBatchStatus =
  | "draft"
  | "validated"
  | "approved"
  | "posted"
  | "reconciled"
  | "cancelled"
  | "reversed";

export interface SalesPosBatchBackendRecord {
  id: string;
  batch_no: string;
  branch_id: string;
  business_date: string;
  source_system: "manual" | "foodics" | "other_pos";
  total_sales: number;
  total_tax: number;
  total_discount: number;
  total_refunds: number;
  total_payments: number;
  status: SalesBatchStatus;
  posting_batch_id?: string;
}

export interface SalesPosPaymentBackendRecord {
  id: string;
  batch_id: string;
  payment_method: string;
  amount: number;
}

export interface SalesValidationFinding {
  severity: "warning" | "critical";
  field?: string;
  message: string;
  action: string;
}
