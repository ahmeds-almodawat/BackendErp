import type { SupabaseClientLike } from "../dataProvider/supabaseProvider";
import type { EntityRepository, ListOptions, RepositoryResult } from "./repositoryTypes";

export class BaseSupabaseRepository<TRecord, TCreate = Partial<TRecord>, TUpdate = Partial<TRecord>>
  implements EntityRepository<TRecord, TCreate, TUpdate> {
  constructor(
    private readonly client: SupabaseClientLike,
    private readonly tableName: string,
  ) {}

  async list(options?: ListOptions): Promise<RepositoryResult<TRecord[]>> {
    let query = this.client.from(this.tableName).select("*");

    if (options?.branchId) {
      query = query.eq("branch_id", options.branchId);
    }

    if (options?.limit) {
      const from = options.offset ?? 0;
      const to = from + options.limit - 1;
      query = query.range(from, to);
    }

    const { data, error } = await query;

    return error ? { ok: false, error: error.message } : { ok: true, data: (data ?? []) as TRecord[] };
  }

  async getById(id: string): Promise<RepositoryResult<TRecord | null>> {
    const { data, error } = await this.client.from(this.tableName).select("*").eq("id", id).maybeSingle();
    return error ? { ok: false, error: error.message } : { ok: true, data: (data ?? null) as TRecord | null };
  }

  async create(input: TCreate): Promise<RepositoryResult<TRecord>> {
    const { data, error } = await this.client.from(this.tableName).insert(input).select("*").single();
    return error ? { ok: false, error: error.message } : { ok: true, data: data as TRecord };
  }

  async update(id: string, input: TUpdate): Promise<RepositoryResult<TRecord>> {
    const { data, error } = await this.client.from(this.tableName).update(input).eq("id", id).select("*").single();
    return error ? { ok: false, error: error.message } : { ok: true, data: data as TRecord };
  }

  async archive(id: string): Promise<RepositoryResult> {
    const { error } = await this.client.from(this.tableName).update({
      is_active: false,
      archived_at: new Date().toISOString(),
    }).eq("id", id);

    return error ? { ok: false, error: error.message } : { ok: true };
  }
}
