import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const findings = [];

function add(severity, area, finding, action) {
  findings.push({ severity, area, finding, action });
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function lineCount(file) {
  return read(file).split(/\r?\n/).length;
}

const expectedFiles = [
  "src/engines/enterpriseV369WorkloadEngine.ts",
  "src/modules/EnterpriseV369WorkloadPage.tsx",
  "scripts/qa-v369-midrange-heavy-work.mjs",
  "docs/V369_MIDRANGE_HEAVY_WORK.md",
  "templates/v369/heavy_work_manifest.csv",
];

for (const file of expectedFiles) {
  if (!exists(file)) {
    add("critical", "file inventory", `Missing expected v369 file: ${file}`, "Restore the file or update the v369 manifest intentionally.");
  }
}

const packageJson = JSON.parse(read("package.json"));
if (!["restaurant-erp-v369-midrange-heavy-work-patch", "restaurant-erp-v370-resumable-work-queue-patch", "restaurant-erp-v371-worker-contracts-patch"].includes(packageJson.name)) {
  add("critical", "package metadata", `Unexpected package name ${packageJson.name}`, "Keep package identity compatible with the v369/v370 upgrade line.");
}
if (!["1.0.69", "1.0.70", "1.0.71"].includes(packageJson.version)) {
  add("critical", "package metadata", `Unexpected package version ${packageJson.version}`, "Keep package version on the v369/v370 upgrade line.");
}
if (!packageJson.scripts?.["qa:v369"]) {
  add("critical", "package scripts", "Missing qa:v369 script", "Add the v369 QA script to package.json.");
}
if (!String(packageJson.scripts?.["qa:all"] || "").includes("qa:v369")) {
  add("critical", "package scripts", "qa:all does not include qa:v369", "Run v369 before the final typecheck/build gate.");
}

const lock = JSON.parse(read("package-lock.json"));
if (lock.name !== packageJson.name || lock.version !== packageJson.version || lock.packages?.[""]?.name !== packageJson.name || lock.packages?.[""]?.version !== packageJson.version) {
  add("critical", "package lock", "package-lock root metadata does not match package.json", "Regenerate or repair package-lock metadata.");
}

const appShell = read("src/app/AppShell.tsx");
const appShellLines = lineCount("src/app/AppShell.tsx");
if (appShellLines > 2450) {
  add("critical", "AppShell budget", `AppShell has ${appShellLines} lines`, "Keep v369 as a route-owned module and avoid re-growing AppShell.");
}
for (const token of [appShell.includes("EnterpriseV371WorkloadPage") ? "EnterpriseV371WorkloadPage" : appShell.includes("EnterpriseV370WorkloadPage") ? "EnterpriseV370WorkloadPage" : "EnterpriseV369WorkloadPage", "workload:", "Workload Ops", appShell.includes("Restaurant ERP v371 Worker Contracts") ? "Restaurant ERP v371 Worker Contracts" : appShell.includes("Restaurant ERP v370 Resumable Work Queue") ? "Restaurant ERP v370 Resumable Work Queue" : "Restaurant ERP v369 Mid-Range Heavy Work", appShell.includes("v371 Worker Contracts") ? "v371 Worker Contracts" : appShell.includes("v370 Work Queue") ? "v370 Work Queue" : "v369 Heavy Work"]) {
  if (!appShell.includes(token)) {
    add("critical", "route wiring", `AppShell missing ${token}`, "Restore v369 Workload Ops route wiring and shell labels.");
  }
}

const engine = read("src/engines/enterpriseV369WorkloadEngine.ts");
for (const symbol of ["buildV369WorkloadSnapshot", "buildV369DatasetLoads", "buildV369HeavyJobs", "buildV369JobLanes", "buildV369Guardrails", "buildV369Runbook"]) {
  if (!engine.includes(symbol)) {
    add("critical", "v369 engine", `Missing exported symbol ${symbol}`, "Restore the workload evaluator API.");
  }
}
for (const token of ["midRangeBudget", "heavyWorkBudget", "recommendedBatchSize", "scheduled", "archive"]) {
  if (!engine.includes(token)) {
    add("warning", "v369 engine", `Missing expected heavy-work token ${token}`, "Keep the evaluator focused on mid-range capacity and heavy-job lanes.");
  }
}

const page = read("src/modules/EnterpriseV369WorkloadPage.tsx");
for (const token of ["buildV369WorkloadSnapshot", "v369_workload_snapshot.json", "v369_heavy_jobs.csv", "Log rehearsal"]) {
  if (!page.includes(token)) {
    add("critical", "v369 page", `Workload page missing ${token}`, "Restore route-owned v369 UI exports and audit rehearsal logging.");
  }
}

const productionConfig = read("src/lib/config/productionConfig.ts");
if (!productionConfig.includes("v369-midrange-heavy-work-patch") && !productionConfig.includes("v370-resumable-work-queue-patch") && !productionConfig.includes("v371-worker-contracts-patch")) {
  add("critical", "runtime config", "productionConfig version is not on the v369/v370 upgrade line", "Update production runtime version metadata.");
}

const readme = read("README.md");
const status = read("docs/CURRENT_LOCAL_STATUS.md");
if (!readme.includes("v369") || !status.includes("v369")) {
  add("warning", "documentation", "README or current local status does not mention v369", "Refresh local release documentation.");
}

try {
  const { buildV369WorkloadSnapshot } = await import("../src/engines/enterpriseV369WorkloadEngine.ts");
  const snapshot = buildV369WorkloadSnapshot({
    branches: [{ id: "B1" }],
    stores: [{ id: "S1" }],
    suppliers: Array.from({ length: 3 }, (_, index) => ({ id: `SUP-${index}` })),
    items: Array.from({ length: 25 }, (_, index) => ({ id: `ITM-${index}` })),
    menuItems: [],
    recipeLines: [],
    stockMovements: Array.from({ length: 2500 }, (_, index) => ({ id: `MOV-${index}`, itemId: "ITM-1", storeId: "S1", direction: index % 2 ? "in" : "out", qty: 1, unitCost: 1 })),
    inventoryLots: [],
    purchaseInvoices: [],
    sales: Array.from({ length: 1200 }, (_, index) => ({ id: `SALE-${index}` })),
    journals: [{ id: "JE-1", status: "posted", lines: [{ debit: 10, credit: 0 }, { debit: 0, credit: 10 }] }],
    audits: [],
    roles: [{ id: "ROLE-1" }],
    userAccounts: [{ id: "USER-1" }],
    bankReconLines: [],
  }, { salesNet: 1000 });

  assert.equal(snapshot.version, "v369 Mid-Range Heavy Work Patch");
  assert.ok(snapshot.posture.includes("Mid-range"), "Expected mid-range platform posture");
  assert.ok(snapshot.datasets.length >= 12, "Expected dataset budget coverage");
  assert.ok(snapshot.jobs.length >= 8, "Expected heavy job catalog");
  assert.ok(snapshot.lanes.some((lane) => lane.lane === "scheduled"), "Expected scheduled lane");
  assert.ok(snapshot.lanes.some((lane) => lane.lane === "archive"), "Expected archive lane");
  assert.ok(Number.isFinite(snapshot.scores.platformScore), "Expected numeric platform score");
} catch (error) {
  add("critical", "runtime evaluator", error?.message || String(error), "Fix buildV369WorkloadSnapshot output contract.");
}

findings.sort((a, b) => {
  const rank = { critical: 3, warning: 2, info: 1 };
  return rank[b.severity] - rank[a.severity] || a.area.localeCompare(b.area);
});

const report = [
  "# v369 Mid-Range Heavy Work Scan",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  `Critical: ${findings.filter((finding) => finding.severity === "critical").length}`,
  `Warnings: ${findings.filter((finding) => finding.severity === "warning").length}`,
  "",
  "| Severity | Area | Finding | Action |",
  "|---|---|---|---|",
  ...findings.map((finding) => `| ${finding.severity} | ${finding.area} | ${finding.finding.replaceAll("|", "\\|")} | ${finding.action.replaceAll("|", "\\|")} |`),
  "",
  findings.length ? "" : `No v369 mid-range heavy-work issues detected. AppShell line count: ${appShellLines}.`,
].join("\n");

fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(path.join(root, "docs/V369_MIDRANGE_HEAVY_WORK_REPORT.md"), report);

console.log(report);

const criticals = findings.filter((finding) => finding.severity === "critical");
if (criticals.length) {
  console.error(`\nV369 mid-range heavy-work scan failed with ${criticals.length} critical finding(s).`);
  process.exit(1);
}
