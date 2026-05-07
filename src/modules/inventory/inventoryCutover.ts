export interface InventoryCutoverChecklistItem {
  key: string;
  label: string;
  status: "ready" | "warning" | "blocked" | "not_checked";
  required: boolean;
}

export const inventoryCutoverChecklist: InventoryCutoverChecklistItem[] = [
  { key: "items_cutover", label: "Items are cut over from master data", status: "not_checked", required: true },
  { key: "stores_cutover", label: "Stores are cut over from master data", status: "not_checked", required: true },
  { key: "opening_stock_staged", label: "Opening stock is staged and validated", status: "not_checked", required: true },
  { key: "negative_stock_policy", label: "Negative stock policy is approved", status: "not_checked", required: true },
  { key: "weighted_average_policy", label: "Weighted average costing policy is approved", status: "not_checked", required: true },
  { key: "stock_adjustment_approval", label: "Stock adjustment approval workflow is defined", status: "not_checked", required: true },
  { key: "inventory_backup", label: "Backup/restore tested before stock cutover", status: "not_checked", required: true },
];

export function createInventoryCutoverSummary() {
  const blocked = inventoryCutoverChecklist.filter((item) => item.required && item.status === "blocked").length;
  const notChecked = inventoryCutoverChecklist.filter((item) => item.required && item.status === "not_checked").length;

  return {
    status: blocked > 0 ? "blocked" : notChecked > 0 ? "warning" : "ready",
    blocked,
    notChecked,
    checklist: inventoryCutoverChecklist,
  };
}
