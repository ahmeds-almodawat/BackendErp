export type PurchaseDocumentStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "posted"
  | "cancelled"
  | "reversed";

export interface PurchaseInvoiceBackendRecord {
  id: string;
  invoice_no: string;
  supplier_id: string;
  branch_id: string;
  store_id?: string;
  invoice_date: string;
  due_date?: string;
  subtotal_amount: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  status: PurchaseDocumentStatus;
  posting_batch_id?: string;
}

export interface PurchaseInvoiceLineBackendRecord {
  id: string;
  invoice_id: string;
  item_id: string;
  quantity: number;
  unit_cost: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
}

export interface SupplierPaymentBackendRecord {
  id: string;
  payment_no: string;
  supplier_id: string;
  branch_id: string;
  payment_date: string;
  amount: number;
  method: "cash" | "bank" | "card" | "transfer";
  account_code: string;
  status: PurchaseDocumentStatus;
  posting_batch_id?: string;
}

export interface PurchasingValidationFinding {
  severity: "warning" | "critical";
  field?: string;
  message: string;
  action: string;
}
