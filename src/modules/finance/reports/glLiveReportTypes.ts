export interface GlReportRequest {
  reportType: "trial_balance" | "general_ledger" | "income_statement" | "balance_sheet" | "cash_bank_summary";
  periodStart: string;
  periodEnd: string;
  branchId?: string;
}

export interface GlReportFinding {
  severity: "info" | "warning" | "critical";
  message: string;
  action: string;
}

export function validateGlReportRequest(request: GlReportRequest) {
  const findings: GlReportFinding[] = [];

  if (!request.reportType) {
    findings.push({ severity: "critical", message: "Report type is required.", action: "Select a GL report type." });
  }

  if (!request.periodStart || !request.periodEnd) {
    findings.push({ severity: "critical", message: "Report period is required.", action: "Select start and end date." });
  }

  if (request.periodStart && request.periodEnd && new Date(request.periodStart) > new Date(request.periodEnd)) {
    findings.push({ severity: "critical", message: "Report start date is after end date.", action: "Correct report period." });
  }

  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;

  return {
    ok: criticalCount === 0,
    criticalCount,
    warningCount: findings.filter((finding) => finding.severity === "warning").length,
    findings,
  };
}
