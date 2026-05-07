import type { EnterpriseDataProvider, MutationResult, QueryOptions } from "./types";

export interface SupabaseClientLike {
  from(table: string): any;
}

export function createSupabaseDataProvider(client: SupabaseClientLike): EnterpriseDataProvider {
  return {
    mode: "supabase",

    async list<T>(resource: string, options?: QueryOptions): Promise<T[]> {
      let query = client.from(resource).select("*");

      if (options?.branchId) {
        query = query.eq("branch_id", options.branchId);
      }

      if (options?.limit) {
        const from = options.offset ?? 0;
        const to = from + options.limit - 1;
        query = query.range(from, to);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(error.message ?? `Failed to list ${resource}.`);
      }

      return (data ?? []) as T[];
    },

    async getById<T>(resource: string, id: string): Promise<T | null> {
      const { data, error } = await client.from(resource).select("*").eq("id", id).maybeSingle();

      if (error) {
        throw new Error(error.message ?? `Failed to get ${resource}.`);
      }

      return (data ?? null) as T | null;
    },

    async create<TInput, TOutput = TInput>(resource: string, input: TInput): Promise<MutationResult<TOutput>> {
      const { data, error } = await client.from(resource).insert(input).select("*").single();

      if (error) {
        return {
          ok: false,
          error: error.message ?? `Failed to create ${resource}.`,
        };
      }

      return {
        ok: true,
        data: data as TOutput,
      };
    },

    async update<TInput, TOutput = TInput>(resource: string, id: string, input: TInput): Promise<MutationResult<TOutput>> {
      const { data, error } = await client.from(resource).update(input).eq("id", id).select("*").single();

      if (error) {
        return {
          ok: false,
          error: error.message ?? `Failed to update ${resource}.`,
        };
      }

      return {
        ok: true,
        data: data as TOutput,
      };
    },

    async archive(resource: string, id: string): Promise<MutationResult> {
      const { error } = await client.from(resource).update({
        is_active: false,
        archived_at: new Date().toISOString(),
      }).eq("id", id);

      if (error) {
        return {
          ok: false,
          error: error.message ?? `Failed to archive ${resource}.`,
        };
      }

      return {
        ok: true,
      };
    },
  };
}
