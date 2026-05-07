import type { EnterpriseDataProvider, MutationResult, QueryOptions } from "./types";

const localStore = new Map<string, unknown[]>();

function getCollection(resource: string): unknown[] {
  if (!localStore.has(resource)) {
    localStore.set(resource, []);
  }

  return localStore.get(resource) ?? [];
}

export const localDataProvider: EnterpriseDataProvider = {
  mode: "local",

  async list<T>(resource: string, _options?: QueryOptions): Promise<T[]> {
    return getCollection(resource) as T[];
  },

  async getById<T>(resource: string, id: string): Promise<T | null> {
    const record = getCollection(resource).find((item: any) => item?.id === id);
    return (record as T) ?? null;
  },

  async create<TInput, TOutput = TInput>(resource: string, input: TInput): Promise<MutationResult<TOutput>> {
    const collection = getCollection(resource);
    const record = {
      id: crypto.randomUUID(),
      ...(input as Record<string, unknown>),
      createdAt: new Date().toISOString(),
    };

    collection.push(record);

    return {
      ok: true,
      data: record as TOutput,
    };
  },

  async update<TInput, TOutput = TInput>(resource: string, id: string, input: TInput): Promise<MutationResult<TOutput>> {
    const collection = getCollection(resource);
    const index = collection.findIndex((item: any) => item?.id === id);

    if (index === -1) {
      return {
        ok: false,
        error: `Record not found in ${resource}.`,
      };
    }

    const nextRecord = {
      ...(collection[index] as Record<string, unknown>),
      ...(input as Record<string, unknown>),
      updatedAt: new Date().toISOString(),
    };

    collection[index] = nextRecord;

    return {
      ok: true,
      data: nextRecord as TOutput,
    };
  },

  async archive(resource: string, id: string): Promise<MutationResult> {
    const collection = getCollection(resource);
    const index = collection.findIndex((item: any) => item?.id === id);

    if (index === -1) {
      return {
        ok: false,
        error: `Record not found in ${resource}.`,
      };
    }

    collection[index] = {
      ...(collection[index] as Record<string, unknown>),
      archivedAt: new Date().toISOString(),
      isActive: false,
    };

    return {
      ok: true,
    };
  },
};
