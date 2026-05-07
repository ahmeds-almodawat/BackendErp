export interface LiveSupplierPayment {
  paymentNo: string;
  supplierId?: string;
  branchId?: string;
  paymentDate: string;
  amount: number;
  method: "cash" | "bank" | "card" | "transfer";
  accountCode: string;
  memo?: string;
}

export function validateLiveSupplierPayment(payment: LiveSupplierPayment) {
  const findings: Array<{ severity: "warning" | "critical"; message: string; action: string }> = [];

  if (!payment.paymentNo) {
    findings.push({ severity: "critical", message: "Payment number is required.", action: "Create a unique payment number." });
  }

  if (!payment.supplierId) {
    findings.push({ severity: "critical", message: "Supplier is required.", action: "Select supplier." });
  }

  if (!payment.branchId) {
    findings.push({ severity: "critical", message: "Branch is required.", action: "Map payment to branch." });
  }

  if (!payment.paymentDate) {
    findings.push({ severity: "critical", message: "Payment date is required.", action: "Set payment date." });
  }

  if (!payment.accountCode) {
    findings.push({ severity: "critical", message: "Payment account code is required.", action: "Select cash or bank account." });
  }

  if (!Number.isFinite(payment.amount) || payment.amount <= 0) {
    findings.push({ severity: "critical", message: "Payment amount must be positive.", action: "Correct payment amount." });
  }

  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;

  return {
    ok: criticalCount === 0,
    criticalCount,
    warningCount: findings.filter((finding) => finding.severity === "warning").length,
    findings,
  };
}
