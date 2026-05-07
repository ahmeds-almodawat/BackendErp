/**
 * v312 mapping profiles: canonical field definitions and default templates per source type.
 */

export type ImportMappingProfileSourceType =
  | "chart_of_accounts"
  | "items"
  | "suppliers"
  | "opening_balances"
  | "opening_stock"
  | "foodics_sales"
  | "foodics_payments"
  | "inventory_count"
  | "purchase_invoices"
  | "custom_report";

export type ImportMappingProfileStatus = "draft" | "active" | "archived";

/** One mapped column → domain field */
export interface ImportMappingField {
  sourceColumn: string;
  targetField: string;
  required?: boolean;
  notes?: string;
}

export interface ImportMappingProfile {
  id: string;
  sourceType: ImportMappingProfileSourceType;
  profileName: string;
  version: string;
  status: ImportMappingProfileStatus;
  requiredFields: string[];
  optionalFields: string[];
  fieldMappings: ImportMappingField[];
  createdAt: string;
  updatedAt: string;
}

const nowIso = (): string => new Date().toISOString();

function profile(
  id: string,
  sourceType: ImportMappingProfileSourceType,
  profileName: string,
  version: string,
  status: ImportMappingProfileStatus,
  requiredFields: string[],
  optionalFields: string[],
  fieldMappings: ImportMappingField[],
  createdAt: string,
  updatedAt: string,
): ImportMappingProfile {
  return {
    id,
    sourceType,
    profileName,
    version,
    status,
    requiredFields,
    optionalFields,
    fieldMappings,
    createdAt,
    updatedAt,
  };
}

/** Built-in defaults for v312 cutover staging (extend in DB or UI later). */
export const DEFAULT_IMPORT_MAPPING_PROFILES: ImportMappingProfile[] = [
  profile(
    "mp-chart-of-accounts-v1",
    "chart_of_accounts",
    "Default chart of accounts",
    "1.0.0",
    "active",
    ["account_code", "account_name_en"],
    ["account_name_ar", "account_type", "parent_code"],
    [
      { sourceColumn: "account_code", targetField: "account_code", required: true },
      { sourceColumn: "account_name_en", targetField: "account_name_en", required: true },
      { sourceColumn: "account_name_ar", targetField: "account_name_ar" },
      { sourceColumn: "account_type", targetField: "account_type" },
      { sourceColumn: "parent_code", targetField: "parent_code" },
    ],
    nowIso(),
    nowIso(),
  ),
  profile(
    "mp-items-v1",
    "items",
    "Default items / SKU",
    "1.0.0",
    "active",
    ["item_code", "item_name_en"],
    ["item_name_ar", "category_code", "uom", "cost_method"],
    [
      { sourceColumn: "item_code", targetField: "item_code", required: true },
      { sourceColumn: "item_name_en", targetField: "item_name_en", required: true },
      { sourceColumn: "item_name_ar", targetField: "item_name_ar" },
      { sourceColumn: "category_code", targetField: "category_code" },
      { sourceColumn: "uom", targetField: "uom" },
      { sourceColumn: "cost_method", targetField: "cost_method" },
    ],
    nowIso(),
    nowIso(),
  ),
  profile(
    "mp-suppliers-v1",
    "suppliers",
    "Default suppliers",
    "1.0.0",
    "active",
    ["supplier_code", "supplier_name"],
    ["tax_id", "payment_terms", "currency"],
    [
      { sourceColumn: "supplier_code", targetField: "supplier_code", required: true },
      { sourceColumn: "supplier_name", targetField: "supplier_name", required: true },
      { sourceColumn: "tax_id", targetField: "tax_id" },
      { sourceColumn: "payment_terms", targetField: "payment_terms" },
      { sourceColumn: "currency", targetField: "currency" },
    ],
    nowIso(),
    nowIso(),
  ),
  profile(
    "mp-opening-balances-v1",
    "opening_balances",
    "Opening balances (GL)",
    "1.0.0",
    "active",
    ["account_code", "debit", "credit", "branch_code"],
    ["reference", "description"],
    [
      { sourceColumn: "account_code", targetField: "account_code", required: true },
      { sourceColumn: "debit", targetField: "debit", required: true },
      { sourceColumn: "credit", targetField: "credit", required: true },
      { sourceColumn: "branch_code", targetField: "branch_code", required: true },
      { sourceColumn: "reference", targetField: "reference" },
      { sourceColumn: "description", targetField: "description" },
    ],
    nowIso(),
    nowIso(),
  ),
  profile(
    "mp-opening-stock-v1",
    "opening_stock",
    "Opening stock quantities",
    "1.0.0",
    "active",
    ["item_code", "store_code", "quantity"],
    ["batch_no", "unit_cost"],
    [
      { sourceColumn: "item_code", targetField: "item_code", required: true },
      { sourceColumn: "store_code", targetField: "store_code", required: true },
      { sourceColumn: "quantity", targetField: "quantity", required: true },
      { sourceColumn: "batch_no", targetField: "batch_no" },
      { sourceColumn: "unit_cost", targetField: "unit_cost" },
    ],
    nowIso(),
    nowIso(),
  ),
  profile(
    "mp-foodics-sales-v1",
    "foodics_sales",
    "Foodics sales / POS summary",
    "1.0.0",
    "active",
    ["business_date", "branch_code", "net_sales"],
    ["gross_sales", "discount", "vat", "payment_split_json"],
    [
      { sourceColumn: "business_date", targetField: "business_date", required: true },
      { sourceColumn: "branch_code", targetField: "branch_code", required: true },
      { sourceColumn: "net_sales", targetField: "net_sales", required: true },
      { sourceColumn: "gross_sales", targetField: "gross_sales" },
      { sourceColumn: "discount", targetField: "discount" },
      { sourceColumn: "vat", targetField: "vat" },
      { sourceColumn: "payment_split_json", targetField: "payment_split_json" },
    ],
    nowIso(),
    nowIso(),
  ),
  profile(
    "mp-foodics-payments-v1",
    "foodics_payments",
    "Foodics payment tenders",
    "1.0.0",
    "active",
    ["business_date", "branch_code", "tender_code", "amount"],
    ["reference", "order_id"],
    [
      { sourceColumn: "business_date", targetField: "business_date", required: true },
      { sourceColumn: "branch_code", targetField: "branch_code", required: true },
      { sourceColumn: "tender_code", targetField: "tender_code", required: true },
      { sourceColumn: "amount", targetField: "amount", required: true },
      { sourceColumn: "reference", targetField: "reference" },
      { sourceColumn: "order_id", targetField: "order_id" },
    ],
    nowIso(),
    nowIso(),
  ),
];

export function getDefaultMappingProfile(
  sourceType: ImportMappingProfileSourceType,
): ImportMappingProfile | undefined {
  return DEFAULT_IMPORT_MAPPING_PROFILES.find((p) => p.sourceType === sourceType);
}

export function listDefaultMappingProfiles(): ImportMappingProfile[] {
  return [...DEFAULT_IMPORT_MAPPING_PROFILES];
}
