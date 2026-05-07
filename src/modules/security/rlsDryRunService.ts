import type { SupabaseBrowserClientLike } from "../../lib/supabase/supabaseClient";
import { rlsDryRunCases, summarizeRlsDryRun } from "./rlsDryRunHarness";

export function createRlsDryRunService(client: SupabaseBrowserClientLike | null) {
  return {
    listCases() {
      return rlsDryRunCases;
    },

    summarizeLocal() {
      return summarizeRlsDryRun();
    },

    async registerDryRunPlan(runKey: string) {
      if (!client) {
        return {
          ok: false,
          message: "Supabase client is not configured.",
          error: "MISSING_SUPABASE_CLIENT",
          data: summarizeRlsDryRun(),
        };
      }

      const { data, error } = await client.rpc("rls_register_dry_run_plan", {
        run_key: runKey,
        cases_payload: rlsDryRunCases,
      });

      return error
        ? { ok: false, message: "RLS dry-run registration failed.", error: error.message }
        : { ok: true, message: "RLS dry-run plan registered.", data };
    },
  };
}
