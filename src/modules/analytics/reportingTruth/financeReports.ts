import { calculateReportingTruthScore, classifyReportingTruthStatus, createReportingTruthFinding } from "./reportingTruthEngine.js";
import type { ReportPeriod, ReportingTruthMetric, ReportingTruthReport, ReportingTruthSource } from "./reportingTruthTypes.js";

export type FinanceReportInputs = {
  period: ReportPeriod;
  /** Optional pre-aggregated data from backend or data provider (foundation only). */
  data?: {
    trialBalance?: { debitTotal: number; creditTotal: number; accountCount?: number } | null;
    cashBank?: { cash: number; bank: number } | null;
    vat?: { inputVat: number; outputVat: number } | null;
  };
};

function baseSources(): ReportingTruthSource[] {
  return [
    { sourceTable: "posting_batches", note: "v311 posting engine batches (posted/validated)" },
    { sourceTable: "posting_batch_lines", note: "v311 posting engine lines for balances and totals" },
    { sourceTable: "fiscal_periods", note: "v310 fiscal period lock status impacts posting truth" },
  ];
}

function buildReportBase(key: string, title: string, period: ReportPeriod) {
  return {
    key,
    title,
    domain: "finance" as const,
    period,
    generatedAt: new Date().toISOString(),
  };
}

function finalize(report: Omit<ReportingTruthReport, "status" | "truthScore">): ReportingTruthReport {
  const score = calculateReportingTruthScore(report.findings);
  const criticalCount = report.findings.filter((f) => f.severity === "critical").length;
  const warningCount = report.findings.filter((f) => f.severity === "warning").length;
  const classified = classifyReportingTruthStatus(score, criticalCount, warningCount);
  const status =
    classified === "critical"
      ? "critical"
      : report.findings.some((f) => f.message.toLowerCase().includes("missing"))
        ? "incomplete"
        : classified;
  return { ...report, truthScore: score, status };
}

export function buildTrialBalanceReport(input: FinanceReportInputs): ReportingTruthReport {
  const sources = [...baseSources(), { sourceTable: "reporting_truth_snapshots", note: "v313 snapshot storage (optional)" }];
  const findings = [];
  const tb = input.data?.trialBalance ?? null;

  const metrics: ReportingTruthMetric[] = [
    { key: "debit_total", label: "Total debit", value: tb?.debitTotal ?? null, unit: "SAR", sources },
    { key: "credit_total", label: "Total credit", value: tb?.creditTotal ?? null, unit: "SAR", sources },
    { key: "account_count", label: "Accounts", value: tb?.accountCount ?? null, sources },
  ];

  if (!tb) {
    findings.push(
      createReportingTruthFinding({
        domain: "finance",
        severity: "warning",
        message: "Trial balance is incomplete: missing aggregated debit/credit totals for the period.",
        source: { sourceTable: "posting_batch_lines" },
        action: "Provide server-side aggregates from posted v311 posting lines (or legacy v309 batches) for the requested period.",
      }),
    );
  } else {
    const diff = Number(tb.debitTotal ?? 0) - Number(tb.creditTotal ?? 0);
    metrics.push({ key: "imbalance", label: "Debit - Credit", value: Number(diff.toFixed(2)), unit: "SAR", sources });
    if (Math.abs(diff) >= 0.01) {
      findings.push(
        createReportingTruthFinding({
          domain: "finance",
          severity: "critical",
          message: `Trial balance is not balanced (difference ${diff.toFixed(2)}).`,
          source: { sourceTable: "posting_batch_lines" },
          action: "Block reporting as trusted until server-side posting validation prevents unbalanced batches.",
        }),
      );
    }
  }

  return finalize({
    ...buildReportBase("trial_balance", "Trial Balance", input.period),
    metrics,
    findings,
    sources,
  });
}

export function buildGeneralLedgerReport(input: FinanceReportInputs): ReportingTruthReport {
  const sources = baseSources();
  const findings = [
    createReportingTruthFinding({
      domain: "finance",
      severity: "warning",
      message: "General ledger details are a foundation stub: account-level rollups are not implemented yet.",
      source: { sourceTable: "posting_batch_lines" },
      action: "Add server-side ledger rollups by account_code and posting_date with pagination and branch/period filters.",
    }),
  ];
  const metrics: ReportingTruthMetric[] = [{ key: "implemented", label: "Implemented", value: false }];
  return finalize({ ...buildReportBase("general_ledger", "General Ledger", input.period), metrics, findings, sources });
}

