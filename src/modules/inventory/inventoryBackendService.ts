import type { SupabaseBrowserClientLike } from "../../lib/supabase/supabaseClient";
import type { InventoryStockMovement } from "./inventoryBackendTypes";
import { validateStockMovement } from "./inventoryLedgerValidation";

export interface InventoryBackendServiceResult<T = unknown> {
  ok: boolean;
  message: string;
  data?: T;
  error?: string;
}

export function createInventoryBackendService(client: SupabaseBrowserClientLike | null) {
  return {
    async validateMovement(movement: Partial<InventoryStockMovement>, currentBalance?: number) {
      const validation = validateStockMovement(movement, { currentBalance });

      return {
        ok: validation.ok,
        message: validation.ok ? "Inventory movement validated." : "Inventory movement has blocking findings.",
        data: validation,
      };
    },

    async createMovement(movement: Partial<InventoryStockMovement>): Promise<InventoryBackendServiceResult> {
      const validation = validateStockMovement(movement);

      if (!validation.ok) {
        return {
          ok: false,
          message: "Inventory movement validation failed.",
          data: validation,
          error: "VALIDATION_FAILED",
        };
      }

      if (!client) {
        return {
          ok: false,
          message: "Supabase client is not configured.",
          error: "MISSING_SUPABASE_CLIENT",
        };
      }

      const { data, error } = await client
        .from("inventory_stock_movements")
        .insert({
          ...movement,
          total_cost: Number(movement.quantity ?? 0) * Number(movement.unit_cost ?? 0),
        })
        .select("*")
        .single();

      return error
        ? { ok: false, message: "Inventory movement creation failed.", error: error.message }
        : { ok: true, message: "Inventory movement created.", data };
    },

    async validateAdjustment(adjustmentId: string): Promise<InventoryBackendServiceResult> {
      if (!client) {
        return {
          ok: false,
          message: "Supabase client is not configured.",
          error: "MISSING_SUPABASE_CLIENT",
        };
      }

      const { data, error } = await client.rpc("inventory_validate_adjustment", { adjustment_id: adjustmentId });

      return error
        ? { ok: false, message: "Adjustment validation failed.", error: error.message }
        : { ok: true, message: "Adjustment validation completed.", data };
    },

    async postStockMovement(movementId: string): Promise<InventoryBackendServiceResult> {
      if (!client) {
        return {
          ok: false,
          message: "Supabase client is not configured.",
          error: "MISSING_SUPABASE_CLIENT",
        };
      }

      const { data, error } = await client.rpc("inventory_post_stock_movement", { movement_id: movementId });

      return error
        ? { ok: false, message: "Stock movement posting failed.", error: error.message }
        : { ok: true, message: "Stock movement posted.", data };
    },
  };
}
