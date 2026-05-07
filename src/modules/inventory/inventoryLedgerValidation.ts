import type {
  InventoryStockMovement,
  InventoryValidationFinding,
  InventoryValidationSummary,
} from "./inventoryBackendTypes";

function required(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

function summarize(findings: InventoryValidationFinding[]): InventoryValidationSummary {
  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;
  const warningCount = findings.filter((finding) => finding.severity === "warning").length;

  return {
    ok: criticalCount === 0,
    criticalCount,
    warningCount,
    findings,
  };
}

export function calculateMovementTotalCost(quantity: number, unitCost: number): number {
  return Number((Math.max(0, quantity) * Math.max(0, unitCost)).toFixed(4));
}

export function validateStockMovement(
  movement: Partial<InventoryStockMovement>,
  options: { currentBalance?: number; allowNegativeStock?: boolean } = {},
): InventoryValidationSummary {
  const findings: InventoryValidationFinding[] = [];

  if (!required(movement.branch_id)) {
    findings.push({
      severity: "critical",
      field: "branch_id",
      message: "Inventory movement must have a branch.",
      action: "Resolve the movement to a branch before posting.",
    });
  }

  if (!required(movement.store_id)) {
    findings.push({
      severity: "critical",
      field: "store_id",
      message: "Inventory movement must have a store.",
      action: "Select the source or destination store.",
    });
  }

  if (!required(movement.item_id)) {
    findings.push({
      severity: "critical",
      field: "item_id",
      message: "Inventory movement must have an item.",
      action: "Select a valid inventory item.",
    });
  }

  if (!required(movement.movement_type)) {
    findings.push({
      severity: "critical",
      field: "movement_type",
      message: "Inventory movement type is required.",
      action: "Set opening, receipt, consumption, transfer, adjustment, wastage, or count variance type.",
    });
  }

  if (!required(movement.direction)) {
    findings.push({
      severity: "critical",
      field: "direction",
      message: "Inventory movement direction is required.",
      action: "Set the movement as in or out.",
    });
  }

  if (!Number.isFinite(movement.quantity) || Number(movement.quantity) <= 0) {
    findings.push({
      severity: "critical",
      field: "quantity",
      message: "Inventory movement quantity must be positive.",
      action: "Correct the movement quantity.",
    });
  }

  if (!Number.isFinite(movement.unit_cost) || Number(movement.unit_cost) < 0) {
    findings.push({
      severity: "critical",
      field: "unit_cost",
      message: "Inventory movement unit cost cannot be negative.",
      action: "Correct the movement unit cost.",
    });
  }

  if (
    movement.direction === "out" &&
    options.allowNegativeStock !== true &&
    Number.isFinite(options.currentBalance) &&
    Number(movement.quantity ?? 0) > Number(options.currentBalance)
  ) {
    findings.push({
      severity: "critical",
      field: "quantity",
      message: "Outbound movement exceeds available stock.",
      action: "Block posting or approve a controlled negative-stock exception.",
    });
  }

  if (!required(movement.source_type) || !required(movement.source_id)) {
    findings.push({
      severity: "warning",
      field: "source",
      message: "Inventory movement should be linked to a source document.",
      action: "Link movement to purchase, sales, production, transfer, adjustment, or count source.",
    });
  }

  return summarize(findings);
}

export function summarizeInventoryMovements(movements: InventoryStockMovement[]) {
  const quantityIn = movements.filter((m) => m.direction === "in").reduce((sum, m) => sum + m.quantity, 0);
  const quantityOut = movements.filter((m) => m.direction === "out").reduce((sum, m) => sum + m.quantity, 0);
  const valueIn = movements.filter((m) => m.direction === "in").reduce((sum, m) => sum + m.total_cost, 0);
  const valueOut = movements.filter((m) => m.direction === "out").reduce((sum, m) => sum + m.total_cost, 0);

  return {
    movementCount: movements.length,
    quantityIn,
    quantityOut,
    netQuantity: quantityIn - quantityOut,
    valueIn,
    valueOut,
    netValue: valueIn - valueOut,
  };
}
