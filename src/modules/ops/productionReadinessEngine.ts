import type {
  ProductionReadinessArea,
  ProductionReadinessCheck,
  ProductionReadinessFinding,
  ProductionReadinessSeverity,
  ProductionReadinessStatus,
} from "./productionReadinessTypes";

function createId(): string {
  return `prd-${Math.random().toString(36).slice(2, 10)}`;
}

export function createProductionReadinessFinding(input: {
  area: ProductionReadinessArea;
  severity: ProductionReadinessSeverity;
  message: string;
  action: string;
}): ProductionReadinessFinding {
  return {
    id: createId(),
    area: input.area,
    severity: input.severity,
    message: input.message,
    action: input.action,
  };
}

export function createProductionReadinessCheck(input: ProductionReadinessCheck): ProductionReadinessCheck {
  return input;
}

export function calculateProductionReadinessScore(findings: ProductionReadinessFinding[]): number {
  const critical = findings.filter((finding) => finding.severity === "critical").length;
  const warning = findings.filter((finding) => finding.severity === "warning").length;
  return Math.max(0, Math.min(100, 100 - critical * 25 - warning * 8));
}

export function classifyProductionReadinessStatus(score: number, criticalCount: number): ProductionReadinessStatus {
  if (criticalCount > 0 || score < 70) return "blocked";
  if (score < 90) return "warning";
  return "ready";
}

export function summarizeBlockedAreas(findings: ProductionReadinessFinding[]): ProductionReadinessArea[] {
  return Array.from(new Set(findings.filter((finding) => finding.severity === "critical").map((finding) => finding.area)));
}

export function evaluateProductionReadiness(checks: ProductionReadinessCheck[], findings: ProductionReadinessFinding[] = []) {
  const automaticFindings = checks
    .filter((check) => check.requiredForGoLive && check.status !== "ready")
    .map((check) =>
      createProductionReadinessFinding({
        area: check.area,
        severity: check.status === "blocked" ? "critical" : "warning",
        message: `${check.label} is ${check.status}.`,
        action: "Resolve this check before production go-live.",
      }),
    );

  const allFindings = [...findings, ...automaticFindings];
  const criticalCount = allFindings.filter((finding) => finding.severity === "critical").length;
  const warningCount = allFindings.filter((finding) => finding.severity === "warning").length;
  const readinessScore = calculateProductionReadinessScore(allFindings);

  return {
    readinessScore,
    status: classifyProductionReadinessStatus(readinessScore, criticalCount),
    criticalCount,
    warningCount,
    blockedAreas: summarizeBlockedAreas(allFindings),
    findings: allFindings,
  };
}
