import type { SupabaseBrowserClientLike } from "../../../lib/supabase/supabaseClient";
import type { LiveSalesPostingRequest } from "./liveSalesPosting";
import { validateLiveSalesPosting } from "./liveSalesPosting";

export function createLiveSalesPostingService(client: SupabaseBrowserClientLike | null) {
  return {
    validate(request: LiveSalesPostingRequest) {
      return validateLiveSalesPosting(request);
    },

    async postSalesBatch(request: LiveSalesPostingRequest) {
      const validation = validateLiveSalesPosting(request);

      if (!validation.ok) {
        return {
          ok: false,
          message: "Sales posting validation failed.",
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

      const { data, error } = await client.rpc("live_sales_post_pos_batch", {
        batch_id: request.batchId,
        posting_options: {
          branch_id: request.branchId ?? null,
          business_date: request.businessDate,
          post_cogs: request.postCogs ?? false,
          memo: request.memo ?? null,
        },
      });

      return error
        ? { ok: false, message: "Sales POS batch posting failed.", error: error.message }
        : { ok: true, message: "Sales POS batch posted.", data };
    },
  };
}
