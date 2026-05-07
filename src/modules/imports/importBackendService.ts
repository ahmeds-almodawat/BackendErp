import type { SupabaseBrowserClientLike } from "../../lib/supabase/supabaseClient";

export interface ImportBackendServiceResult {
  ok: boolean;
  message: string;
  data?: unknown;
  error?: string;
}

async function callImportRpc(
  client: SupabaseBrowserClientLike | null,
  functionName: string,
  args: Record<string, unknown>,
): Promise<ImportBackendServiceResult> {
  if (!client) {
    return {
      ok: false,
      message: "Supabase client is not configured.",
      error: "MISSING_SUPABASE_CLIENT",
    };
  }

  const { data, error } = await client.rpc(functionName, args);

  return error
    ? { ok: false, message: `${functionName} failed.`, error: error.message }
    : { ok: true, message: `${functionName} completed.`, data };
}

export function createImportBackendService(client: SupabaseBrowserClientLike | null) {
  return {
    validateStagingFile(fileId: string) {
      return callImportRpc(client, "import_validate_staging_file", { file_id: fileId });
    },

    approveStagingFile(fileId: string) {
      return callImportRpc(client, "import_approve_staging_file", { file_id: fileId });
    },

    createCutoverBatch(fileId: string) {
      return callImportRpc(client, "import_create_cutover_batch", { file_id: fileId });
    },

    requestRollback(cutoverBatchId: string, reason: string) {
      return callImportRpc(client, "import_request_rollback", {
        cutover_batch_id: cutoverBatchId,
        reason,
      });
    },
  };
}