export function buildIncomeStatementReport(input: FinanceReportInputs): ReportingTruthReport {
  const sources = [...baseSources(), { sourceTable: "chart_of_accounts", note: "COA mapping required for P&L grouping" }];
  const findings = [
    createReportingTruthFinding({
      domain: "finance",
      severity: "warning",
      message: "Income statement is incomplete: missing COA classifications (revenue/expense) and rollup rules.",
      source: { sourceTable: "chart_of_accounts" },
      action: "Introduce a backend COA table with account_type and reporting groups; compute rollups from posted lines.",
    }),
  ];
  const metrics: ReportingTruthMetric[] = [{ key: "net_profit", label: "Net profit", value: null, unit: "SAR", sources }];
  return finalize({ ...buildReportBase("income_statement", "Income Statement", input.period), metrics, findings, sources });
}

export function buildBalanceSheetReport(input: FinanceReportInputs): ReportingTruthReport {
  const sources = [...baseSources(), { sourceTable: "chart_of_accounts", note: "COA mapping required for balance sheet grouping" }];
  const findings = [
    createReportingTruthFinding({
      domain: "finance",
      severity: "warning",
      message: "Balance sheet is incomplete: missing COA classifications (asset/liability/equity) and rollup rules.",
      source: { sourceTable: "chart_of_accounts" },
      action: "Introduce balance-sheet groups and compute closing balances by account for the period end.",
    }),
  ];
  const metrics: ReportingTruthMetric[] = [
    { key: "assets", label: "Total assets", value: null, unit: "SAR", sources },
    { key: "liabilities", label: "Total liabilities", value: null, unit: "SAR", sources },
    { key: "equity", label: "Total equity", value: null, unit: "SAR", sources },
  ];
  return finalize({ ...buildReportBase("balance_sheet", "Balance Sheet", input.period), metrics, findings, sources });
}

export function buildCashBankSummaryReport(input: FinanceReportInputs): ReportingTruthReport {
  const sources = [...baseSources(), { sourceTable: "bank_reconciliation", note: "Future bank module or imports" }];
  const cb = input.data?.cashBank ?? null;
  const findings = [];
  const metrics: ReportingTruthMetric[] = [
    { key: "cash", label: "Cash", value: cb?.cash ?? null, unit: "SAR", sources },
    { key: "bank", label: "Bank", value: cb?.bank ?? null, unit: "SAR", sources },
  ];
  if (!cb) {
    findings.push(
      createReportingTruthFinding({
        domain: "finance",
        severity: "warning",
        message: "Cash/bank summary is incomplete: missing cash/bank account mapping and balances.",
        source: { sourceTable: "posting_batch_lines" },
        action: "Provide account mapping for cash/bank and compute balances from posted lines.",
      }),
    );
  }
  return finalize({ ...buildReportBase("cash_bank_summary", "Cash / Bank Summary", input.period), metrics, findings, sources });
}

export function buildVatSummaryReport(input: FinanceReportInputs): ReportingTruthReport {
  const sources = [...baseSources(), { sourceTable: "vat_config", note: "Tax configuration (future) or mapping" }];
  const vat = input.data?.vat ?? null;
  const findings = [];
  const metrics: ReportingTruthMetric[] = [
    { key: "vat_input", label: "VAT input", value: vat?.inputVat ?? null, unit: "SAR", sources },
    { key: "vat_output", label: "VAT output", value: vat?.outputVat ?? null, unit: "SAR", sources },
  ];
  if (!vat) {
    findings.push(
      createReportingTruthFinding({
        domain: "finance",
        severity: "warning",
        message: "VAT summary is incomplete: missing VAT account mapping and period aggregates.",
        source: { sourceTable: "posting_batch_lines" },
        action: "Map VAT input/output accounts and compute totals from posted batches.",
      }),
    );
  }
  return finalize({ ...buildReportBase("vat_summary", "VAT Summary", input.period), metrics, findings, sources });
}
