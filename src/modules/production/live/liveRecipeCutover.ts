export interface LiveRecipeLine {
  ingredientSku?: string;
  ingredientItemId?: string;
  quantity: number;
  wastagePercent: number;
}

export interface LiveRecipe {
  recipeCode: string;
  nameEn: string;
  nameAr: string;
  outputSku?: string;
  outputItemId?: string;
  baseOutputQuantity: number;
  lines: LiveRecipeLine[];
}

export function validateLiveRecipe(recipe: LiveRecipe) {
  const findings: Array<{ severity: "warning" | "critical"; message: string; action: string }> = [];

  if (!recipe.recipeCode) {
    findings.push({ severity: "critical", message: "Recipe code is required.", action: "Create a unique recipe code." });
  }

  if (!recipe.nameEn || !recipe.nameAr) {
    findings.push({ severity: "critical", message: "Recipe English and Arabic names are required.", action: "Complete bilingual recipe names." });
  }

  if (!recipe.outputSku && !recipe.outputItemId) {
    findings.push({ severity: "critical", message: "Recipe output item is required.", action: "Map recipe to output item." });
  }

  if (!Number.isFinite(recipe.baseOutputQuantity) || recipe.baseOutputQuantity <= 0) {
    findings.push({ severity: "critical", message: "Recipe base output quantity must be positive.", action: "Set valid output quantity." });
  }

  if (recipe.lines.length === 0) {
    findings.push({ severity: "critical", message: "Recipe must have ingredient lines.", action: "Add ingredients." });
  }

  for (const line of recipe.lines) {
    if (!line.ingredientSku && !line.ingredientItemId) {
      findings.push({ severity: "critical", message: "Ingredient line missing SKU/item.", action: "Map every ingredient to an item." });
    }

    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      findings.push({ severity: "critical", message: "Ingredient quantity must be positive.", action: "Correct ingredient quantity." });
    }

    if (line.wastagePercent < 0) {
      findings.push({ severity: "critical", message: "Wastage percent cannot be negative.", action: "Correct wastage percent." });
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
