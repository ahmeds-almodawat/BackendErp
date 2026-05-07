import type { SupabaseBrowserClientLike } from "../../lib/supabase/supabaseClient";
import type { RepositoryResult } from "../../lib/repositories/repositoryTypes";
import {
  validateBranch,
  validateChartAccount,
  validateItem,
  validateStore,
  validateSupplier,
} from "./masterDataValidation";

export type MasterDataResource =
  | "branches"
  | "stores"
  | "suppliers"
  | "item_categories"
  | "items"
  | "chart_accounts";

export interface MasterDataBackendOperationResult<T = unknown> extends RepositoryResult<T> {
  validation?: ReturnType<typeof validateBranch>;
}

async function insertRecord<T>(
  client: SupabaseBrowserClientLike | null,
  resource: MasterDataResource,
  input: Record<string, unknown>,
): Promise<MasterDataBackendOperationResult<T>> {
  if (!client) {
    return {
      ok: false,
      error: "MISSING_SUPABASE_CLIENT",
    };
  }

  const { data, error } = await client.from(resource).insert(input).select("*").single();

  return error ? { ok: false, error: error.message } : { ok: true, data: data as T };
}

export function createMasterDataBackendService(client: SupabaseBrowserClientLike | null) {
  return {
    async createBranch(input: Record<string, unknown>) {
      const validation = validateBranch(input);
      if (!validation.ok) return { ok: false, error: "VALIDATION_FAILED", validation };
      return insertRecord(client, "branches", input);
    },

    async createStore(input: Record<string, unknown>) {
      const validation = validateStore(input);
      if (!validation.ok) return { ok: false, error: "VALIDATION_FAILED", validation };
      return insertRecord(client, "stores", input);
    },

    async createSupplier(input: Record<string, unknown>) {
      const validation = validateSupplier(input);
      if (!validation.ok) return { ok: false, error: "VALIDATION_FAILED", validation };
      return insertRecord(client, "suppliers", input);
    },

    async createItem(input: Record<string, unknown>) {
      const validation = validateItem(input);
      if (!validation.ok) return { ok: false, error: "VALIDATION_FAILED", validation };
      return insertRecord(client, "items", input);
    },

    async createChartAccount(input: Record<string, unknown>) {
      const validation = validateChartAccount(input);
      if (!validation.ok) return { ok: false, error: "VALIDATION_FAILED", validation };
      return insertRecord(client, "chart_accounts", input);
    },

    async list(resource: MasterDataResource) {
      if (!client) {
        return {
          ok: false,
          error: "MISSING_SUPABASE_CLIENT",
        };
      }

      const { data, error } = await client.from(resource).select("*");

      return error ? { ok: false, error: error.message } : { ok: true, data };
    },
  };
}
