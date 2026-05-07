import assert from "node:assert/strict";
import fs from "node:fs";

const expectedFiles = [
  "src/modules/sales/live/livePosImport.ts",
  "src/modules/sales/live/livePosImportService.ts",
  "src/modules/sales/live/liveSalesPosting.ts",
  "src/modules/sales/live/liveSalesPostingService.ts",
  "src/modules/production/live/liveRecipeCutover.ts",
  "src/modules/production/live/liveRecipeCutoverService.ts",
  "src/modules/production/live/liveProductionBatch.ts",
  "src/modules/production/live/liveProductionBatchService.ts",
  "src/modules/ops/SalesProductionLiveGatePanel.tsx",
  "supabase/migrations/20260505234500_v345_v348_sales_production_live_posting.sql",
  "docs/V345_V348_SALES_PRODUCTION_LIVE_POSTING.md",
  "templates/v345-v348/pos_import_batch_template.csv"
];

for (const file of expectedFiles) {
  assert.ok(fs.existsSync(file), `Missing expected v345-v348 file: ${file}`);
}

const migration = fs.readFileSync("supabase/migrations/20260505234500_v345_v348_sales_production_live_posting.sql", "utf8");
assert.ok(migration.includes("live_sales_register_pos_import"), "Missing POS import RPC");
assert.ok(migration.includes("live_sales_post_pos_batch"), "Missing sales posting RPC");
assert.ok(migration.includes("live_production_upsert_recipe"), "Missing recipe RPC");
assert.ok(migration.includes("live_production_post_batch"), "Missing production posting RPC");
assert.ok(migration.includes("enable row level security"), "Migration should enable RLS");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.ok(packageJson.scripts?.["qa:v345-v348"], "Missing qa:v345-v348 script");

console.log("v345-v348 sales and production live posting QA passed");
