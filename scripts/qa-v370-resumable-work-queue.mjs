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
  "src/engines/enterpriseV370JobRunnerEngine.ts",
  "src/modules/EnterpriseV370WorkloadPage.tsx",
  "scripts/qa-v370-resumable-work-queue.mjs",
  "docs/V370_RESUMABLE_WORK_QUEUE.md",
  "templates/v370/resumable_queue_manifest.csv",
];

for (const file of expectedFiles) {
  if (!exists(file)) {
    add("critical", "file inventory", `Missing expected v370 file: ${file}`, "Restore the file or update the v370 manifest intentionally.");
  }
}

const packageJson = JSON.parse(read("package.json"));
if (!["restaurant-erp-v370-resumable-work-queue-patch", "restaurant-erp-v371-worker-contracts-patch"].includes(packageJson.name)) {
  add("critical", "package metadata", `Unexpected package name ${packageJson.name}`, "Keep package identity compatible with the v370/v371 upgrade line.");
}
if (!["1.0.70", "1.0.71"].includes(packageJson.version)) {
  add("critical", "package metadata", `Unexpected package version ${packageJson.version}`, "Keep package version on the v370/v371 upgrade line.");
}
if (!packageJson.scripts?.["qa:v370"]) {
  add("critical", "package scripts", "Missing qa:v370 script", "Add the v370 QA script to package.json.");
}
if (!String(packageJson.scripts?.["qa:all"] || "").includes("qa:v370")) {
  add("critical", "package scripts", "qa:all does not include qa:v370", "Run v370 before the final typecheck/build gate.");
}

const lock = JSON.parse(read("package-lock.json"));
if (lock.name !== packageJson.name || lock.version !== packageJson.version || lock.packages?.[""]?.name !== packageJson.name || lock.packages?.[""]?.version !== packageJson.version) {
  add("critical", "package lock", "package-lock root metadata does not match package.json", "Regenerate or repair package-lock metadata.");
}

const appShell = read("src/app/AppShell.tsx");
const appShellLines = lineCount("src/app/AppShell.tsx");
if (appShellLines > 2450) {
  add("critical", "AppShell budget", `AppShell has ${appShellLines} lines`, "Keep v370 queue logic in route-owned modules.");
}
for (const token of [appShell.includes("EnterpriseV371WorkloadPage") ? "EnterpriseV371WorkloadPage" : "EnterpriseV370WorkloadPage", "workload:", "Workload Ops", appShell.includes("Restaurant ERP v371 Worker Contracts") ? "Restaurant ERP v371 Worker Contracts" : "Restaurant ERP v370 Resumable Work Queue", appShell.includes("v371 Worker Contracts") ? "v371 Worker Contracts" : "v370 Work Queue"]) {
  if (!appShell.includes(token)) {
    add("critical", "route wiring", `AppShell missing ${token}`, "Restore v370 Workload Ops route wiring and shell labels.");
  }
}

const engine = read("src/engines/enterpriseV370JobRunnerEngine.ts");
for (const symbol of ["buildV370QueueSnapshot", "buildV370Candidates", "enqueueV370Run", "advanceV370Run", "advanceV370RunInState", "pauseV370RunInState", "resumeV370RunInState", "failV370RunInState"]) {
  if (!engine.includes(symbol)) {
    add("critical", "v370 engine", `Missing exported symbol ${symbol}`, "Restore the resumable queue evaluator API.");
  }
}
for (const token of ["queued", "running", "paused", "completed", "checkpoint", "dryRun"]) {
  if (!engine.includes(token)) {
    add("warning", "v370 engine", `Missing queue token ${token}`, "Keep the queue foundation resumable and evidence-oriented.");
  }
}

const page = read("src/modules/EnterpriseV369WorkloadPage.tsx");
for (const token of ["buildV370QueueSnapshot", "v370_queue_snapshot.json", "Queue dry-run", "Advance", "Resume", "Pause"]) {
  if (!page.includes(token)) {
    add("critical", "v370 page", `Workload page missing ${token}`, "Restore queue UI actions and evidence exports.");
  }
}

