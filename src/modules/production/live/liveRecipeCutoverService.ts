import type { SupabaseBrowserClientLike } from "../../../lib/supabase/supabaseClient";
import type { LiveRecipe } from "./liveRecipeCutover";
import { validateLiveRecipe } from "./liveRecipeCutover";

export function createLiveRecipeCutoverService(client: SupabaseBrowserClientLike | null) {
  return {
    validate(recipe: LiveRecipe) {
      return validateLiveRecipe(recipe);
    },

    async upsertRecipe(recipe: LiveRecipe) {
      const validation = validateLiveRecipe(recipe);

      if (!validation.ok) {
        return {
          ok: false,
          message: "Recipe validation failed.",
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

      const { data, error } = await client.rpc("live_production_upsert_recipe", {
        recipe_payload: {
          recipe_code: recipe.recipeCode,
          name_en: recipe.nameEn,
          name_ar: recipe.nameAr,
          output_sku: recipe.outputSku ?? null,
          output_item_id: recipe.outputItemId ?? null,
          base_output_quantity: recipe.baseOutputQuantity,
        },
        lines_payload: recipe.lines.map((line) => ({
          ingredient_sku: line.ingredientSku ?? null,
          ingredient_item_id: line.ingredientItemId ?? null,
          quantity: line.quantity,
          wastage_percent: line.wastagePercent,
        })),
      });

      return error
        ? { ok: false, message: "Recipe cutover failed.", error: error.message }
        : { ok: true, message: "Recipe cutover completed.", data };
    },
  };
}
