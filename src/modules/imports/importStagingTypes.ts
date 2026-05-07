export type ImportSourceType =
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

export type ImportStageStatus =
  | "uploaded"
  | "mapped"
  | "validated"
  | "has_errors"
  | "approved"
  | "posted"
  | "rolled_back"
  | "cancelled";

export interface ImportStagingFile {
  id: string;
  sourceType: ImportSourceType;
  fileName: string;
  fileMimeType?: string;
  fileSizeBytes?: number;
  status: ImportStageStatus;
  uploadedBy: string;
  uploadedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  postedBy?: string;
  postedAt?: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
}

export interface ImportStagingRow {
  id: string;
  fileId: string;
  rowNumber: number;
  rawData: Record<string, unknown>;
  mappedData?: Record<string, unknown>;
  isValid: boolean;
  errors: string[];
}
