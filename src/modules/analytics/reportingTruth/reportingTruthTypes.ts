export type ReportingTruthDomain =
  | "finance"
  | "inventory"
  | "sales"
  | "purchasing"
  | "production"
  | "management";

export type ReportingTruthStatus = "trusted" | "warning" | "critical" | "incomplete";

export type ReportingTruthFindingSeverity = "info" | "warning" | "critical";

export interface ReportingTruthSource {
  /** Database table name or upstream source name (explainability requirement). */
  sourceTable: string;
  /** Optional entity id (e.g., batch id, file id). */
  sourceId?: string;
  /** Optional note describing how the source is used. */
  note?: string;
}

export interface ReportingTruthFinding {
  id: string;
  domain: ReportingTruthDomain;
  severity: ReportingTruthFindingSeverity;
  message: string;
  source?: ReportingTruthSource;
  action?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface ReportPeriod {
  start: string; // ISO date
  end: string; // ISO date
  fiscalPeriodId?: string;
  branchId?: string;
  label?: string;
}

export interface ReportComparisonPeriod {
  current: ReportPeriod;
  comparison: ReportPeriod;
  comparisonLabel?: string;
}

export interface ReportingTruthMetric {
  key: string;
  label: string;
  value: number | string | boolean | null;
  unit?: string;
  explain?: string;
  sources?: ReportingTruthSource[];
}

export interface ReportingTruthReport {
  key: string;
  title: string;
  domain: ReportingTruthDomain;
  period: ReportPeriod;
  status: ReportingTruthStatus;
  truthScore: number;
  metrics: ReportingTruthMetric[];
  findings: ReportingTruthFinding[];
  sources: ReportingTruthSource[];
  generatedAt: string;
}

export interface ReportingTruthSummary {
  truthScore: number;
  status: ReportingTruthStatus;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  reports: ReportingTruthReport[];
  findings: ReportingTruthFinding[];
  generatedAt: string;
}

