export interface LiveProductionIngredientLine {
  ingredientSku?: string;
  ingredientItemId?: string;
  plannedQuantity: number;
  actualQuantity: number;
  unitCost: number;
}

export interface LiveProductionBatch {
  batchNo: string;
  branchId?: string;
  sourceStoreId?: string;
  destinationStoreId?: string;
  recipeCode?: string;
  recipeId?: string;
  outputSku?: string;
  outputItemId?: string;
  plannedOutputQuantity: number;
  actualOutputQuantity: number;
  productionDate: string;
  ingredientLines: LiveProductionIngredientLine[];
}

export function summarizeLiveProductionBatch(batch: LiveProductionBatch) {
  const plannedInputValue = batch.ingredientLines.reduce((sum, line) => sum + Number(line.plannedQuantity || 0) * Number(line.unitCost || 0), 0);
  const actualInputValue = batch.ingredientLines.reduce((sum, line) => sum + Number(line.actualQuantity || 0) * Number(line.unitCost || 0), 0);
  const outputVariance = Number((Number(batch.actualOutputQuantity || 0) - Number(batch.plannedOutputQuantity || 0)).toFixed(4));
  const inputValueVariance = Number((actualInputValue - plannedInputValue).toFixed(4));

  return {
    ingredientLineCount: batch.ingredientLines.length,
    plannedInputValue: Number(plannedInputValue.toFixed(4)),
    actualInputValue: Number(actualInputValue.toFixed(4)),
    outputVariance,
    inputValueVariance,
  };
}

export function validateLiveProductionBatch(batch: LiveProductionBatch) {
  const findings: Array<{ severity: "warning" | "critical"; message: string; action: string }> = [];

  if (!batch.batchNo) {
    findings.push({ severity: "critical", message: "Production batch number is required.", action: "Create a unique production batch number." });
  }

  if (!batch.productionDate) {
    findings.push({ severity: "critical", message: "Production date is required.", action: "Set production date." });
  }

  if (!batch.sourceStoreId) {
    findings.push({ severity: "critical", message: "Source store is required.", action: "Select ingredient source store." });
  }

  if (!batch.destinationStoreId) {
    findings.push({ severity: "critical", message: "Destination store is required.", action: "Select output destination store." });
  }

  if (!batch.outputSku && !batch.outputItemId) {
    findings.push({ severity: "critical", message: "Output item is required.", action: "Map production output item." });
  }

  if (!Number.isFinite(batch.actualOutputQuantity) || batch.actualOutputQuantity <= 0) {
    findings.push({ severity: "critical", message: "Actual output quantity must be positive.", action: "Enter actual output quantity." });
  }

  if (batch.ingredientLines.length === 0) {
    findings.push({ severity: "critical", message: "Production batch must have ingredient lines.", action: "Add ingredient consumption lines." });
  }

  for (const line of batch.ingredientLines) {
    if (!line.ingredientSku && !line.ingredientItemId) {
      findings.push({ severity: "critical", message: "Ingredient line missing SKU/item.", action: "Map every ingredient to an item." });
    }

    if (line.actualQuantity < 0) {
      findings.push({ severity: "critical", message: "Actual ingredient quantity cannot be negative.", action: "Correct ingredient quantity." });
    }

    if (line.unitCost < 0) {
      findings.push({ severity: "critical", message: "Ingredient unit cost cannot be negative.", action: "Correct unit cost." });
    }
  }

  const totals = summarizeLiveProductionBatch(batch);

  if (batch.plannedOutputQuantity > 0) {
    const outputVariancePercent = Math.abs(totals.outputVariance / batch.plannedOutputQuantity) * 100;

    if (outputVariancePercent > 10) {
      findings.push({
        severity: "warning",
        message: `Production output variance is ${outputVariancePercent.toFixed(1)}%.`,
        action: "Review recipe, wastage, and actual production output.",
      });
    }
  }

  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;

  return {
    ok: criticalCount === 0,
    criticalCount,
    warningCount: findings.filter((finding) => finding.severity === "warning").length,
    totals,
    findings,
  };
}
