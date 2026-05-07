import type {
  BundleRiskFinding,
  PerformanceRiskLevel,
  PerformanceStatus,
  ServerPaginationRequest,
  VirtualizationRecommendation,
} from "./performanceTypes";

function id(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function classifyBundleRisk(sizeKb: number): PerformanceStatus {
  if (!Number.isFinite(sizeKb)) return "unknown";
  if (sizeKb >= 800) return "critical";
  if (sizeKb > 500) return "warning";
  return "good";
}

export function createPaginationRequest(input: Partial<ServerPaginationRequest> = {}): ServerPaginationRequest {
  return {
    page: Math.max(1, input.page ?? 1),
    pageSize: Math.min(Math.max(1, input.pageSize ?? 25), 250),
    search: input.search,
    sortKey: input.sortKey,
    sortDirection: input.sortDirection ?? "asc",
    filters: input.filters ?? {},
  };
}

export function calculateTotalPages(totalRows: number, pageSize: number): number {
  return Math.max(1, Math.ceil(Math.max(0, totalRows) / Math.max(1, pageSize)));
}

export function shouldUseVirtualization(rowCount: number): VirtualizationRecommendation {
  if (rowCount > 3000) {
    return {
      shouldPaginate: true,
      shouldVirtualize: true,
      reason: "More than 3,000 rows should use server pagination and table virtualization.",
    };
  }

  if (rowCount > 1000) {
    return {
      shouldPaginate: true,
      shouldVirtualize: false,
      reason: "More than 1,000 rows should use server-side pagination in production.",
    };
  }

  return {
    shouldPaginate: false,
    shouldVirtualize: false,
    reason: "Row count is currently safe for a simple table.",
  };
}

export function createPerformanceFinding(input: {
  riskLevel: PerformanceRiskLevel;
  status?: PerformanceStatus;
  message: string;
  recommendation: string;
}): BundleRiskFinding {
  return {
    id: id("perf"),
    riskLevel: input.riskLevel,
    status: input.status ?? (input.riskLevel === "critical" ? "critical" : input.riskLevel === "low" ? "good" : "warning"),
    message: input.message,
    recommendation: input.recommendation,
  };
}

export function summarizePerformanceRisks(findings: BundleRiskFinding[]) {
  const criticalCount = findings.filter((finding) => finding.riskLevel === "critical").length;
  const warningCount = findings.filter((finding) => finding.riskLevel === "high" || finding.riskLevel === "medium").length;
  const status: PerformanceStatus = criticalCount > 0 ? "critical" : warningCount > 0 ? "warning" : "good";

  return {
    status,
    criticalCount,
    warningCount,
    findingCount: findings.length,
  };
}
