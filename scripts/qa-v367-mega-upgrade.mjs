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
  "src/engines/enterpriseV367Engine.ts",
  "src/modules/EnterpriseV367UpgradePage.tsx",
  "scripts/qa-v367-mega-upgrade.mjs",
  "docs/V367_MEGA_UPGRADE_PATCH.md",
  "templates/v367/mega_upgrade_gate_template.csv",
];

for (const file of expectedFiles) {
  if (!exists(file)) {
    add("critical", "file inventory", `Missing expected v367 file: ${file}`, "Restore the file or remove it from the v367 manifest intentionally.");
  }
}

const packageJson = JSON.parse(read("package.json"));
const compatiblePackageNames = new Set(["restaurant-erp-v367-mega-upgrade-patch", "restaurant-erp-v368-route-modularization-patch", "restaurant-erp-v369-midrange-heavy-work-patch", "restaurant-erp-v370-resumable-work-queue-patch", "restaurant-erp-v371-worker-contracts-patch"]);
if (!compatiblePackageNames.has(packageJson.name)) {
  add("critical", "package metadata", `Unexpected package name ${packageJson.name}`, "Keep package identity compatible with the v367/v368 upgrade line.");
}
if (!["1.0.67", "1.0.68", "1.0.69", "1.0.70", "1.0.71"].includes(packageJson.version)) {
  add("critical", "package metadata", `Unexpected package version ${packageJson.version}`, "Keep package version on the v367/v368 upgrade line.");
}
if (!packageJson.scripts?.["qa:v367"]) {
  add("critical", "package scripts", "Missing qa:v367 script", "Add the v367 QA script to package.json.");
}
if (!String(packageJson.scripts?.["qa:all"] || "").includes("qa:v367")) {
  add("critical", "package scripts", "qa:all does not include qa:v367", "Run v367 before the final typecheck/build gate.");
}

const lock = JSON.parse(read("package-lock.json"));
if (lock.name !== packageJson.name || lock.version !== packageJson.version || lock.packages?.[""]?.name !== packageJson.name || lock.packages?.[""]?.version !== packageJson.version) {
  add("critical", "package lock", "package-lock root metadata does not match package.json", "Regenerate or repair package-lock metadata.");
}

const appShell = read("src/app/AppShell.tsx");
if (!appShell.includes("EnterpriseV367UpgradePage")) {
  add("critical", "route wiring", "AppShell is not lazy-loading EnterpriseV367UpgradePage", "Wire the v367 page into the Enterprise route.");
}
if ((!appShell.includes("Restaurant ERP v367 Mega Upgrade") && !appShell.includes("Restaurant ERP v368 Route Modularization") && !appShell.includes("Restaurant ERP v369 Mid-Range Heavy Work") && !appShell.includes("Restaurant ERP v370 Resumable Work Queue") && !appShell.includes("Restaurant ERP v371 Worker Contracts")) || (!appShell.includes("v367 Mega Upgrade") && !appShell.includes("v368 Modular Shell") && !appShell.includes("v369 Heavy Work") && !appShell.includes("v370 Work Queue") && !appShell.includes("v371 Worker Contracts"))) {
  add("critical", "visible versioning", "Topbar/sidebar do not expose the current upgrade identity", "Refresh visible shell labels to the current upgrade.");
}
if (lineCount("src/app/AppShell.tsx") > 2500) {
  add("warning", "AppShell refactor", `AppShell still has ${lineCount("src/app/AppShell.tsx")} lines`, "Continue moving route business logic into module packages.");
}

const engine = read("src/engines/enterpriseV367Engine.ts");
for (const symbol of ["buildV367MegaUpgradeSnapshot", "buildV367GateRows", "buildV367ModuleRows", "buildV367UpgradeWaves", "buildV367QaSuite"]) {
  if (!engine.includes(symbol)) {
    add("critical", "v367 engine", `Missing exported symbol ${symbol}`, "Restore the evaluator API used by the page and QA gate.");
  }
}

const page = read("src/modules/EnterpriseV367UpgradePage.tsx");
if (!page.includes("buildV367MegaUpgradeSnapshot") || !page.includes("v367_mega_upgrade_snapshot.json")) {
  add("critical", "v367 page", "EnterpriseV367UpgradePage is missing evaluator or evidence export wiring", "Restore live snapshot and export controls.");
}

const css = read("src/styles.css");
for (const token of ["--text:", "--muted:", "--accent:", ".v367-page"]) {
  if (!css.includes(token)) {
    add("warning", "styles", `Missing style token ${token}`, "Keep v240/v367 pages readable in dark and light modes.");
  }
}

const productionConfig = read("src/lib/config/productionConfig.ts");
if (!productionConfig.includes("v367-mega-upgrade-patch") && !productionConfig.includes("v368-route-modularization-patch") && !productionConfig.includes("v369-midrange-heavy-work-patch") && !productionConfig.includes("v370-resumable-work-queue-patch") && !productionConfig.includes("v371-worker-contracts-patch")) {
  add("critical", "runtime config", "productionConfig version is not on the v367/v368 upgrade line", "Update production runtime version metadata.");
}

const readme = read("README.md");
const statusDoc = read("docs/CURRENT_LOCAL_STATUS.md");
if (!readme.includes("v367") || !statusDoc.includes("v367")) {
  add("warning", "documentation", "README or current status does not mention v367", "Refresh local status documentation.");
}

const { buildV367MegaUpgradeSnapshot } = await import("../src/engines/enterpriseV367Engine.ts");
const snapshot = buildV367MegaUpgradeSnapshot(
  {
    branches: [],
    stores: [],
    suppliers: [],
    items: [],
    menuItems: [],
    recipeLines: [],
    chartAccounts: [],
    fiscalPeriods: [],
    roles: [],
    userAccounts: [],
    stockMovements: [],
    journals: [],
    audits: [],
  },
  {}
);

try {
  assert.equal(snapshot.version, "v367 Mega Upgrade Patch");
  assert.ok(snapshot.gates.length >= 8, "Expected at least 8 v367 gates");
  assert.ok(snapshot.modules.length >= 8, "Expected module registry coverage rows");
  assert.ok(snapshot.waves.length >= 5, "Expected upgrade wave plan");
  assert.ok(snapshot.qa.some((row) => row.id === "V367-QA-001"), "Expected V367-QA-001");
  assert.ok(Number.isFinite(snapshot.scores.upgradeScore), "Expected numeric upgrade score");
} catch (error) {
  add("critical", "runtime evaluator", error?.message || String(error), "Fix buildV367MegaUpgradeSnapshot output contract.");
}

findings.sort((a, b) => {
  const rank = { critical: 3, warning: 2, info: 1 };
  return rank[b.severity] - rank[a.severity] || a.area.localeCompare(b.area);
});

const report = [
  "# v367 Mega Upgrade Scan",
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
  findings.length ? "" : "No v367 mega-upgrade issues detected by the static scanner.",
].join("\n");

fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(path.join(root, "docs/V367_MEGA_UPGRADE_REPORT.md"), report);

console.log(report);

const criticals = findings.filter((finding) => finding.severity === "critical");
if (criticals.length) {
  console.error(`\nV367 mega-upgrade scan failed with ${criticals.length} critical finding(s).`);
  process.exit(1);
}
