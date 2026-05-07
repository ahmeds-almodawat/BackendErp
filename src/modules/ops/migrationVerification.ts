export interface ExpectedMigration {
  version: string;
  label: string;
  fileName: string;
  critical: boolean;
}

export interface ExpectedBackendObject {
  kind: "table" | "rpc" | "policy_area";
  name: string;
  module: string;
  critical: boolean;
}

export interface MigrationVerificationSummary {
  expectedMigrationCount: number;
  expectedObjectCount: number;
  criticalMigrationCount: number;
  criticalObjectCount: number;
  generatedAt: string;
}

export const expectedEnterpriseMigrations: ExpectedMigration[] = [
  { version: "v310", label: "Enterprise foundation", fileName: "20260505231000_v310_enterprise_foundation.sql", critical: true },
  { version: "v311", label: "Backend posting engine", fileName: "20260505231100_v311_backend_posting_engine.sql", critical: true },
  { version: "v312", label: "Import staging cutover", fileName: "20260505231200_v312_import_staging_cutover.sql", critical: true },
  { version: "v313", label: "Reporting truth", fileName: "20260505231300_v313_reporting_truth.sql", critical: true },
  { version: "v314", label: "Performance/UI hardening", fileName: "20260505231400_v314_performance_ui_hardening.sql", critical: false },
  { version: "v315", label: "Production readiness", fileName: "20260505231500_v315_production_readiness.sql", critical: true },
  { version: "v316", label: "Backend cutover starter", fileName: "20260505231600_v316_backend_cutover_starter.sql", critical: true },
  { version: "v317", label: "Master data cutover", fileName: "20260505231700_v317_master_data_backend_cutover.sql", critical: true },
  { version: "v318", label: "Inventory stock ledger", fileName: "20260505231800_v318_inventory_stock_ledger_cutover.sql", critical: true },
  { version: "v319-v322", label: "Operational backend cutover", fileName: "20260505231900_v319_v322_operational_backend_cutover.sql", critical: true },
  { version: "v323-v328", label: "Finance enterprise backend", fileName: "20260505232300_v323_v328_finance_enterprise_backend.sql", critical: true },
  { version: "v329-v334", label: "Enterprise real backend gate", fileName: "20260505232900_v329_v334_enterprise_real_backend_gate.sql", critical: true },
];

export const expectedBackendObjects: ExpectedBackendObject[] = [
  { kind: "table", name: "branches", module: "setup", critical: true },
  { kind: "table", name: "stores", module: "setup", critical: true },
  { kind: "table", name: "suppliers", module: "purchasing", critical: true },
  { kind: "table", name: "items", module: "inventory", critical: true },
  { kind: "table", name: "chart_accounts", module: "finance", critical: true },
  { kind: "table", name: "posting_batches", module: "finance", critical: true },
  { kind: "table", name: "inventory_stock_movements", module: "inventory", critical: true },
  { kind: "table", name: "inventory_stock_balances", module: "inventory", critical: true },
  { kind: "table", name: "purchase_invoices", module: "purchasing", critical: true },
  { kind: "table", name: "sales_pos_batches", module: "sales", critical: true },
  { kind: "table", name: "production_batches", module: "production", critical: true },
  { kind: "table", name: "finance_journal_entries_backend", module: "finance", critical: true },
  { kind: "table", name: "finance_journal_lines_backend", module: "finance", critical: true },
  { kind: "table", name: "vat_transactions", module: "finance", critical: true },
  { kind: "table", name: "bank_statement_lines", module: "finance", critical: true },
  { kind: "rpc", name: "finance_post_journal", module: "finance", critical: true },
  { kind: "rpc", name: "inventory_post_stock_movement", module: "inventory", critical: true },
  { kind: "rpc", name: "purchasing_post_purchase_invoice", module: "purchasing", critical: true },
  { kind: "rpc", name: "sales_post_pos_batch", module: "sales", critical: true },
  { kind: "rpc", name: "production_post_batch", module: "production", critical: true },
];

export function summarizeExpectedBackend(): MigrationVerificationSummary {
  return {
    expectedMigrationCount: expectedEnterpriseMigrations.length,
    expectedObjectCount: expectedBackendObjects.length,
    criticalMigrationCount: expectedEnterpriseMigrations.filter((migration) => migration.critical).length,
    criticalObjectCount: expectedBackendObjects.filter((object) => object.critical).length,
    generatedAt: new Date().toISOString(),
  };
}
