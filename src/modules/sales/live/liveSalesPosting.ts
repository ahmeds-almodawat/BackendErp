export interface LiveSalesPostingRequest {
  batchId: string;
  branchId?: string;
  businessDate: string;
  postCogs?: boolean;
  memo?: string;
}

export function validateLiveSalesPosting(request: LiveSalesPostingRequest) {
  const findings: Array<{ severity: "warning" | "critical"; message: string; action: string }> = [];

  if (!request.batchId) {
    findings.push({ severity: "critical", message: "Sales batch id is required.", action: "Register or select a POS batch before posting." });
  }

  if (!request.businessDate) {
    findings.push({ severity: "critical", message: "Business date is required.", action: "Set business date." });
  }

  if (!request.branchId) {
    findings.push({ severity: "warning", message: "Branch is not selected.", action: "Map POS batch to branch before production posting." });
  }

  if (request.postCogs !== true) {
    findings.push({ severity: "warning", message: "COGS posting is not enabled.", action: "Enable COGS after recipes/inventory consumption are validated." });
  }

  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;

  return {
    ok: criticalCount === 0,
    criticalCount,
    warningCount: findings.filter((finding) => finding.severity === "warning").length,
    findings,
  };
}
