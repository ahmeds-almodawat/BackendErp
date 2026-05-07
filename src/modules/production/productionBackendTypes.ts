export type ProductionBatchStatus =
  | "draft"
  | "validated"
  | "approved"
  | "posted"
  | "cancelled"
  | "reversed";

export interface ProductionRecipeBackendRecord {
  id: string;
  recipe_code: string;
  name_en: string;
  name_ar: string;
  output_item_id: string;
  base_output_quantity: number;
  status: "active" | "inactive" | "archived";
}

export interface ProductionRecipeLineBackendRecord {
  id: string;
  recipe_id: string;
  ingredient_item_id: string;
  quantity: number;
  wastage_percent: number;
}

export interface ProductionBatchBackendRecord {
  id: string;
  batch_no: string;
  branch_id: string;
  source_store_id: string;
  destination_store_id: string;
  recipe_id?: string;
  output_item_id: string;
  planned_output_quantity: number;
  actual_output_quantity: number;
  status: ProductionBatchStatus;
  posting_batch_id?: string;
}

export interface ProductionValidationFinding {
  severity: "warning" | "critical";
  field?: string;
  message: string;
  action: string;
}
