export interface MasterDataLiveImportRequest {
  sourceType: "branches" | "stores" | "suppliers" | "item_categories" | "items" | "chart_accounts";
  fileName: string;
  rowCount: number;
  approvedBy?: string;
  businessReason?: string;
}

export interface MasterDataLiveImportFinding {
  severity: "warning" | "critical";
  message: string;
  action: string;
}

export function validateMasterDataLiveImport(request: MasterDataLiveImportRequest) {
  const findings: MasterDataLiveImportFinding[] = [];

  if (!request.sourceType) {
    findings.push({
      severity: "critical",
      message: "Import source type is required.",
      action: "Select the target master data resource.",
    });
  }

  if (!request.fileName) {
    findings.push({
      severity: "critical",
      message: "Import file name is required.",
      action: "Attach or register the import file.",
    });
  }

  if (!Number.isFinite(request.rowCount) || request.rowCount <= 0) {
    findings.push({
      severity: "critical",
      message: "Import must contain at least one row.",
      action: "Verify the import file content.",
    });
  }

  if (!request.approvedBy) {
    findings.push({
      severity: "warning",
      message: "Import approver is not recorded.",
      action: "Record approval before live cutover.",
    });
  }

  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;

  return {
    ok: criticalCount === 0,
    criticalCount,
    warningCount: findings.filter((finding) => finding.severity === "warning").length,
    findings,
  };
}
