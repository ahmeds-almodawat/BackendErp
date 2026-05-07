export type LiveCutoverStatus = "draft" | "validated" | "approved" | "posted" | "blocked" | "cancelled";

export interface LiveMasterDataCutoverRequest {
  resource: "branches" | "stores" | "suppliers" | "item_categories" | "items" | "chart_accounts";
  sourceFileId?: string;
  approvedBy?: string;
  notes?: string;
}

export interface LiveCutoverFinding {
  severity: "warning" | "critical";
  message: string;
  action: string;
  resource?: string;
}

export interface LiveCutoverResult<T = unknown> {
  ok: boolean;
  status: LiveCutoverStatus;
  message: string;
  data?: T;
  findings: LiveCutoverFinding[];
}

export function validateLiveMasterDataCutover(request: LiveMasterDataCutoverRequest): LiveCutoverResult {
  const findings: LiveCutoverFinding[] = [];

  if (!request.resource) {
    findings.push({
      severity: "critical",
      message: "Master data resource is required.",
      action: "Select branches, stores, suppliers, categories, items, or chart accounts.",
    });
  }

  if (!request.approvedBy) {
    findings.push({
      severity: "warning",
      message: "Cutover approver is not recorded.",
      action: "Record approval before official posting.",
      resource: request.resource,
    });
  }

  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;

  return {
    ok: criticalCount === 0,
    status: criticalCount > 0 ? "blocked" : "validated",
    message: criticalCount > 0 ? "Master data cutover is blocked." : "Master data cutover is ready for approval.",
    findings,
  };
}
