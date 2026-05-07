export type OperationalPostingSource =
  | "purchase_invoice"
  | "supplier_payment"
  | "sales_pos_batch"
  | "inventory_stock_movement"
  | "inventory_adjustment"
  | "production_batch";

export interface OperationalPostingBridgeRequest {
  sourceType: OperationalPostingSource;
  sourceId: string;
  branchId: string;
  fiscalPeriodId?: string;
  requestedBy?: string;
}

export interface OperationalPostingBridgeResult {
  ok: boolean;
  message: string;
  sourceType: OperationalPostingSource;
  sourceId: string;
  requiredRpc: string;
  nextAction: string;
}

export const operationalPostingRpcMap: Record<OperationalPostingSource, string> = {
  purchase_invoice: "purchasing_post_purchase_invoice",
  supplier_payment: "purchasing_post_supplier_payment",
  sales_pos_batch: "sales_post_pos_batch",
  inventory_stock_movement: "inventory_post_stock_movement",
  inventory_adjustment: "inventory_post_stock_movement",
  production_batch: "production_post_batch",
};

export function createOperationalPostingBridgeRequest(input: OperationalPostingBridgeRequest): OperationalPostingBridgeResult {
  const requiredRpc = operationalPostingRpcMap[input.sourceType];

  if (!input.sourceId || !input.branchId) {
    return {
      ok: false,
      message: "Source id and branch id are required before operational posting.",
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      requiredRpc,
      nextAction: "Resolve source document and branch before posting.",
    };
  }

  return {
    ok: true,
    message: "Operational posting bridge is ready.",
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    requiredRpc,
    nextAction: "Call the module-specific server RPC and link the result to the finance posting batch.",
  };
}
