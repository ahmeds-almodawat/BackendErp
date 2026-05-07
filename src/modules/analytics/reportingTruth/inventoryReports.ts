import { calculateReportingTruthScore, classifyReportingTruthStatus, createReportingTruthFinding } from "./reportingTruthEngine.js";
import type { ReportPeriod, ReportingTruthMetric, ReportingTruthReport, ReportingTruthSource } from "./reportingTruthTypes.js";

export type InventoryReportInputs = {
  period: ReportPeriod;
  data?: {
    valuation?: { totalValue: number; negativeStockSkus?: number; missingCostSkus?: number } | null;
    lowStock?: { belowMinCount: number } | null;
  };
};

function sources(): ReportingTruthSource[] {
  return [
    { sourceTable: "inventory_movements", note: "Planned inventory ledger (future) / v309 local models" },
    { sourceTable: "items", note: "Item master and costing configuration" },
    { sourceTable: "posting_batches", note: "Inventory-related postings (v311) when integrated" },
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

export function buildInventoryValuationReport(input: InventoryReportInputs): ReportingTruthReport {
  const baseSources = sources();
  const v = input.data?.valuation ?? null;
  const findings = [];
  const metrics: ReportingTruthMetric[] = [
    { key: "total_value", label: "Inventory value", value: v?.totalValue ?? null, unit: "SAR", sources: baseSources },
    { key: "missing_cost_skus", label: "Missing cost SKUs", value: v?.missingCostSkus ?? null, sources: baseSources },
    { key: "negative_stock_skus", label: "Negative stock SKUs", value: v?.negativeStockSkus ?? null, sources: baseSources },
  ];

  if (!v) {
    findings.push(
      createReportingTruthFinding({
        domain: "inventory",
        severity: "warning",
        message: "Inventory valuation is incomplete: missing cost and movement-ledger aggregates.",
        source: { sourceTable: "inventory_movements" },
        action: "Introduce server-side inventory movement ledger and costing snapshots; then compute valuation by item/store.",
      }),
    );
  } else {
    if ((v.missingCostSkus ?? 0) > 0) {
      findings.push(
        createReportingTruthFinding({
          domain: "inventory",
          severity: "warning",
          message: `${v.missingCostSkus} SKU(s) have missing cost; valuation may be understated.`,
          source: { sourceTable: "items" },
          action: "Ensure every SKU has a cost basis (standard/average/last) before trusting valuation.",
        }),
      );
    }
    if ((v.negativeStockSkus ?? 0) > 0) {
      findings.push(
        createReportingTruthFinding({
          domain: "inventory",
          severity: "critical",
          message: `${v.negativeStockSkus} SKU(s) have negative stock; valuation and COGS are unreliable.`,
          source: { sourceTable: "inventory_movements" },
          action: "Block trusted reporting until negative stock is resolved (counts/adjustments/ledger fixes).",
        }),
      );
    }
  }

  return finalize({
    key: "inventory_valuation",
    title: "Inventory Valuation",
    domain: "inventory",
    period: input.period,
    metrics,
    findings,
    sources: baseSources,
    generatedAt: new Date().toISOString(),
  });
}

export function buildStockMovementReport(input: InventoryReportInputs): ReportingTruthReport {
  const baseSources = sources();
  const findings = [
    createReportingTruthFinding({
      domain: "inventory",
      severity: "warning",
      message: "Stock movement report is a foundation stub: movement ledger extraction is not implemented yet.",
      source: { sourceTable: "inventory_movements" },
      action: "Provide backend queries for receipts/issues/adjustments and link to posting batches where applicable.",
    }),
  ];
  const metrics: ReportingTruthMetric[] = [{ key: "implemented", label: "Implemented", value: false }];
  return finalize({
    key: "stock_movement",
    title: "Stock Movement",
    domain: "inventory",
    period: input.period,
    metrics,
    findings,
    sources: baseSources,
    generatedAt: new Date().toISOString(),
  });
}

export function buildLowStockReport(input: InventoryReportInputs): ReportingTruthReport {
  const baseSources = sources();
  const low = input.data?.lowStock ?? null;
  const findings = [];
  const metrics: ReportingTruthMetric[] = [
    { key: "below_min_count", label: "Below minimum", value: low?.belowMinCount ?? null, sources: baseSources },
  ];
  if (!low) {
    findings.push(
      createReportingTruthFinding({
        domain: "inventory",
        severity: "warning",
        message: "Low stock is incomplete: missing min/max configuration and on-hand calculation.",
        source: { sourceTable: "items" },
        action: "Define reorder thresholds and compute on-hand from movement ledger.",
      }),
    );
  }
  return finalize({
    key: "low_stock",
    title: "Low Stock",
    domain: "inventory",
    period: input.period,
    metrics,
    findings,
    sources: baseSources,
    generatedAt: new Date().toISOString(),
  });
}

export function buildWastageReport(input: InventoryReportInputs): ReportingTruthReport {
  const baseSources = sources();
  const findings = [
    createReportingTruthFinding({
      domain: "inventory",
      severity: "warning",
      message: "Wastage report is incomplete: wastage tagging and cost attribution are not enforced server-side yet.",
      source: { sourceTable: "inventory_movements" },
      action: "Add movement reason codes and costing to classify wastage vs variance vs consumption.",
    }),
  ];
  const metrics: ReportingTruthMetric[] = [{ key: "wastage_value", label: "Wastage value", value: null, unit: "SAR", sources: baseSources }];
  return finalize({
    key: "wastage",
    title: "Wastage",
    domain: "inventory",
    period: input.period,
    metrics,
    findings,
    sources: baseSources,
    generatedAt: new Date().toISOString(),
  });
}

export function buildInventoryVarianceReport(input: InventoryReportInputs): ReportingTruthReport {
  const baseSources = sources();
  const findings = [
    createReportingTruthFinding({
      domain: "inventory",
      severity: "warning",
      message: "Inventory variance is incomplete: stock counts and snapshot valuation are not integrated yet.",
      source: { sourceTable: "inventory_counts" },
      action: "Capture stock counts with audit, compute variances from on-hand ledger, and post adjustments through v311 engine.",
    }),
  ];
  const metrics: ReportingTruthMetric[] = [{ key: "variance_value", label: "Variance value", value: null, unit: "SAR", sources: baseSources }];
  return finalize({
    key: "inventory_variance",
    title: "Inventory Variance",
    domain: "inventory",
    period: input.period,
    metrics,
    findings,
    sources: baseSources,
    generatedAt: new Date().toISOString(),
  });
}
