import assert from "node:assert/strict";
import fs from "node:fs";

const expectedFiles = [
  "src/modules/finance/reconciliation/liveBankReconciliation.ts",
  "src/modules/finance/reconciliation/liveBankReconciliationService.ts",
  "src/modules/finance/tax/liveVatSettlement.ts",
  "src/modules/finance/tax/liveVatSettlementService.ts",
  "src/modules/finance/close/livePeriodClose.ts",
  "src/modules/finance/close/livePeriodCloseService.ts",
  "src/modules/ops/FinanceCloseLiveGatePanel.tsx",
  "supabase/migrations/20260505234900_v349_v351_bank_vat_close_live.sql",
  "docs/V349_V351_BANK_VAT_CLOSE_LIVE.md",
  "templates/v349-v351/bank_statement_import_template.csv"
];

for (const file of expectedFiles) {
  assert.ok(fs.existsSync(file), `Missing expected v349-v351 file: ${file}`);
}

const migration = fs.readFileSync("supabase/migrations/20260505234900_v349_v351_bank_vat_close_live.sql", "utf8");
assert.ok(migration.includes("live_bank_import_statement"), "Missing bank import RPC");
assert.ok(migration.includes("live_vat_create_settlement"), "Missing VAT settlement RPC");
assert.ok(migration.includes("live_finance_request_period_close"), "Missing period close RPC");
assert.ok(migration.includes("enable row level security"), "Migration should enable RLS");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.ok(packageJson.scripts?.["qa:v349-v351"], "Missing qa:v349-v351 script");

console.log("v349-v351 bank VAT close live QA passed");
