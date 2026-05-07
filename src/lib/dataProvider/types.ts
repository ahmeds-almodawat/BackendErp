export type DataProviderMode = "local" | "supabase";

export interface QueryOptions {
  branchId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface MutationResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface EnterpriseDataProvider {
  mode: DataProviderMode;
  list<T>(resource: string, options?: QueryOptions): Promise<T[]>;
  getById<T>(resource: string, id: string): Promise<T | null>;
  create<TInput, TOutput = TInput>(resource: string, input: TInput): Promise<MutationResult<TOutput>>;
  update<TInput, TOutput = TInput>(resource: string, id: string, input: TInput): Promise<MutationResult<TOutput>>;
  archive(resource: string, id: string): Promise<MutationResult>;
}
