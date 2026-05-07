export interface LiveStockCountLine {
  sku: string;
  itemId?: string;
  systemQuantity: number;
  countedQuantity: number;
  unitCost: number;
  reason?: string;
}

export interface LiveStockCount {
  countNo: string;
  branchId?: string;
  storeId?: string;
  countDate: string;
  lines: LiveStockCountLine[];
}

export function summarizeLiveStockCount(count: LiveStockCount) {
  const varianceQuantity = count.lines.reduce((sum, line) => sum + (Number(line.countedQuantity || 0) - Number(line.systemQuantity || 0)), 0);
  const varianceValue = count.lines.reduce((sum, line) => {
    const variance = Number(line.countedQuantity || 0) - Number(line.systemQuantity || 0);
    return sum + variance * Number(line.unitCost || 0);
  }, 0);

  return {
    lineCount: count.lines.length,
    varianceQuantity,
    varianceValue: Number(varianceValue.toFixed(4)),
  };
}

export function validateLiveStockCount(count: LiveStockCount) {
  const findings: Array<{ severity: "warning" | "critical"; message: string; action: string }> = [];

  if (!count.countNo) {
    findings.push({ severity: "critical", message: "Stock count number is required.", action: "Create a unique count number." });
  }

  if (!count.countDate) {
    findings.push({ severity: "critical", message: "Stock count date is required.", action: "Set count date." });
  }

  if (!count.storeId) {
    findings.push({ severity: "critical", message: "Stock count store is required.", action: "Select store." });
  }

  if (count.lines.length === 0) {
    findings.push({ severity: "critical", message: "Stock count must have at least one line.", action: "Add counted items." });
  }

  for (const line of count.lines) {
    if (!line.sku && !line.itemId) {
      findings.push({ severity: "critical", message: "Stock count line missing SKU/item.", action: "Map every line to an item." });
    }

    if (line.countedQuantity < 0) {
      findings.push({ severity: "critical", message: "Counted quantity cannot be negative.", action: "Correct counted quantity." });
    }

    if (line.unitCost < 0) {
      findings.push({ severity: "critical", message: "Unit cost cannot be negative.", action: "Correct unit cost." });
    }
  }

  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;

  return {
    ok: criticalCount === 0,
    criticalCount,
    warningCount: findings.filter((finding) => finding.severity === "warning").length,
    totals: summarizeLiveStockCount(count),
    findings,
  };
}
