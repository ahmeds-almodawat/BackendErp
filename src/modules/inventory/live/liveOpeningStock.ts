export interface LiveOpeningStockLine {
  sku: string;
  itemId?: string;
  storeId?: string;
  quantity: number;
  unitCost: number;
  lotNo?: string;
  expiryDate?: string;
  memo?: string;
}

export interface LiveOpeningStockBatch {
  batchNo: string;
  branchId?: string;
  storeId?: string;
  openingDate: string;
  fiscalPeriodId?: string;
  lines: LiveOpeningStockLine[];
}

export function summarizeOpeningStockBatch(batch: LiveOpeningStockBatch) {
  const totalQuantity = batch.lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  const totalValue = batch.lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitCost || 0), 0);

  return {
    lineCount: batch.lines.length,
    totalQuantity,
    totalValue: Number(totalValue.toFixed(4)),
  };
}

export function validateLiveOpeningStockBatch(batch: LiveOpeningStockBatch) {
  const findings: Array<{ severity: "warning" | "critical"; message: string; action: string }> = [];

  if (!batch.batchNo) {
    findings.push({ severity: "critical", message: "Opening stock batch number is required.", action: "Create a unique batch number." });
  }

  if (!batch.openingDate) {
    findings.push({ severity: "critical", message: "Opening stock date is required.", action: "Set opening stock date." });
  }

  if (!batch.branchId) {
    findings.push({ severity: "warning", message: "Branch is not selected.", action: "Map opening stock to branch before production cutover." });
  }

  if (!batch.storeId) {
    findings.push({ severity: "warning", message: "Default store is not selected.", action: "Map opening stock to store before production cutover." });
  }

  if (batch.lines.length === 0) {
    findings.push({ severity: "critical", message: "Opening stock must have at least one line.", action: "Add stock lines." });
  }

  for (const line of batch.lines) {
    if (!line.sku && !line.itemId) {
      findings.push({ severity: "critical", message: "Opening stock line missing SKU/item.", action: "Map every line to an item." });
    }

    if (!Number.isFinite(line.quantity) || line.quantity < 0) {
      findings.push({ severity: "critical", message: "Opening stock quantity cannot be negative.", action: "Correct quantity." });
    }

    if (!Number.isFinite(line.unitCost) || line.unitCost < 0) {
      findings.push({ severity: "critical", message: "Opening stock unit cost cannot be negative.", action: "Correct unit cost." });
    }
  }

  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;

  return {
    ok: criticalCount === 0,
    criticalCount,
    warningCount: findings.filter((finding) => finding.severity === "warning").length,
    totals: summarizeOpeningStockBatch(batch),
    findings,
  };
}
