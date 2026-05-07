import type { SupabaseBrowserClientLike } from "../../../lib/supabase/supabaseClient";
import type { LiveProductionBatch } from "./liveProductionBatch";
import { validateLiveProductionBatch } from "./liveProductionBatch";

export function createLiveProductionBatchService(client: SupabaseBrowserClientLike | null) {
  return {
    validate(batch: LiveProductionBatch) {
      return validateLiveProductionBatch(batch);
    },

    async postProductionBatch(batch: LiveProductionBatch) {
      const validation = validateLiveProductionBatch(batch);

      if (!validation.ok) {
        return {
          ok: false,
          message: "Production batch validation failed.",
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

      const { data, error } = await client.rpc("live_production_post_batch", {
        batch_payload: {
          batch_no: batch.batchNo,
          branch_id: batch.branchId ?? null,
          source_store_id: batch.sourceStoreId ?? null,
          destination_store_id: batch.destinationStoreId ?? null,
          recipe_code: batch.recipeCode ?? null,
          recipe_id: batch.recipeId ?? null,
          output_sku: batch.outputSku ?? null,
          output_item_id: batch.outputItemId ?? null,
          planned_output_quantity: batch.plannedOutputQuantity,
          actual_output_quantity: batch.actualOutputQuantity,
          production_date: batch.productionDate,
        },
        ingredient_lines_payload: batch.ingredientLines.map((line) => ({
          ingredient_sku: line.ingredientSku ?? null,
          ingredient_item_id: line.ingredientItemId ?? null,
          planned_quantity: line.plannedQuantity,
          actual_quantity: line.actualQuantity,
          unit_cost: line.unitCost,
        })),
      });

      return error
        ? { ok: false, message: "Production batch posting failed.", error: error.message }
        : { ok: true, message: "Production batch posted.", data };
    },
  };
}
