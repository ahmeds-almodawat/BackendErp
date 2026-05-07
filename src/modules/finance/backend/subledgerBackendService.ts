import type { SupabaseBrowserClientLike } from "../../../lib/supabase/supabaseClient";

export function createSubledgerBackendService(client: SupabaseBrowserClientLike | null) {
  return {
    async getSupplierAging(asOfDate: string, branchId?: string) {
      if (!client) {
        return {
          ok: false,
          message: "Supabase client is not configured.",
          error: "MISSING_SUPABASE_CLIENT",
        };
      }

      const { data, error } = await client.rpc("finance_get_supplier_aging", {
        as_of_date: asOfDate,
        branch_id: branchId ?? null,
      });

      return error
        ? { ok: false, message: "Supplier aging failed.", error: error.message }
        : { ok: true, message: "Supplier aging generated.", data };
    },

    async getCustomerAging(asOfDate: string, branchId?: string) {
      if (!client) {
        return {
          ok: false,
          message: "Supabase client is not configured.",
          error: "MISSING_SUPABASE_CLIENT",
        };
      }

      const { data, error } = await client.rpc("finance_get_customer_aging", {
        as_of_date: asOfDate,
        branch_id: branchId ?? null,
      });

      return error
        ? { ok: false, message: "Customer aging failed.", error: error.message }
        : { ok: true, message: "Customer aging generated.", data };
    },
  };
}
