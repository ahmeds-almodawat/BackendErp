import type {
  ReportComparisonPeriod,
  ReportPeriod,
  ReportingTruthFinding,
  ReportingTruthFindingSeverity,
  ReportingTruthReport,
  ReportingTruthStatus,
} from "./reportingTruthTypes.js";

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function createReportingTruthFinding(input: {
  domain: ReportingTruthFinding["domain"];
  severity: ReportingTruthFindingSeverity;
  message: string;
  source?: ReportingTruthFinding["source"];
  action?: string;
  metadata?: ReportingTruthFinding["metadata"];
  createdAt?: string;
  id?: string;
}): ReportingTruthFinding {
  return {
    id: input.id ?? crypto.randomUUID(),
    domain: input.domain,
    severity: input.severity,
    message: input.message,
    source: input.source,
    action: input.action,
    createdAt: input.createdAt ?? new Date().toISOString(),
    metadata: input.metadata,
  };
}

export function calculateReportingTruthScore(findings: ReportingTruthFinding[]): number {
  const critical = findings.filter((f) => f.severity === "critical").length;
  const warning = findings.filter((f) => f.severity === "warning").length;
  // Rules: critical findings reduce heavily, warnings moderately.
  const score = 100 - critical * 25 - warning * 10;
  return clamp(score, 0, 100);
}

export function classifyReportingTruthStatus(
  score: number,
  criticalCount: number,
  warningCount: number,
): ReportingTruthStatus {
  // Rules:
  // - trusted requires no critical findings and score >= 90
  // - critical for any critical finding or very low score
  // - warning for warnings or moderate score loss
  if (criticalCount > 0 || score < 60) return "critical";
  if (warningCount > 0 || score < 90) return "warning";
  return "trusted";
}

export function summarizeReportingTruth(reports: ReportingTruthReport[]) {
  const findings = reports.flatMap((r) => r.findings);
  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const warningCount = findings.filter((f) => f.severity === "warning").length;
  const infoCount = findings.filter((f) => f.severity === "info").length;

  const rawScore = Math.round(
    reports.reduce((sum, report) => sum + (Number.isFinite(report.truthScore) ? report.truthScore : 0), 0) /
      Math.max(reports.length, 1),
  );

  const penaltyScore = calculateReportingTruthScore(findings);
  const truthScore = clamp(Math.round((rawScore + penaltyScore) / 2), 0, 100);

  const status: ReportingTruthStatus = reports.some((r) => r.status === "incomplete")
    ? "incomplete"
    : classifyReportingTruthStatus(truthScore, criticalCount, warningCount);

  return {
    truthScore,
    status,
    criticalCount,
    warningCount,
    infoCount,
    reports,
    findings,
    generatedAt: new Date().toISOString(),
  };
}

export function compareReportPeriods(current: ReportPeriod, comparison: ReportPeriod): ReportComparisonPeriod {
  return {
    current,
    comparison,
    comparisonLabel: comparison.label ?? "Comparison",
  };
}
