import { BaseSupabaseRepository } from "../../lib/repositories/baseSupabaseRepository";
import type { SupabaseClientLike } from "../../lib/dataProvider/supabaseProvider";
import type {
  InventoryAdjustmentRequest,
  InventoryStockBalance,
  InventoryStockMovement,
} from "./inventoryBackendTypes";

export const inventoryBackendTables = {
  stockMovements: "inventory_stock_movements",
  stockBalances: "inventory_stock_balances",
  adjustmentRequests: "inventory_adjustment_requests",
  stockCounts: "inventory_stock_counts",
  stockCountLines: "inventory_stock_count_lines",
} as const;

export function createInventoryRepositories(client: SupabaseClientLike) {
  return {
    stockMovements: new BaseSupabaseRepository<InventoryStockMovement>(client, inventoryBackendTables.stockMovements),
    stockBalances: new BaseSupabaseRepository<InventoryStockBalance>(client, inventoryBackendTables.stockBalances),
    adjustmentRequests: new BaseSupabaseRepository<InventoryAdjustmentRequest>(client, inventoryBackendTables.adjustmentRequests),
  };
}
