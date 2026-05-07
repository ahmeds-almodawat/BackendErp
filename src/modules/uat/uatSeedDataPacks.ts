export type UatSeedDataArea = "setup" | "inventory" | "purchasing" | "sales" | "production" | "finance";

export interface UatSeedDataPack {
  key: string;
  title: string;
  area: UatSeedDataArea;
  required: boolean;
  recordCount: number;
  status: "planned" | "loaded" | "verified" | "failed";
}

export const uatSeedDataPacks: UatSeedDataPack[] = [
  { key: "branches_stores", title: "Branches and stores", area: "setup", required: true, recordCount: 4, status: "planned" },
  { key: "coa", title: "Chart of accounts", area: "finance", required: true, recordCount: 80, status: "planned" },
  { key: "items_suppliers", title: "Items and suppliers", area: "setup", required: true, recordCount: 250, status: "planned" },
  { key: "opening_stock", title: "Opening stock", area: "inventory", required: true, recordCount: 250, status: "planned" },
  { key: "purchase_cycle", title: "Purchase invoice and payment samples", area: "purchasing", required: true, recordCount: 20, status: "planned" },
  { key: "pos_batches", title: "POS sales batches", area: "sales", required: true, recordCount: 14, status: "planned" },
  { key: "recipes_production", title: "Recipes and production batches", area: "production", required: true, recordCount: 20, status: "planned" },
];

export function summarizeUatSeedData(packs: UatSeedDataPack[] = uatSeedDataPacks) {
  const failed = packs.filter((pack) => pack.status === "failed").length;
  const planned = packs.filter((pack) => pack.status === "planned").length;
  const verified = packs.filter((pack) => pack.status === "verified").length;

  return {
    status: failed > 0 ? "blocked" : planned > 0 ? "warning" : "ready",
    failed,
    planned,
    verified,
    totalRecords: packs.reduce((sum, pack) => sum + pack.recordCount, 0),
    totalPacks: packs.length,
  };
}
