import type { SupabaseBrowserClientLike } from "../../lib/supabase/supabaseClient";
import type { MasterDataLiveImportRequest } from "./masterDataLiveImport";
import { validateMasterDataLiveImport } from "./masterDataLiveImport";

export function createMasterDataLiveImportService(client: SupabaseBrowserClientLike | null) {
  return {
    validateImport(request: MasterDataLiveImportRequest) {
      return validateMasterDataLiveImport(request);
    },

    async registerImport(request: MasterDataLiveImportRequest) {
      const validation = validateMasterDataLiveImport(request);

      if (!validation.ok) {
        return {
          ok: false,
          message: "Master data live import validation failed.",
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

      const { data, error } = await client.from("master_data_live_import_batches").insert({
        source_type: request.sourceType,
        file_name: request.fileName,
        row_count: request.rowCount,
        approved_by_note: request.approvedBy ?? null,
        business_reason: request.businessReason ?? null,
        status: "validated",
      }).select("*").single();

      return error
        ? { ok: false, message: "Register master data import failed.", error: error.message }
        : { ok: true, message: "Master data import registered.", data };
    },
  };
}
