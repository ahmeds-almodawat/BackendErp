import type { SupabaseBrowserClientLike } from "../../../lib/supabase/supabaseClient";
import type { LiveStockCount } from "./liveStockCount";
import { validateLiveStockCount } from "./liveStockCount";

export function createLiveStockCountService(client: SupabaseBrowserClientLike | null) {
  return {
    validate(count: LiveStockCount) {
      return validateLiveStockCount(count);
    },

    async postStockCount(count: LiveStockCount) {
      const validation = validateLiveStockCount(count);

      if (!validation.ok) {
        return {
          ok: false,
          message: "Stock count validation failed.",
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

      const { data, error } = await client.rpc("live_inventory_post_stock_count", {
        count_payload: {
          count_no: count.countNo,
          branch_id: count.branchId ?? null,
          store_id: count.storeId ?? null,
          count_date: count.countDate,
        },
        lines_payload: count.lines.map((line) => ({
          sku: line.sku,
          item_id: line.itemId ?? null,
          system_quantity: line.systemQuantity,
          counted_quantity: line.countedQuantity,
          unit_cost: line.unitCost,
          reason: line.reason ?? null,
        })),
      });

      return error
        ? { ok: false, message: "Stock count posting failed.", error: error.message }
        : { ok: true, message: "Stock count posted.", data };
    },
  };
}
