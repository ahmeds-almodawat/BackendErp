import assert from "node:assert/strict";
import fs from "node:fs";

const expectedFiles = [
  "src/modules/ops/appShellReductionPlan.ts",
  "src/modules/navigation/permissionAwareNavigation.ts",
  "src/modules/ops/enterpriseTableAdoption.ts",
  "src/modules/support/liveErrorLoggingService.ts",
  "src/modules/audit/liveAuditService.ts",
  "src/modules/deployment/stagingDeploymentGate.ts",
  "src/modules/uat/enterpriseUatScenarios.ts",
  "src/modules/goLive/productionGoLiveChecklist.ts",
  "src/modules/ops/EnterpriseGoLiveControlPanel.tsx",
  "supabase/migrations/20260505235200_v352_v360_enterprise_ui_observability_go_live.sql",
  "docs/V352_V360_ENTERPRISE_UI_OBSERVABILITY_GO_LIVE.md",
  "templates/v352-v360/go_live_checklist_template.csv",
  ".github/workflows/enterprise-ci.yml"
];

for (const file of expectedFiles) {
  assert.ok(fs.existsSync(file), `Missing expected v352-v360 file: ${file}`);
}

const migration = fs.readFileSync("supabase/migrations/20260505235200_v352_v360_enterprise_ui_observability_go_live.sql", "utf8");
assert.ok(migration.includes("live_support_log_error"), "Missing support logging RPC");
assert.ok(migration.includes("live_audit_log_event"), "Missing audit logging RPC");
assert.ok(migration.includes("go_live_readiness_summary"), "Missing go-live summary RPC");
assert.ok(migration.includes("enable row level security"), "Migration should enable RLS");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
assert.ok(packageJson.scripts?.["qa:v352-v360"], "Missing qa:v352-v360 script");

console.log("v352-v360 enterprise UI observability go-live QA passed");
