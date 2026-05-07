import { calculateReportingTruthScore, classifyReportingTruthStatus, createReportingTruthFinding } from "./reportingTruthEngine.js";
import type { ReportPeriod, ReportingTruthMetric, ReportingTruthReport, ReportingTruthSource } from "./reportingTruthTypes.js";

export type PurchasingReportInputs = {
  period: ReportPeriod;
  data?: {
    supplierBalance?: { suppliers: number; totalPayables: number } | null;
    aging?: { missingDueDates: number } | null;
  };
};

function sources(): ReportingTruthSource[] {
  return [
    { sourceTable: "suppliers", note: "Supplier master (future cutover or local v309 models)" },
    { sourceTable: "purchase_invoices", note: "Purchasing documents (future)" },
    { sourceTable: "posting_batches", note: "v311 purchase_invoice and supplier_payment batches when integrated" },
  ];
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

export function buildSupplierBalanceReport(input: PurchasingReportInputs): ReportingTruthReport {
  const baseSources = sources();
  const b = input.data?.supplierBalance ?? null;
  const findings = [];
  const metrics: ReportingTruthMetric[] = [
    { key: "supplier_count", label: "Suppliers", value: b?.suppliers ?? null, sources: baseSources },
    { key: "total_payables", label: "Total payables", value: b?.totalPayables ?? null, unit: "SAR", sources: baseSources },
  ];
  if (!b) {
    findings.push(
      createReportingTruthFinding({
        domain: "purchasing",
        severity: "warning",
        message: "Supplier balances are incomplete: missing posted AP movements and supplier ledger aggregation.",
        source: { sourceTable: "posting_batches" },
        action: "Post purchase invoices and supplier payments through v311 and aggregate balances per supplier.",
      }),
    );
  }
  return finalize({
    key: "supplier_balance",
    title: "Supplier Balance",
    domain: "purchasing",
    period: input.period,
    metrics,
    findings,
    sources: baseSources,
    generatedAt: new Date().toISOString(),
  });
}

export function buildSupplierAgingReport(input: PurchasingReportInputs): ReportingTruthReport {
  const baseSources = sources();
  const a = input.data?.aging ?? null;
  const findings = [];
  const metrics: ReportingTruthMetric[] = [
    { key: "missing_due_dates", label: "Missing due dates", value: a?.missingDueDates ?? null, sources: baseSources },
  ];

  if (!a) {
    findings.push(
      createReportingTruthFinding({
        domain: "purchasing",
        severity: "warning",
        message: "Supplier aging is incomplete: missing invoice due dates and aging buckets.",
        source: { sourceTable: "purchase_invoices" },
        action: "Ensure every invoice has due_date; compute aging buckets from open balances by supplier.",
      }),
    );
  } else if ((a.missingDueDates ?? 0) > 0) {
    findings.push(
      createReportingTruthFinding({
        domain: "purchasing",
        severity: "critical",
        message: `${a.missingDueDates} invoice(s) are missing due dates; aging report is unreliable.`,
        source: { sourceTable: "purchase_invoices" },
        action: "Enforce due_date and payment terms before trusting aging.",
      }),
    );
  }

  return finalize({
    key: "supplier_aging",
    title: "Supplier Aging",
    domain: "purchasing",
    period: input.period,
    metrics,
    findings,
    sources: baseSources,
    generatedAt: new Date().toISOString(),
  });
}

export function buildPurchaseTrendReport(input: PurchasingReportInputs): ReportingTruthReport {
  const baseSources = sources();
  const findings = [
    createReportingTruthFinding({
      domain: "purchasing",
      severity: "warning",
      message: "Purchase trend is a foundation stub: requires approved/posted purchasing documents by business date.",
      source: { sourceTable: "purchase_invoices" },
      action: "Create backend aggregates per day/week/month from posted invoice batches.",
    }),
  ];
  const metrics: ReportingTruthMetric[] = [{ key: "implemented", label: "Implemented", value: false }];
  return finalize({
    key: "purchase_trend",
    title: "Purchase Trend",
    domain: "purchasing",
    period: input.period,
    metrics,
    findings,
    sources: baseSources,
    generatedAt: new Date().toISOString(),
  });
}

export function buildOpenPurchaseInvoicesReport(input: PurchasingReportInputs): ReportingTruthReport {
  const baseSources = sources();
  const findings = [
    createReportingTruthFinding({
      domain: "purchasing",
      severity: "warning",
      message: "Open purchase invoices report is incomplete: requires invoice lifecycle (open/settled) and payments linkage.",
      source: { sourceTable: "posting_batches" },
      action: "Link supplier_payment batches to invoices and compute remaining balance per invoice.",
    }),
  ];
  const metrics: ReportingTruthMetric[] = [{ key: "open_invoices", label: "Open invoices", value: null, sources: baseSources }];
  return finalize({
    key: "open_purchase_invoices",
    title: "Open Purchase Invoices",
    domain: "purchasing",
    period: input.period,
    metrics,
    findings,
    sources: baseSources,
    generatedAt: new Date().toISOString(),
  });
}
