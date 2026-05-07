import {
  validateBranch,
  validateChartAccount,
  validateItem,
  validateStore,
  validateSupplier,
} from "./masterDataValidation";

export interface MasterDataCutoverChecklistItem {
  key: string;
  label: string;
  status: "ready" | "warning" | "blocked" | "not_checked";
  required: boolean;
}

export const masterDataCutoverChecklist: MasterDataCutoverChecklistItem[] = [
  { key: "branches_validated", label: "Branches validated and coded", status: "not_checked", required: true },
  { key: "stores_mapped", label: "Stores mapped to branches", status: "not_checked", required: true },
  { key: "suppliers_validated", label: "Suppliers validated with VAT/payment terms", status: "not_checked", required: true },
  { key: "items_validated", label: "Items validated with SKU/unit/costing", status: "not_checked", required: true },
  { key: "coa_validated", label: "Chart of accounts validated", status: "not_checked", required: true },
  { key: "imports_staged", label: "Master data imports staged before cutover", status: "not_checked", required: true },
  { key: "backup_ready", label: "Backup/restore tested before cutover", status: "not_checked", required: true },
];

export function createMasterDataCutoverSummary() {
  const demoValidations = [
    validateBranch({ code: "MAIN", name_en: "Main Branch", name_ar: "????? ???????" }),
    validateStore({ code: "MAIN-STORE", name_en: "Main Store", name_ar: "???????? ???????", branch_id: "branch-main" }),
    validateSupplier({ supplier_code: "SUP-001", name: "Sample Supplier", vat_number: "300000000000003" }),
    validateItem({
      sku: "ITEM-001",
      name_en: "Sample Item",
      name_ar: "??? ??????",
      purchase_unit: "CTN",
      consumption_unit: "PCS",
      conversion_factor: 12,
    }),
    validateChartAccount({
      account_code: "1010",
      name_en: "Cash",
      name_ar: "???????",
      account_type: "asset",
      normal_balance: "debit",
      allow_posting: true,
    }),
  ];

  const criticalCount = demoValidations.reduce((sum, result) => sum + result.criticalCount, 0);
  const warningCount = demoValidations.reduce((sum, result) => sum + result.warningCount, 0);

  return {
    status: criticalCount > 0 ? "blocked" : warningCount > 0 ? "warning" : "ready",
    criticalCount,
    warningCount,
    checklist: masterDataCutoverChecklist,
  };
}
