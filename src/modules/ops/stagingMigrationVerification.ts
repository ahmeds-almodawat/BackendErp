export type StagingVerificationStatus = "not_checked" | "ready" | "warning" | "blocked";

export interface StagingMigrationCheck {
  key: string;
  label: string;
  expectedObject: string;
  objectType: "table" | "function" | "policy" | "index" | "extension";
  required: boolean;
  status: StagingVerificationStatus;
}

export const stagingMigrationChecks: StagingMigrationCheck[] = [
  { key: "pgcrypto", label: "pgcrypto extension exists", expectedObject: "pgcrypto", objectType: "extension", required: true, status: "not_checked" },
  { key: "branches", label: "Branches table exists", expectedObject: "public.branches", objectType: "table", required: true, status: "not_checked" },
  { key: "items", label: "Items table exists", expectedObject: "public.items", objectType: "table", required: true, status: "not_checked" },
  { key: "stock_movements", label: "Inventory stock movements table exists", expectedObject: "public.inventory_stock_movements", objectType: "table", required: true, status: "not_checked" },
  { key: "purchase_invoices", label: "Purchase invoices table exists", expectedObject: "public.purchase_invoices", objectType: "table", required: true, status: "not_checked" },
  { key: "sales_batches", label: "Sales POS batches table exists", expectedObject: "public.sales_pos_batches", objectType: "table", required: true, status: "not_checked" },
  { key: "finance_journals", label: "Finance journal backend tables exist", expectedObject: "public.finance_journal_entries_backend", objectType: "table", required: true, status: "not_checked" },
  { key: "bank_close", label: "Bank/VAT/close live tables exist", expectedObject: "public.live_period_close_requests", objectType: "table", required: true, status: "not_checked" },
  { key: "posting_rpc", label: "Finance post journal RPC exists", expectedObject: "public.finance_post_journal", objectType: "function", required: true, status: "not_checked" },
  { key: "go_live_rpc", label: "Go-live readiness summary RPC exists", expectedObject: "public.go_live_readiness_summary", objectType: "function", required: true, status: "not_checked" },
];

export function summarizeStagingMigrationChecks(checks: StagingMigrationCheck[] = stagingMigrationChecks) {
  const blocked = checks.filter((check) => check.required && check.status === "blocked").length;
  const notChecked = checks.filter((check) => check.required && check.status === "not_checked").length;
  const ready = checks.filter((check) => check.status === "ready").length;

  return {
    status: blocked > 0 ? "blocked" : notChecked > 0 ? "warning" : "ready",
    blocked,
    notChecked,
    ready,
    total: checks.length,
  };
}
