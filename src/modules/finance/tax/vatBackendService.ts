import type { SupabaseBrowserClientLike } from "../../../lib/supabase/supabaseClient";
import type { VatTransaction } from "./vatTypes";
import { buildVatSummary } from "./vatTypes";

export function createVatBackendService(client: SupabaseBrowserClientLike | null) {
  return {
    summarizeLocal(transactions: VatTransaction[]) {
      return buildVatSummary(transactions);
    },

    async getVatSummary(periodStart: string, periodEnd: string, branchId?: string) {
      if (!client) {
        return {
          ok: false,
          message: "Supabase client is not configured.",
          error: "MISSING_SUPABASE_CLIENT",
        };
      }

      const { data, error } = await client.rpc("finance_get_vat_summary", {
        period_start: periodStart,
        period_end: periodEnd,
        branch_id: branchId ?? null,
      });

      return error
        ? { ok: false, message: "VAT summary failed.", error: error.message }
        : { ok: true, message: "VAT summary generated.", data };
    },

    async createVatSettlement(periodStart: string, periodEnd: string, branchId?: string) {
      if (!client) {
        return {
          ok: false,
          message: "Supabase client is not configured.",
          error: "MISSING_SUPABASE_CLIENT",
        };
      }

      const { data, error } = await client.rpc("finance_create_vat_settlement", {
        period_start: periodStart,
        period_end: periodEnd,
        branch_id: branchId ?? null,
      });

      return error
        ? { ok: false, message: "VAT settlement failed.", error: error.message }
        : { ok: true, message: "VAT settlement created.", data };
    },
  };
}
