import assert from "node:assert/strict";
import fs from "node:fs";

const expectedFiles = [
  "src/modules/ops/stagingMigrationVerification.ts",
  "src/modules/ops/stagingMigrationVerificationService.ts",
  "src/modules/security/rlsDryRunHarness.ts",
  "src/modules/security/rlsDryRunService.ts",
  "src/modules/uat/uatSeedDataPacks.ts",
  "src/modules/goLive/cutoverRehearsal.ts",
  "src/modules/goLive/finalEnterpriseReadiness.ts",
  "src/modules/ops/FinalEnterpriseReadinessPanel.tsx",
  "supabase/migrations/20260505236100_v361_v365_staging_rls_cutover_readiness.sql",
  "docs/V361_V365_STAGING_RLS_CUTOVER_READINESS.md",
  "templates/v361-v365/staging_migration_checks_template.csv"
];

for (const file of expectedFiles) {
  assert.ok(fs.existsSync(file), `Missing expected v361-v365 file: ${file}`);
}

const migration = fs.readFileSync("supabase/migrations/20260505236100_v361_v365_staging_rls_cutover_readiness.sql", "utf8");
assert.ok(migration.includes("staging_verify_enterprise_backend"), "Missing staging verification RPC");
assert.ok(migration.includes("rls_register_dry_run_plan"), "Missing RLS dry-run RPC");
assert.ok(migration.includes("final_enterprise_readiness_snapshot"), "Missing final readiness RPC");
assert.ok(migration.includes("enable row level security"), "Migration should enable RLS");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.ok(packageJson.scripts?.["qa:v361-v365"], "Missing qa:v361-v365 script");

console.log("v361-v365 staging RLS cutover readiness QA passed");
