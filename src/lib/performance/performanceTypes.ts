export type PerformanceRiskLevel = "low" | "medium" | "high" | "critical";
export type PerformanceStatus = "good" | "warning" | "critical" | "unknown";

export interface RoutePerformanceProfile {
  routeKey: string;
  label: string;
  estimatedBundleKb?: number;
  lazyLoaded: boolean;
  status: PerformanceStatus;
  findings: BundleRiskFinding[];
}

export interface TablePerformanceProfile {
  tableKey: string;
  rowCount: number;
  usesServerPagination: boolean;
  usesVirtualization: boolean;
  status: PerformanceStatus;
  findings: BundleRiskFinding[];
}

export interface PaginationState {
  page: number;
  pageSize: number;
  totalRows: number;
}

export interface ServerPaginationRequest {
  page: number;
  pageSize: number;
  search?: string;
  sortKey?: string;
  sortDirection?: "asc" | "desc";
  filters?: Record<string, unknown>;
}

export interface ServerPaginationResult<T> {
  rows: T[];
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
}

export interface VirtualizationRecommendation {
  shouldPaginate: boolean;
  shouldVirtualize: boolean;
  reason: string;
}

export interface BundleRiskFinding {
  id: string;
  riskLevel: PerformanceRiskLevel;
  status: PerformanceStatus;
  message: string;
  recommendation: string;
}
