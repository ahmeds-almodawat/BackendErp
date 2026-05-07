export interface FinanceCloseCheck {
  key: string;
  label: string;
  status: "ready" | "warning" | "blocked" | "not_checked";
  required: boolean;
}

export interface FinanceCloseSummary {
  ok: boolean;
  status: "ready" | "warning" | "blocked";
  blockedCount: number;
  warningCount: number;
  checks: FinanceCloseCheck[];
}

export const defaultFinanceCloseChecks: FinanceCloseCheck[] = [
  { key: "trial_balance_balanced", label: "Trial balance is balanced", status: "not_checked", required: true },
  { key: "unposted_batches", label: "No critical unposted posting batches", status: "not_checked", required: true },
  { key: "inventory_reconciled", label: "Inventory valuation reconciled to GL", status: "not_checked", required: true },
  { key: "ap_reconciled", label: "AP subledger reconciled to GL", status: "not_checked", required: true },
  { key: "ar_reconciled", label: "AR subledger reconciled to GL", status: "not_checked", required: true },
  { key: "bank_reconciled", label: "Bank accounts reconciled", status: "not_checked", required: true },
  { key: "vat_reviewed", label: "VAT summary reviewed", status: "not_checked", required: true },
  { key: "backup_completed", label: "Backup completed before close", status: "not_checked", required: true },
];

export function summarizeFinanceClose(checks: FinanceCloseCheck[] = defaultFinanceCloseChecks): FinanceCloseSummary {
  const blockedCount = checks.filter((check) => check.required && check.status === "blocked").length;
  const warningCount = checks.filter((check) => check.status === "warning" || check.status === "not_checked").length;

  return {
    ok: blockedCount === 0 && warningCount === 0,
    status: blockedCount > 0 ? "blocked" : warningCount > 0 ? "warning" : "ready",
    blockedCount,
    warningCount,
    checks,
  };
}
