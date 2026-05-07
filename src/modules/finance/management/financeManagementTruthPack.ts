export interface ManagementTruthKpi {
  key: string;
  label: string;
  value: number | string;
  unit?: string;
  status: "trusted" | "warning" | "critical" | "incomplete";
  source: string;
}

export interface ManagementTruthPack {
  periodStart: string;
  periodEnd: string;
  branchId?: string;
  truthScore: number;
  status: "trusted" | "warning" | "critical" | "incomplete";
  kpis: ManagementTruthKpi[];
  findings: string[];
}

export function buildFinanceManagementTruthPack(input: {
  periodStart: string;
  periodEnd: string;
  branchId?: string;
  revenue?: number;
  grossProfit?: number;
  netProfit?: number;
  cashBalance?: number;
  apBalance?: number;
  arBalance?: number;
  findings?: string[];
}): ManagementTruthPack {
  const findings = input.findings ?? [];
  const truthScore = Math.max(0, 100 - findings.length * 10);
  const status = findings.length === 0 ? "trusted" : truthScore >= 80 ? "warning" : "critical";

  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    branchId: input.branchId,
    truthScore,
    status,
    findings,
    kpis: [
      { key: "revenue", label: "Revenue", value: input.revenue ?? 0, unit: "SAR", status, source: "finance_journal_entries_backend" },
      { key: "gross_profit", label: "Gross Profit", value: input.grossProfit ?? 0, unit: "SAR", status, source: "finance_journal_entries_backend" },
      { key: "net_profit", label: "Net Profit", value: input.netProfit ?? 0, unit: "SAR", status, source: "finance_journal_entries_backend" },
      { key: "cash_balance", label: "Cash / Bank", value: input.cashBalance ?? 0, unit: "SAR", status, source: "bank_accounts + journal lines" },
      { key: "ap_balance", label: "Accounts Payable", value: input.apBalance ?? 0, unit: "SAR", status, source: "ap_subledger_transactions" },
      { key: "ar_balance", label: "Accounts Receivable", value: input.arBalance ?? 0, unit: "SAR", status, source: "ar_subledger_transactions" },
    ],
  };
}
