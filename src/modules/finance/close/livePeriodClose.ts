export interface LivePeriodCloseRequest {
  closeNo: string;
  fiscalPeriodId: string;
  branchId?: string;
  requestedBy?: string;
  backupConfirmed: boolean;
  trialBalanceBalanced: boolean;
  inventoryReconciled: boolean;
  apReconciled: boolean;
  arReconciled: boolean;
  bankReconciled: boolean;
  vatReviewed: boolean;
}

export function validateLivePeriodClose(request: LivePeriodCloseRequest) {
  const findings: Array<{ severity: "warning" | "critical"; message: string; action: string }> = [];

  if (!request.closeNo) {
    findings.push({ severity: "critical", message: "Close run number is required.", action: "Create a unique period close reference." });
  }

  if (!request.fiscalPeriodId) {
    findings.push({ severity: "critical", message: "Fiscal period is required.", action: "Select the period to close." });
  }

  if (!request.requestedBy) {
    findings.push({ severity: "warning", message: "Close requester is not recorded.", action: "Record the finance user requesting close." });
  }

  const requiredChecks: Array<[boolean, string, string]> = [
    [request.backupConfirmed, "Backup must be confirmed before period close.", "Confirm backup and restore readiness."],
    [request.trialBalanceBalanced, "Trial balance must be balanced before period close.", "Resolve GL imbalance."],
    [request.inventoryReconciled, "Inventory must be reconciled before period close.", "Reconcile stock valuation to GL."],
    [request.apReconciled, "AP must be reconciled before period close.", "Reconcile supplier subledger to GL."],
    [request.arReconciled, "AR must be reconciled before period close.", "Reconcile customer subledger to GL."],
    [request.bankReconciled, "Bank must be reconciled before period close.", "Complete bank reconciliation."],
    [request.vatReviewed, "VAT must be reviewed before period close.", "Review VAT summary and settlement."],
  ];

  for (const [ok, message, action] of requiredChecks) {
    if (!ok) {
      findings.push({ severity: "critical", message, action });
    }
  }

  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;

  return {
    ok: criticalCount === 0,
    criticalCount,
    warningCount: findings.filter((finding) => finding.severity === "warning").length,
    findings,
  };
}
