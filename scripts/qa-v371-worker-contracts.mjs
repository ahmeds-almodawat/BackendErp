import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const findings = [];
const add = (severity, area, finding, action) => findings.push({ severity, area, finding, action });
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const lineCount = (file) => read(file).split(/\r?\n/).length;

for (const file of [
  "src/engines/enterpriseV371WorkerContractEngine.ts",
  "src/modules/EnterpriseV371WorkloadPage.tsx",
  "scripts/qa-v371-worker-contracts.mjs",
  "docs/V371_WORKER_CONTRACTS.md",
  "templates/v371/worker_contract_manifest.csv",
]) if (!exists(file)) add("critical", "file inventory", `Missing ${file}`, "Restore the v371 file.");

const pkg = JSON.parse(read("package.json"));
if (pkg.name !== "restaurant-erp-v371-worker-contracts-patch") add("critical", "package metadata", `Unexpected package name ${pkg.name}`, "Use v371 package identity.");
if (pkg.version !== "1.0.71") add("critical", "package metadata", `Unexpected package version ${pkg.version}`, "Use version 1.0.71.");
if (!pkg.scripts?.["qa:v371"] || !String(pkg.scripts?.["qa:all"] || "").includes("qa:v371")) add("critical", "package scripts", "qa:v371 is not wired into qa:all", "Wire v371 QA.");

const lock = JSON.parse(read("package-lock.json"));
if (lock.name !== pkg.name || lock.version !== pkg.version || lock.packages?.[""]?.name !== pkg.name || lock.packages?.[""]?.version !== pkg.version) add("critical", "package lock", "package-lock root metadata mismatch", "Repair package-lock metadata.");

const appShell = read("src/app/AppShell.tsx");
if (lineCount("src/app/AppShell.tsx") > 2450) add("critical", "AppShell budget", "AppShell exceeded 2450 lines", "Keep worker contracts route-owned.");
for (const token of ["EnterpriseV371WorkloadPage", "Restaurant ERP v371 Worker Contracts", "v371 Worker Contracts"]) if (!appShell.includes(token)) add("critical", "route wiring", `Missing ${token}`, "Restore v371 route labels.");

const engine = read("src/engines/enterpriseV371WorkerContractEngine.ts");
for (const token of ["buildV371WorkerSnapshot", "buildV371WorkerContracts", "v371ContractsToRows", "idempotencyKey", "leaseSeconds", "retryPolicy", "requiredSecrets"]) if (!engine.includes(token)) add("critical", "v371 engine", `Missing ${token}`, "Restore worker contract API.");

const page = read("src/modules/EnterpriseV369WorkloadPage.tsx");
for (const token of ["buildV371WorkerSnapshot", "v371_worker_contracts.json", "Worker handoff manifest", "v371_worker_contracts.csv"]) if (!page.includes(token)) add("critical", "v371 page", `Missing ${token}`, "Restore worker contract UI.");

if (!read("src/lib/config/productionConfig.ts").includes("v371-worker-contracts-patch")) add("critical", "runtime config", "productionConfig is not v371", "Update runtime metadata.");
if (!read("README.md").includes("v371") || !read("docs/CURRENT_LOCAL_STATUS.md").includes("v371")) add("warning", "documentation", "README/status missing v371", "Refresh docs.");

try {
  const { buildV371WorkerSnapshot } = await import("../src/engines/enterpriseV371WorkerContractEngine.ts");
  const state = { items: [{ id: "I1" }], stockMovements: [{ id: "M1", itemId: "I1", storeId: "S1", direction: "in", qty: 1, unitCost: 1 }], journals: [], audits: [], workloadRuns: [] };
  const snapshot = buildV371WorkerSnapshot(state, {});
  assert.equal(snapshot.version, "v371 Backend Worker Contract Patch");
  assert.ok(snapshot.contracts.length >= 1, "Expected planned worker contract");
  assert.ok(snapshot.contracts[0].idempotencyKey, "Expected idempotency key");
  assert.ok(snapshot.contracts[0].retryPolicy.maxAttempts >= 2, "Expected retry policy");
  assert.ok(snapshot.contracts[0].requiredSecrets.includes("SUPABASE"), "Expected Supabase secret contract");
} catch (error) {
  add("critical", "runtime contract", error?.message || String(error), "Fix v371 runtime contract.");
}

findings.sort((a, b) => ({ critical: 3, warning: 2, info: 1 }[b.severity] - { critical: 3, warning: 2, info: 1 }[a.severity]) || a.area.localeCompare(b.area));
const report = [
  "# v371 Worker Contracts Scan",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  `Critical: ${findings.filter((f) => f.severity === "critical").length}`,
  `Warnings: ${findings.filter((f) => f.severity === "warning").length}`,
  "",
  "| Severity | Area | Finding | Action |",
  "|---|---|---|---|",
  ...findings.map((f) => `| ${f.severity} | ${f.area} | ${f.finding.replaceAll("|", "\\|")} | ${f.action.replaceAll("|", "\\|")} |`),
  "",
  findings.length ? "" : `No v371 worker-contract issues detected. AppShell line count: ${lineCount("src/app/AppShell.tsx")}.`,
].join("\n");
fs.writeFileSync(path.join(root, "docs/V371_WORKER_CONTRACTS_REPORT.md"), report);
console.log(report);
if (findings.some((f) => f.severity === "critical")) process.exit(1);
