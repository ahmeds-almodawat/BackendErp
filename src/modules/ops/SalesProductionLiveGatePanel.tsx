import { StatusBadge } from "../../components/common/StatusBadge";
import { validateLivePosImport } from "../sales/live/livePosImport";
import { validateLiveRecipe } from "../production/live/liveRecipeCutover";
import { validateLiveProductionBatch } from "../production/live/liveProductionBatch";

export function SalesProductionLiveGatePanel() {
  const pos = validateLivePosImport({
    batchNo: "POS-DEMO",
    branchId: "branch-demo",
    businessDate: "2026-01-01",
    sourceSystem: "foodics",
    productLines: [
      { productCode: "PIZZA", quantity: 2, grossSales: 100, discountAmount: 0, refundAmount: 0, taxAmount: 15, netSales: 100 },
    ],
    paymentLines: [{ paymentMethod: "card", amount: 115 }],
  });

  const recipe = validateLiveRecipe({
    recipeCode: "REC-DEMO",
    nameEn: "Demo Recipe",
    nameAr: "???? ???????",
    outputSku: "OUT-001",
    baseOutputQuantity: 1,
    lines: [{ ingredientSku: "ING-001", quantity: 1, wastagePercent: 0 }],
  });

  const production = validateLiveProductionBatch({
    batchNo: "PROD-DEMO",
    branchId: "branch-demo",
    sourceStoreId: "store-demo",
    destinationStoreId: "store-demo",
    outputSku: "OUT-001",
    plannedOutputQuantity: 10,
    actualOutputQuantity: 10,
    productionDate: "2026-01-01",
    ingredientLines: [{ ingredientSku: "ING-001", plannedQuantity: 10, actualQuantity: 10, unitCost: 2 }],
  });

  const blocked = [pos, recipe, production].filter((item) => !item.ok).length;
  const status = blocked > 0 ? "blocked" : "ready";

  return (
    <div className="rounded-2xl border bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Sales + Production Live Gate</h3>
        <StatusBadge label={status} variant={status === "ready" ? "success" : "critical"} />
      </div>

      <p className="mt-3 text-sm text-slate-600">
        v345-v348 prepares POS import, sales posting, recipe cutover, and production batch live posting.
      </p>

      <div className="mt-4 grid gap-2 text-sm text-slate-700">
        <div>POS import: {pos.ok ? "ready" : "blocked"}</div>
        <div>Recipe cutover: {recipe.ok ? "ready" : "blocked"}</div>
        <div>Production batch: {production.ok ? "ready" : "blocked"}</div>
      </div>
    </div>
  );
}
