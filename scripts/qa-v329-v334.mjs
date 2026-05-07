import assert from "node:assert/strict";
import fs from "node:fs";

const expectedFiles = [
  "src/lib/supabase/supabaseClient.ts",
  "src/lib/supabase/backendHealthService.ts",
  "src/modules/ops/migrationVerification.ts",
  "src/modules/ops/migrationVerificationService.ts",
  "src/modules/access/authShell.ts",
  "src/modules/access/rbacEnforcement.ts",
  "src/modules/ops/rlsTestMatrix.ts",
  "src/modules/ops/EnterpriseRealBackendGatePanel.tsx",
  "supabase/migrations/20260505232900_v329_v334_enterprise_real_backend_gate.sql",
  "docs/V329_V334_ENTERPRISE_REAL_BACKEND_GATE.md",
  "docs/REAL_SUPABASE_BACKEND_GATE_GUIDE.md",
  "docs/RBAC_RLS_TEST_PLAN.md",
  "templates/v329-v334/backend_gate_checks_template.csv",
  "templates/v329-v334/rls_test_matrix_template.csv",
  "templates/v329-v334/migration_verification_template.csv"
];

for (const file of expectedFiles) {
  assert.ok(fs.existsSync(file), `Missing expected v329-v334 file: ${file}`);
}

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.ok(packageJson.dependencies?.["@supabase/supabase-js"], "Missing @supabase/supabase-js dependency");
assert.ok(packageJson.scripts?.["qa:v329-v334"], "Missing qa:v329-v334 script");
assert.ok(packageJson.scripts?.["qa:all"], "Missing qa:all script");

const migration = fs.readFileSync("supabase/migrations/20260505232900_v329_v334_enterprise_real_backend_gate.sql", "utf8");
assert.ok(migration.includes("backend_gate_summary"), "Missing backend_gate_summary RPC");
assert.ok(migration.includes("backend_gate_verify_expected_objects"), "Missing expected object verification RPC");
assert.ok(migration.includes("enable row level security"), "Migration should enable RLS");

console.log("v329-v334 enterprise real backend gate QA passed");
