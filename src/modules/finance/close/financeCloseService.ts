import type { SupabaseBrowserClientLike } from "../../../lib/supabase/supabaseClient";
import { summarizeFinanceClose } from "./financeCloseTypes";

export function createFinanceCloseService(client: SupabaseBrowserClientLike | null) {
  return {
    summarizeLocalCloseReadiness() {
      return summarizeFinanceClose();
    },

    async runCloseCheck(periodId: string, branchId?: string) {
      if (!client) {
        return {
          ok: false,
          message: "Supabase client is not configured.",
          error: "MISSING_SUPABASE_CLIENT",
        };
      }

      const { data, error } = await client.rpc("finance_close_period_check", {
        period_id: periodId,
        branch_id: branchId ?? null,
      });

      return error
        ? { ok: false, message: "Finance close check failed.", error: error.message }
        : { ok: true, message: "Finance close check completed.", data };
    },
  };
}
