import assert from "node:assert/strict";
import fs from "node:fs";

const expectedFiles = [
  "src/modules/setup/liveMasterDataCutover.ts",
  "src/modules/setup/liveMasterDataCutoverService.ts",
  "src/modules/imports/masterDataLiveImport.ts",
  "src/modules/imports/masterDataLiveImportService.ts",
  "src/modules/finance/live/liveManualJournal.ts",
  "src/modules/finance/live/liveManualJournalService.ts",
  "src/modules/finance/openingBalances/openingBalanceTypes.ts",
  "src/modules/finance/openingBalances/openingBalanceService.ts",
  "src/modules/finance/reports/glLiveReportTypes.ts",
  "src/modules/finance/reports/glLiveReportService.ts",
  "src/modules/ops/LiveCutoverReadinessPanel.tsx",
  "supabase/migrations/20260505233500_v335_v339_master_data_gl_live_cutover.sql",
  "docs/V335_V339_MASTER_DATA_GL_LIVE_CUTOVER.md",
  "templates/v335-v339/opening_balance_batch_template.csv"
];

for (const file of expectedFiles) {
  assert.ok(fs.existsSync(file), `Missing expected v335-v339 file: ${file}`);
}

const migration = fs.readFileSync("supabase/migrations/20260505233500_v335_v339_master_data_gl_live_cutover.sql", "utf8");
assert.ok(migration.includes("live_finance_post_opening_balance"), "Missing opening balance RPC");
assert.ok(migration.includes("live_finance_run_gl_report"), "Missing GL report RPC");
assert.ok(migration.includes("enable row level security"), "Migration should enable RLS");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.ok(packageJson.scripts?.["qa:v335-v339"], "Missing qa:v335-v339 script");

console.log("v335-v339 master data and GL live cutover QA passed");
