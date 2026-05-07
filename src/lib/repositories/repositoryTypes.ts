export interface RepositoryResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface ListOptions {
  branchId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface EntityRepository<TRecord, TCreate = Partial<TRecord>, TUpdate = Partial<TRecord>> {
  list(options?: ListOptions): Promise<RepositoryResult<TRecord[]>>;
  getById(id: string): Promise<RepositoryResult<TRecord | null>>;
  create(input: TCreate): Promise<RepositoryResult<TRecord>>;
  update(id: string, input: TUpdate): Promise<RepositoryResult<TRecord>>;
  archive(id: string): Promise<RepositoryResult>;
}
