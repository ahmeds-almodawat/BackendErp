import type { SupabaseBrowserClientLike } from "../../lib/supabase/supabaseClient";
import { stagingMigrationChecks, summarizeStagingMigrationChecks } from "./stagingMigrationVerification";

export function createStagingMigrationVerificationService(client: SupabaseBrowserClientLike | null) {
  return {
    listExpectedChecks() {
      return stagingMigrationChecks;
    },

    summarizeLocal() {
      return summarizeStagingMigrationChecks();
    },

    async runStagingVerification() {
      if (!client) {
        return {
          ok: false,
          message: "Supabase client is not configured.",
          error: "MISSING_SUPABASE_CLIENT",
          data: summarizeStagingMigrationChecks(),
        };
      }

      const { data, error } = await client.rpc("staging_verify_enterprise_backend", {
        expected_checks: stagingMigrationChecks,
      });

      return error
        ? { ok: false, message: "Staging backend verification failed.", error: error.message }
        : { ok: true, message: "Staging backend verification completed.", data };
    },
  };
}
