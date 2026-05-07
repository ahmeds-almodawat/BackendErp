export type MasterDataStatus = "active" | "inactive" | "archived";
export type CategoryKind = "item" | "menu" | "expense" | "asset";
export type AccountType = "asset" | "liability" | "equity" | "revenue" | "cogs" | "expense" | "other_income" | "other_expense";

export interface BranchRecord {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  status: MasterDataStatus;
  is_head_office: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface StoreRecord {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  branch_id: string;
  store_type: string;
  status: MasterDataStatus;
  created_at?: string;
  updated_at?: string;
}

export interface SupplierRecord {
  id: string;
  supplier_code: string;
  name: string;
  vat_number?: string;
  payment_terms?: string;
  default_account_code?: string;
  status: MasterDataStatus;
  created_at?: string;
  updated_at?: string;
}

export interface ItemCategoryRecord {
  id: string;
  code: string;
  name_en: string;
  name_ar: string;
  category_kind: CategoryKind;
  status: MasterDataStatus;
  created_at?: string;
  updated_at?: string;
}

export interface ItemRecord {
  id: string;
  sku: string;
  name_en: string;
  name_ar: string;
  category_id?: string;
  purchase_unit: string;
  consumption_unit: string;
  conversion_factor: number;
  costing_method: "weighted_average" | "fifo" | "standard";
  standard_cost?: number;
  min_stock?: number;
  max_stock?: number;
  reorder_point?: number;
  stock_item: boolean;
  recipe_item: boolean;
  sale_item: boolean;
  status: MasterDataStatus;
  created_at?: string;
  updated_at?: string;
}

export interface ChartAccountRecord {
  id: string;
  account_code: string;
  name_en: string;
  name_ar: string;
  account_type: AccountType;
  parent_account_code?: string;
  normal_balance: "debit" | "credit";
  allow_posting: boolean;
  require_cost_center: boolean;
  status: MasterDataStatus;
  created_at?: string;
  updated_at?: string;
}

export interface MasterDataValidationFinding {
  severity: "warning" | "critical";
  field?: string;
  message: string;
  action: string;
}

export interface MasterDataValidationSummary {
  ok: boolean;
  criticalCount: number;
  warningCount: number;
  findings: MasterDataValidationFinding[];
}
