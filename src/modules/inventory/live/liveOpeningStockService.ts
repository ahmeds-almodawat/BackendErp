import type { SupabaseBrowserClientLike } from "../../../lib/supabase/supabaseClient";
import type { LiveOpeningStockBatch } from "./liveOpeningStock";
import { validateLiveOpeningStockBatch } from "./liveOpeningStock";

export function createLiveOpeningStockService(client: SupabaseBrowserClientLike | null) {
  return {
    validate(batch: LiveOpeningStockBatch) {
      return validateLiveOpeningStockBatch(batch);
    },

    async postOpeningStock(batch: LiveOpeningStockBatch) {
      const validation = validateLiveOpeningStockBatch(batch);

      if (!validation.ok) {
        return {
          ok: false,
          message: "Opening stock validation failed.",
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

      const { data, error } = await client.rpc("live_inventory_post_opening_stock", {
        batch_payload: {
          batch_no: batch.batchNo,
          branch_id: batch.branchId ?? null,
          store_id: batch.storeId ?? null,
          opening_date: batch.openingDate,
          fiscal_period_id: batch.fiscalPeriodId ?? null,
        },
        lines_payload: batch.lines.map((line) => ({
          sku: line.sku,
          item_id: line.itemId ?? null,
          store_id: line.storeId ?? batch.storeId ?? null,
          quantity: line.quantity,
          unit_cost: line.unitCost,
          lot_no: line.lotNo ?? null,
          expiry_date: line.expiryDate ?? null,
          memo: line.memo ?? null,
        })),
      });

      return error
        ? { ok: false, message: "Opening stock posting failed.", error: error.message }
        : { ok: true, message: "Opening stock posted.", data };
    },
  };
}
