import type { SupabaseBrowserClientLike } from "../../lib/supabase/supabaseClient";
import type { LiveMasterDataCutoverRequest } from "./liveMasterDataCutover";
import { validateLiveMasterDataCutover } from "./liveMasterDataCutover";

export function createLiveMasterDataCutoverService(client: SupabaseBrowserClientLike | null) {
  return {
    validate(request: LiveMasterDataCutoverRequest) {
      return validateLiveMasterDataCutover(request);
    },

    async createCutoverRun(request: LiveMasterDataCutoverRequest) {
      const validation = validateLiveMasterDataCutover(request);

      if (!validation.ok) {
        return {
          ok: false,
          message: validation.message,
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

      const { data, error } = await client.from("live_master_data_cutover_runs").insert({
        resource: request.resource,
        source_file_id: request.sourceFileId ?? null,
        approved_by_note: request.approvedBy ?? null,
        notes: request.notes ?? null,
        status: "validated",
      }).select("*").single();

      return error
        ? { ok: false, message: "Create master data cutover run failed.", error: error.message }
        : { ok: true, message: "Master data cutover run created.", data };
    },

    async postCutoverRun(runId: string) {
      if (!client) {
        return {
          ok: false,
          message: "Supabase client is not configured.",
          error: "MISSING_SUPABASE_CLIENT",
        };
      }

      const { data, error } = await client.rpc("live_master_data_post_cutover_run", { run_id: runId });

      return error
        ? { ok: false, message: "Post master data cutover failed.", error: error.message }
        : { ok: true, message: "Master data cutover posted.", data };
    },
  };
}
