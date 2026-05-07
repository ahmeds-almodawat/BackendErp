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
  "src/modules/analytics/SmartAnalysisPage.tsx",
  "src/modules/reports/ReportsPage.tsx",
  "src/modules/imports/ImportExportPage.tsx",
  "src/modules/imports/importCsvUtils.ts",
  "scripts/qa-v368-route-modularization.mjs",
  "docs/V368_ROUTE_MODULARIZATION.md",
  "templates/v368/route_modularization_checklist.csv",
];

for (const file of expectedFiles) {
  if (!exists(file)) {
    add("critical", "file inventory", `Missing expected v368 file: ${file}`, "Restore the file or update the v368 manifest intentionally.");
  }
}

const packageJson = JSON.parse(read("package.json"));
if (!["restaurant-erp-v368-route-modularization-patch", "restaurant-erp-v369-midrange-heavy-work-patch", "restaurant-erp-v370-resumable-work-queue-patch", "restaurant-erp-v371-worker-contracts-patch"].includes(packageJson.name)) {
  add("critical", "package metadata", `Unexpected package name ${packageJson.name}`, "Keep package identity compatible with the v368/v369 upgrade line.");
}
if (!["1.0.68", "1.0.69", "1.0.70", "1.0.71"].includes(packageJson.version)) {
  add("critical", "package metadata", `Unexpected package version ${packageJson.version}`, "Keep package version on the v368/v369 upgrade line.");
}
if (!packageJson.scripts?.["qa:v368"]) {
  add("critical", "package scripts", "Missing qa:v368 script", "Add the v368 route modularization QA script.");
}
if (!String(packageJson.scripts?.["qa:all"] || "").includes("qa:v368")) {
  add("critical", "package scripts", "qa:all does not include qa:v368", "Run the v368 gate before typecheck/build.");
}

const lock = JSON.parse(read("package-lock.json"));
if (lock.name !== packageJson.name || lock.version !== packageJson.version || lock.packages?.[""]?.name !== packageJson.name || lock.packages?.[""]?.version !== packageJson.version) {
  add("critical", "package lock", "package-lock root metadata does not match package.json", "Regenerate or repair package-lock metadata.");
}

const appShell = read("src/app/AppShell.tsx");
const appShellLines = lineCount("src/app/AppShell.tsx");
if (appShellLines > 2400) {
  add("critical", "AppShell budget", `AppShell has ${appShellLines} lines`, "Keep route-owned page implementations out of AppShell.");
}
for (const symbol of ["SmartAnalysisRoutePage", "ReportsRoutePage", "ImportExportRoutePage", "EnterpriseV367UpgradePage"]) {
  if (!appShell.includes(symbol)) {
    add("critical", "route wiring", `Missing lazy route symbol ${symbol}`, "Restore lazy module route wiring in AppShell.");
  }
}
for (const removed of ["function SmartAnalysisPage(", "function ReportsPage(", "function ImportExportPage(", "type ImportRowValidation"]) {
  if (appShell.includes(removed)) {
    add("critical", "route ownership", `AppShell still contains ${removed}`, "Move page-owned implementation back into its module package.");
  }
}
if ((!appShell.includes("Restaurant ERP v368 Route Modularization") && !appShell.includes("Restaurant ERP v369 Mid-Range Heavy Work") && !appShell.includes("Restaurant ERP v370 Resumable Work Queue") && !appShell.includes("Restaurant ERP v371 Worker Contracts")) || (!appShell.includes("v368 Modular Shell") && !appShell.includes("v369 Heavy Work") && !appShell.includes("v370 Work Queue") && !appShell.includes("v371 Worker Contracts"))) {
  add("critical", "visible versioning", "Shell labels do not expose the current route-modular upgrade identity", "Refresh sidebar/topbar release labels.");
}
if (!appShell.includes("normalizeImportKey") || !appShell.includes("importCsvUtils")) {
  add("warning", "shared import utilities", "Inventory CSV upload is not clearly using the shared import CSV utilities", "Keep CSV parsing helpers in src/modules/imports/importCsvUtils.ts.");
}

const smartPage = read("src/modules/analytics/SmartAnalysisPage.tsx");
if (!smartPage.includes("v368 route-owned analytics") || !smartPage.includes("export default function SmartAnalysisPage")) {
  add("critical", "smart analysis module", "Smart Analysis route-owned page is missing release identity or default export", "Restore the route-owned analytics page contract.");
}
for (const token of ["qualityRows", "analyticsTotals", "exportKpis", "periodLabel"]) {
  if (!smartPage.includes(token)) {
    add("warning", "smart analysis module", `Smart Analysis page missing expected capability token ${token}`, "Keep the route useful after extracting it from AppShell.");
  }
}

const reportsPage = read("src/modules/reports/ReportsPage.tsx");
if (!reportsPage.includes("ReportingTruthPanel") || !reportsPage.includes("export default function ReportsPage")) {
  add("critical", "reports module", "Reports route-owned page is missing reporting truth panel or default export", "Restore ReportsPage module wiring.");
}

const importPage = read("src/modules/imports/ImportExportPage.tsx");
if (!importPage.includes("ImportStagingPanel") || !importPage.includes("export default function ImportExportPage")) {
  add("critical", "imports module", "Import / Export route-owned page is missing staging panel or default export", "Restore ImportExportPage module wiring.");
}

const importUtils = read("src/modules/imports/importCsvUtils.ts");
for (const symbol of ["normalizeImportKey", "parseCsvText", "numberValue"]) {
  if (!importUtils.includes(`function ${symbol}`)) {
    add("critical", "shared import utilities", `Missing utility ${symbol}`, "Restore shared CSV helpers used by inventory uploads.");
  }
}

const productionConfig = read("src/lib/config/productionConfig.ts");
if (!productionConfig.includes("v368-route-modularization-patch") && !productionConfig.includes("v369-midrange-heavy-work-patch") && !productionConfig.includes("v370-resumable-work-queue-patch") && !productionConfig.includes("v371-worker-contracts-patch")) {
  add("critical", "runtime config", "productionConfig version is not on the v368/v369 upgrade line", "Update production runtime version metadata.");
}

const readme = read("README.md");
const status = read("docs/CURRENT_LOCAL_STATUS.md");
if (!readme.includes("v368") || !status.includes("v368")) {
  add("warning", "documentation", "README or current local status does not mention v368", "Refresh local release documentation.");
}

findings.sort((a, b) => {
  const rank = { critical: 3, warning: 2, info: 1 };
  return rank[b.severity] - rank[a.severity] || a.area.localeCompare(b.area);
});

const report = [
  "# v368 Route Modularization Scan",
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
  findings.length ? "" : `No v368 route-modularization issues detected. AppShell line count: ${appShellLines}.`,
].join("\n");

fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(path.join(root, "docs/V368_ROUTE_MODULARIZATION_REPORT.md"), report);

console.log(report);

const criticals = findings.filter((finding) => finding.severity === "critical");
if (criticals.length) {
  console.error(`\nV368 route-modularization scan failed with ${criticals.length} critical finding(s).`);
  process.exit(1);
}
