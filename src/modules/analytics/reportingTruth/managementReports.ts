import { summarizeReportingTruth, createReportingTruthFinding } from "./reportingTruthEngine.js";
import type { ReportPeriod, ReportingTruthMetric, ReportingTruthReport, ReportingTruthSource } from "./reportingTruthTypes.js";
import { buildTrialBalanceReport } from "./financeReports.js";
import { buildInventoryValuationReport } from "./inventoryReports.js";
import { buildPaymentReconciliationReport } from "./salesReports.js";
import { buildSupplierAgingReport } from "./purchasingReports.js";

export type ManagementReportInputs = {
  period: ReportPeriod;
  /** Optional pre-aggregated values (foundation). */
  data?: {
    netSales?: number | null;
    inventoryValue?: number | null;
    payables?: number | null;
  };
};

function sources(): ReportingTruthSource[] {
  return [
    { sourceTable: "reporting_truth_snapshots", note: "v313 snapshot store (optional)" },
    { sourceTable: "posting_batches", note: "v311 posted batches drive truth reporting" },
    { sourceTable: "import_cutover_batches", note: "v312 cutover drives sales/purchase/inventory pipelines" },
  ];
}

function packBase(key: string, title: string, period: ReportPeriod, reports: ReportingTruthReport[]) {
  const summary = summarizeReportingTruth(reports);
  const metrics: ReportingTruthMetric[] = [
    { key: "truth_score", label: "Truth score", value: summary.truthScore, unit: "/100", sources: sources() },
    { key: "critical_findings", label: "Critical findings", value: summary.criticalCount, sources: sources() },
    { key: "warning_findings", label: "Warning findings", value: summary.warningCount, sources: sources() },
  ];
  return {
    key,
    title,
    domain: "management" as const,
    period,
    metrics,
    findings: summary.findings,
    sources: sources(),
    generatedAt: summary.generatedAt,
    truthScore: summary.truthScore,
    status: summary.status,
  };
}

export function buildFinanceTruthReport(period: ReportPeriod): ReportingTruthReport {
  const tb = buildTrialBalanceReport({ period });
  const report: ReportingTruthReport = {
    key: "finance_truth",
    title: "Finance Truth Report",
    domain: "management",
    period,
    metrics: [
      { key: "trial_balance_score", label: "Trial balance truth", value: tb.truthScore, unit: "/100", sources: tb.sources },
      { key: "trial_balance_status", label: "Trial balance status", value: tb.status, sources: tb.sources },
    ],
    findings: [
      ...tb.findings,
      createReportingTruthFinding({
        domain: "management",
        severity: "info",
        message: "This management report is explainability-first: it references underlying finance checks rather than hiding missing data.",
        source: { sourceTable: "posting_batch_lines" },
      }),
    ],
    sources: tb.sources,
    generatedAt: new Date().toISOString(),
    truthScore: tb.truthScore,
    status: tb.status === "trusted" ? "trusted" : "warning",
  };
  return report;
}

export function buildOperationalRiskReport(period: ReportPeriod): ReportingTruthReport {
  const inv = buildInventoryValuationReport({ period });
  const pay = buildPaymentReconciliationReport({ period });
  const ap = buildSupplierAgingReport({ period });

  return packBase("operational_risk", "Operational Risk Report", period, [inv, pay, ap]);
}

export function buildExecutiveKpiPack(input: ManagementReportInputs): ReportingTruthReport {
  const baseSources = sources();
  const metrics: ReportingTruthMetric[] = [
    { key: "net_sales", label: "Net sales", value: input.data?.netSales ?? null, unit: "SAR", sources: baseSources, explain: "Should come from posted POS batches or cutover aggregates." },
    { key: "inventory_value", label: "Inventory value", value: input.data?.inventoryValue ?? null, unit: "SAR", sources: baseSources, explain: "Should come from costed movement ledger snapshots." },
    { key: "supplier_payables", label: "Supplier payables", value: input.data?.payables ?? null, unit: "SAR", sources: baseSources, explain: "Should come from posted AP movements." },
  ];

  const findings = [];
  if (input.data?.netSales == null || input.data?.inventoryValue == null || input.data?.payables == null) {
    findings.push(
      createReportingTruthFinding({
        domain: "management",
        severity: "warning",
        message: "Executive KPI pack contains demo/estimated values (missing posted truth aggregates).",
        source: { sourceTable: "reporting_report_runs" },
        action: "Populate KPIs from posted/cutover truth models and store report runs with sources.",
      }),
    );
  }

  const summary = summarizeReportingTruth([
    {
      key: "executive_kpi_pack",
      title: "Executive KPI Pack",
      domain: "management",
      period: input.period,
      status: "incomplete",
      truthScore: 0,
      metrics,
      findings,
      sources: baseSources,
      generatedAt: new Date().toISOString(),
    },
  ]);

  return {
    key: "executive_kpi_pack",
    title: "Executive KPI Pack",
    domain: "management",
    period: input.period,
    metrics,
    findings,
    sources: baseSources,
    generatedAt: summary.generatedAt,
    truthScore: summary.truthScore,
    status: summary.status,
  };
}

export function buildManagementDashboardPack(period: ReportPeriod): ReportingTruthReport {
  const finance = buildFinanceTruthReport(period);
  const ops = buildOperationalRiskReport(period);
  return packBase("management_dashboard_pack", "Management Dashboard Pack", period, [finance, ops]);
}
