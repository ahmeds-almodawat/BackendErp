import { calculateReportingTruthScore, classifyReportingTruthStatus, createReportingTruthFinding } from "./reportingTruthEngine.js";
import type { ReportPeriod, ReportingTruthMetric, ReportingTruthReport, ReportingTruthSource } from "./reportingTruthTypes.js";

export type SalesReportInputs = {
  period: ReportPeriod;
  data?: {
    salesSummary?: { netSales: number; grossSales?: number; orders?: number } | null;
    payments?: { paymentsTotal: number } | null;
  };
};

function sources(): ReportingTruthSource[] {
  return [
    { sourceTable: "import_staging_files", note: "v310/v312 imports staged (Foodics sales/payments)" },
    { sourceTable: "import_cutover_batches", note: "v312 cutover batches (approved/posted imports)" },
    { sourceTable: "posting_batches", note: "v311 POS posting batches (sales_pos_batch) when integrated" },
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

export function buildSalesSummaryReport(input: SalesReportInputs): ReportingTruthReport {
  const baseSources = sources();
  const s = input.data?.salesSummary ?? null;
  const metrics: ReportingTruthMetric[] = [
    { key: "net_sales", label: "Net sales", value: s?.netSales ?? null, unit: "SAR", sources: baseSources },
    { key: "orders", label: "Orders", value: s?.orders ?? null, sources: baseSources },
  ];
  const findings = [];
  if (!s) {
    findings.push(
      createReportingTruthFinding({
        domain: "sales",
        severity: "warning",
        message: "Sales summary is incomplete: missing posted POS batches or cutover aggregates.",
        source: { sourceTable: "posting_batches" },
        action: "Post daily sales batches via v311 and aggregate by business date and branch.",
      }),
    );
  }
  return finalize({
    key: "sales_summary",
    title: "Sales Summary",
    domain: "sales",
    period: input.period,
    metrics,
    findings,
    sources: baseSources,
    generatedAt: new Date().toISOString(),
  });
}

export function buildPaymentReconciliationReport(input: SalesReportInputs): ReportingTruthReport {
  const baseSources = sources();
  const s = input.data?.salesSummary ?? null;
  const p = input.data?.payments ?? null;
  const findings = [];
  const metrics: ReportingTruthMetric[] = [
    { key: "sales_net", label: "Net sales (expected)", value: s?.netSales ?? null, unit: "SAR", sources: baseSources },
    { key: "payments_total", label: "Payments total", value: p?.paymentsTotal ?? null, unit: "SAR", sources: baseSources },
  ];
  if (!s || !p) {
    findings.push(
      createReportingTruthFinding({
        domain: "sales",
        severity: "warning",
        message: "Payment reconciliation is incomplete: missing sales and/or payment aggregates for the same business period.",
        source: { sourceTable: "import_cutover_batches" },
        action: "Ensure both Foodics sales and Foodics payments are cut over for the same branch and business date.",
      }),
    );
  } else {
    const diff = Number(s.netSales) - Number(p.paymentsTotal);
    metrics.push({ key: "difference", label: "Sales - Payments", value: Number(diff.toFixed(2)), unit: "SAR", sources: baseSources });
    if (Math.abs(diff) >= 0.01) {
      findings.push(
        createReportingTruthFinding({
          domain: "sales",
          severity: "critical",
          message: `Sales/payment mismatch detected (${diff.toFixed(2)}).`,
          source: { sourceTable: "import_cutover_batches" },
          action: "Investigate missing tenders, timing differences, refunds/voids, or duplicate cutover files.",
        }),
      );
    }
  }
  return finalize({
    key: "payment_reconciliation",
    title: "Payment Reconciliation",
    domain: "sales",
    period: input.period,
    metrics,
    findings,
    sources: baseSources,
    generatedAt: new Date().toISOString(),
  });
}

export function buildProductSalesReport(input: SalesReportInputs): ReportingTruthReport {
  const baseSources = sources();
  const findings = [
    createReportingTruthFinding({
      domain: "sales",
      severity: "warning",
      message: "Product sales report is a foundation stub: item-level POS detail mapping is not implemented yet.",
      source: { sourceTable: "import_staging_rows" },
      action: "Add mapped POS product lines with SKU mapping and compute quantities and net revenue per product.",
    }),
  ];
  const metrics: ReportingTruthMetric[] = [{ key: "implemented", label: "Implemented", value: false }];
  return finalize({
    key: "product_sales",
    title: "Product Sales",
    domain: "sales",
    period: input.period,
    metrics,
    findings,
    sources: baseSources,
    generatedAt: new Date().toISOString(),
  });
}

export function buildCategorySalesReport(input: SalesReportInputs): ReportingTruthReport {
  const baseSources = [...sources(), { sourceTable: "category_mapping", note: "Category library and mapping (future)" }];
  const findings = [
    createReportingTruthFinding({
      domain: "sales",
      severity: "warning",
      message: "Category sales report is incomplete: requires product→category mapping and item-level POS details.",
      source: { sourceTable: "category_mapping" },
      action: "Define category master and map products; then compute category totals from posted/cutover POS lines.",
    }),
  ];
  const metrics: ReportingTruthMetric[] = [{ key: "categories", label: "Categories", value: null, sources: baseSources }];
  return finalize({
    key: "category_sales",
    title: "Category Sales",
    domain: "sales",
    period: input.period,
    metrics,
    findings,
    sources: baseSources,
    generatedAt: new Date().toISOString(),
  });
}

export function buildDiscountRefundReport(input: SalesReportInputs): ReportingTruthReport {
  const baseSources = sources();
  const findings = [
    createReportingTruthFinding({
      domain: "sales",
      severity: "warning",
      message: "Discount/refund report is incomplete: requires POS event taxonomy (discounts, voids, refunds) in staged mapping.",
      source: { sourceTable: "import_staging_rows" },
      action: "Extend Foodics mapping profile to include discounts/voids/refunds and compute totals by business date.",
    }),
  ];
  const metrics: ReportingTruthMetric[] = [{ key: "discount_value", label: "Discounts", value: null, unit: "SAR", sources: baseSources }];
  return finalize({
    key: "discount_refund",
    title: "Discounts / Refunds",
    domain: "sales",
    period: input.period,
    metrics,
    findings,
    sources: baseSources,
    generatedAt: new Date().toISOString(),
  });
}
