import type { EntityRepository } from "../../lib/repositories/repositoryTypes";

export interface MasterDataService {
  branches: EntityRepository<unknown>;
  suppliers: EntityRepository<unknown>;
  items: EntityRepository<unknown>;
  stores: EntityRepository<unknown>;
  categories: EntityRepository<unknown>;
}

export function createMasterDataService(repositories: MasterDataService): MasterDataService {
  return repositories;
}

export const masterDataTableNames = {
  branches: "branches",
  suppliers: "suppliers",
  items: "items",
  stores: "stores",
  categories: "categories",
} as const;
