export interface LiveVatSettlementRequest {
  settlementNo: string;
  periodStart: string;
  periodEnd: string;
  branchId?: string;
  reviewedBy?: string;
}

export interface LiveVatAdjustment {
  sourceId?: string;
  direction: "input" | "output";
  taxableAmount: number;
  vatAmount: number;
  reason: string;
}

export function validateLiveVatSettlement(request: LiveVatSettlementRequest) {
  const findings: Array<{ severity: "warning" | "critical"; message: string; action: string }> = [];

  if (!request.settlementNo) {
    findings.push({ severity: "critical", message: "VAT settlement number is required.", action: "Create a unique VAT settlement number." });
  }

  if (!request.periodStart || !request.periodEnd) {
    findings.push({ severity: "critical", message: "VAT settlement period is required.", action: "Set period start and end dates." });
  }

  if (request.periodStart && request.periodEnd && new Date(request.periodStart) > new Date(request.periodEnd)) {
    findings.push({ severity: "critical", message: "VAT period start is after end date.", action: "Correct the VAT period." });
  }

  if (!request.reviewedBy) {
    findings.push({ severity: "warning", message: "VAT reviewer is not recorded.", action: "Record finance/tax reviewer before official submission." });
  }

  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;

  return {
    ok: criticalCount === 0,
    criticalCount,
    warningCount: findings.filter((finding) => finding.severity === "warning").length,
    findings,
  };
}

export function validateLiveVatAdjustment(adjustment: LiveVatAdjustment) {
  const findings: Array<{ severity: "warning" | "critical"; message: string; action: string }> = [];

  if (!adjustment.direction) {
    findings.push({ severity: "critical", message: "VAT adjustment direction is required.", action: "Select input or output VAT." });
  }

  if (!Number.isFinite(adjustment.taxableAmount)) {
    findings.push({ severity: "critical", message: "Taxable amount must be numeric.", action: "Correct taxable amount." });
  }

  if (!Number.isFinite(adjustment.vatAmount)) {
    findings.push({ severity: "critical", message: "VAT amount must be numeric.", action: "Correct VAT amount." });
  }

  if (!adjustment.reason) {
    findings.push({ severity: "critical", message: "VAT adjustment reason is required.", action: "Add a reason for audit trail." });
  }

  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;

  return {
    ok: criticalCount === 0,
    criticalCount,
    warningCount: findings.filter((finding) => finding.severity === "warning").length,
    findings,
  };
}
