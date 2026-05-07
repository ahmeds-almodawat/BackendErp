export type FinanceDocumentStatus =
  | "draft"
  | "validated"
  | "approved"
  | "posted"
  | "reversed"
  | "cancelled";

export type FinanceJournalSource =
  | "manual_journal"
  | "opening_balance"
  | "purchase_invoice"
  | "supplier_payment"
  | "sales_pos_batch"
  | "inventory_adjustment"
  | "production_batch"
  | "depreciation_run"
  | "bank_reconciliation"
  | "vat_settlement";

export interface FinanceJournalEntryBackendRecord {
  id: string;
  journal_no: string;
  journal_date: string;
  branch_id?: string;
  fiscal_period_id?: string;
  source_type: FinanceJournalSource;
  source_id?: string;
  description: string;
  status: FinanceDocumentStatus;
  posted_at?: string;
  reversed_at?: string;
}

export interface FinanceJournalLineBackendRecord {
  id: string;
  journal_id: string;
  account_code: string;
  branch_id?: string;
  cost_center_id?: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface FinanceValidationFinding {
  severity: "warning" | "critical";
  field?: string;
  message: string;
  action: string;
}

export interface FinanceValidationSummary {
  ok: boolean;
  criticalCount: number;
  warningCount: number;
  findings: FinanceValidationFinding[];
}

export interface TrialBalanceLine {
  account_code: string;
  account_name?: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface FinanceReportSummary {
  ok: boolean;
  title: string;
  periodStart: string;
  periodEnd: string;
  branchId?: string;
  generatedAt: string;
  truthStatus: "trusted" | "warning" | "critical" | "incomplete";
  findings: FinanceValidationFinding[];
}
