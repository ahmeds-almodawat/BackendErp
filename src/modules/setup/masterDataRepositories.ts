import { BaseSupabaseRepository } from "../../lib/repositories/baseSupabaseRepository";
import type { SupabaseClientLike } from "../../lib/dataProvider/supabaseProvider";
import type {
  BranchRecord,
  ChartAccountRecord,
  ItemCategoryRecord,
  ItemRecord,
  StoreRecord,
  SupplierRecord,
} from "./masterDataTypes";

export const masterDataBackendTables = {
  branches: "branches",
  stores: "stores",
  suppliers: "suppliers",
  itemCategories: "item_categories",
  items: "items",
  chartAccounts: "chart_accounts",
} as const;

export function createMasterDataRepositories(client: SupabaseClientLike) {
  return {
    branches: new BaseSupabaseRepository<BranchRecord>(client, masterDataBackendTables.branches),
    stores: new BaseSupabaseRepository<StoreRecord>(client, masterDataBackendTables.stores),
    suppliers: new BaseSupabaseRepository<SupplierRecord>(client, masterDataBackendTables.suppliers),
    itemCategories: new BaseSupabaseRepository<ItemCategoryRecord>(client, masterDataBackendTables.itemCategories),
    items: new BaseSupabaseRepository<ItemRecord>(client, masterDataBackendTables.items),
    chartAccounts: new BaseSupabaseRepository<ChartAccountRecord>(client, masterDataBackendTables.chartAccounts),
  };
}