const productionConfig = read("src/lib/config/productionConfig.ts");
if (!productionConfig.includes("v370-resumable-work-queue-patch") && !productionConfig.includes("v371-worker-contracts-patch")) {
  add("critical", "runtime config", "productionConfig version is not on the v370/v371 upgrade line", "Update production runtime version metadata.");
}

const readme = read("README.md");
const status = read("docs/CURRENT_LOCAL_STATUS.md");
if (!readme.includes("v370") || !status.includes("v370")) {
  add("warning", "documentation", "README or current local status does not mention v370", "Refresh local release documentation.");
}

try {
  const {
    buildV370QueueSnapshot,
    enqueueV370Run,
    advanceV370RunInState,
    pauseV370RunInState,
    resumeV370RunInState,
  } = await import("../src/engines/enterpriseV370JobRunnerEngine.ts");

  const baseState = {
    branches: [{ id: "B1" }],
    stores: [{ id: "S1" }],
    suppliers: [],
    items: Array.from({ length: 10 }, (_, index) => ({ id: `ITM-${index}` })),
    menuItems: [],
    recipeLines: [],
    stockMovements: Array.from({ length: 900 }, (_, index) => ({ id: `MOV-${index}`, itemId: "ITM-1", storeId: "S1", direction: "in", qty: 1, unitCost: 1 })),
    inventoryLots: [],
    purchaseInvoices: [],
    sales: [],
    journals: [{ id: "JE-1", status: "posted", lines: [{ debit: 10, credit: 0 }, { debit: 0, credit: 10 }] }],
    audits: [],
    roles: [],
    userAccounts: [],
    bankReconLines: [],
  };
  const initial = buildV370QueueSnapshot(baseState, {});
  assert.equal(initial.version, "v370 Resumable Work Queue Patch");
  assert.ok(initial.candidates.length >= 8, "Expected queue candidates from v369 jobs");
  const candidate = initial.candidates.find((row) => row.recommended) ?? initial.candidates[0];
  const queuedState = enqueueV370Run(baseState, {}, candidate.jobId, true);
  const queued = buildV370QueueSnapshot(queuedState, {});
  assert.equal(queued.counts.queued, 1);
  const runId = queued.runs[0].id;
  const advancedState = advanceV370RunInState(queuedState, runId, 1);
  const advanced = buildV370QueueSnapshot(advancedState, {});
  assert.ok(advanced.counts.running + advanced.counts.completed >= 1, "Expected run to advance");
  const pausedState = pauseV370RunInState(advancedState, runId, "QA pause");
  const paused = buildV370QueueSnapshot(pausedState, {});
  if (!paused.runs[0] || paused.runs[0].status !== "completed") assert.equal(paused.counts.paused, 1);
  const resumedState = resumeV370RunInState(pausedState, runId);
  const resumed = buildV370QueueSnapshot(resumedState, {});
  assert.ok(Number.isFinite(resumed.queueScore), "Expected numeric queue score");
} catch (error) {
  add("critical", "runtime queue", error?.message || String(error), "Fix v370 queue runtime contract.");
}

findings.sort((a, b) => {
  const rank = { critical: 3, warning: 2, info: 1 };
  return rank[b.severity] - rank[a.severity] || a.area.localeCompare(b.area);
});

const report = [
  "# v370 Resumable Work Queue Scan",
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
  findings.length ? "" : `No v370 resumable work queue issues detected. AppShell line count: ${appShellLines}.`,
].join("\n");

fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(path.join(root, "docs/V370_RESUMABLE_WORK_QUEUE_REPORT.md"), report);

console.log(report);

const criticals = findings.filter((finding) => finding.severity === "critical");
if (criticals.length) {
  console.error(`\nV370 resumable work queue scan failed with ${criticals.length} critical finding(s).`);
  process.exit(1);
}
