export interface LivePurchaseReceiptLine {
  sku: string;
  itemId?: string;
  quantity: number;
  unitCost: number;
  lotNo?: string;
  expiryDate?: string;
}

export interface LivePurchaseReceipt {
  receiptNo: string;
  supplierId?: string;
  branchId?: string;
  storeId?: string;
  receiptDate: string;
  purchaseInvoiceId?: string;
  lines: LivePurchaseReceiptLine[];
}

export function validateLivePurchaseReceipt(receipt: LivePurchaseReceipt) {
  const findings: Array<{ severity: "warning" | "critical"; message: string; action: string }> = [];

  if (!receipt.receiptNo) {
    findings.push({ severity: "critical", message: "Purchase receipt number is required.", action: "Create a unique receipt number." });
  }

  if (!receipt.receiptDate) {
    findings.push({ severity: "critical", message: "Receipt date is required.", action: "Set receipt date." });
  }

  if (!receipt.storeId) {
    findings.push({ severity: "critical", message: "Receipt store is required.", action: "Select receiving store." });
  }

  if (!receipt.branchId) {
    findings.push({ severity: "warning", message: "Branch is not selected.", action: "Map receipt to branch." });
  }

  if (receipt.lines.length === 0) {
    findings.push({ severity: "critical", message: "Purchase receipt must have at least one line.", action: "Add received items." });
  }

  for (const line of receipt.lines) {
    if (!line.sku && !line.itemId) {
      findings.push({ severity: "critical", message: "Receipt line missing SKU/item.", action: "Map every line to an item." });
    }

    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      findings.push({ severity: "critical", message: "Receipt quantity must be positive.", action: "Correct quantity." });
    }

    if (!Number.isFinite(line.unitCost) || line.unitCost < 0) {
      findings.push({ severity: "critical", message: "Receipt unit cost cannot be negative.", action: "Correct unit cost." });
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
