import type { SupabaseBrowserClientLike } from "../../lib/supabase/supabaseClient";
import { expectedBackendObjects, expectedEnterpriseMigrations, summarizeExpectedBackend } from "./migrationVerification";

export function createMigrationVerificationService(client: SupabaseBrowserClientLike | null) {
  return {
    summarizeExpectedBackend,

    listExpectedMigrations() {
      return expectedEnterpriseMigrations;
    },

    listExpectedObjects() {
      return expectedBackendObjects;
    },

    async verifyBackendObjects() {
      if (!client) {
        return {
          ok: false,
          message: "Supabase client is not configured.",
          error: "MISSING_SUPABASE_CLIENT",
          expected: summarizeExpectedBackend(),
        };
      }

      const { data, error } = await client.rpc("backend_gate_verify_expected_objects", {
        expected_objects: expectedBackendObjects,
      });

      return error
        ? { ok: false, message: "Backend object verification failed.", error: error.message }
        : { ok: true, message: "Backend object verification completed.", data };
    },
  };
}
