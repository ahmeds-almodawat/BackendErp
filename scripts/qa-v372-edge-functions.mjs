import fs from "node:fs";
import path from "node:path";
import { buildV372EdgeFunctionAudit, v372RowsToMarkdown } from "../src/engines/enterpriseV372EdgeFunctionAuditEngine.ts";

const root = process.cwd();
const findings = [];

function add(severity, area, finding, action) {
  findings.push({ severity, area, finding, action });
}
function read(file) { return fs.readFileSync(path.join(root, file), "utf8"); }
function exists(file) { return fs.existsSync(path.join(root, file)); }
function walk(dir, predicate = () => true) {
  const out = [];
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return out;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const p = path.join(full, entry.name);
    const rel = path.relative(root, p).replaceAll(path.sep, "/");
    if (entry.isDirectory()) out.push(...walk(rel, predicate));
    else if (predicate(rel)) out.push(rel);
  }
  return out;
}

if (!exists("src/engines/enterpriseV372EdgeFunctionAuditEngine.ts")) {
  add("critical", "file inventory", "Missing v372 audit engine.", "Restore src/engines/enterpriseV372EdgeFunctionAuditEngine.ts.");
}

const functionFiles = walk("supabase/functions", (rel) => rel.endsWith("/index.ts"));
const auditInputs = functionFiles.map((file) => ({ name: file.split("/").at(-2) ?? file, path: file, content: read(file) }));
const summary = buildV372EdgeFunctionAudit(auditInputs);

const pkg = JSON.parse(read("package.json"));
if (!pkg.scripts?.["qa:v372"]) add("critical", "package scripts", "qa:v372 is not defined.", "Add qa:v372 to package.json.");
if (!String(pkg.scripts?.["qa:all"] || "").includes("qa:v372")) add("critical", "package scripts", "qa:all does not include qa:v372.", "Wire qa:v372 into qa:all before typecheck/build.");
if (!pkg.scripts?.["repair:v372:skeletons"]) add("warning", "package scripts", "repair:v372:skeletons is not defined.", "Add the helper script for safely marking skeleton functions dev-only.");

if (exists(".github/workflows/local-quality-gate.yml")) {
  const workflow = read(".github/workflows/local-quality-gate.yml");
  if (!workflow.includes("npm run qa:all")) add("critical", "CI", "GitHub Actions does not run qa:all.", "Update the quality gate workflow to run npm run qa:all.");
} else {
  add("warning", "CI", "No local-quality-gate workflow detected.", "Add a GitHub Actions workflow for qa:all.");
}

if (!functionFiles.length) add("warning", "Edge Functions", "No supabase/functions/**/index.ts files found.", "Confirm the Supabase functions directory is committed.");

for (const row of summary.rows) {
  if (row.returnsMisleadingOk) {
    add("critical", "Edge Functions", `${row.path} is a skeleton/dev placeholder that can still return misleading ok:true.`, "Run npm run repair:v372:skeletons or manually return ok:false with productionAllowed:false/devOnly:true.");
  }
  if (row.status === "production-ready" && (!row.hasPermissionGuard || !row.hasBackendAuthorityHint)) {
    add("critical", "Edge Functions", `${row.path} is classified production-ready without enough guards.`, "Add JWT/permission/scope/service-role/audit markers or classify as dev-only.");
  }
}

if (summary.skeleton > 0) add("warning", "Edge Functions", `${summary.skeleton} functions are still skeleton and not production allowed.`, "Implement them before production backend enablement.");
if (summary.unsafe > 0) add("warning", "Edge Functions", `${summary.unsafe} functions are unsafe for production.`, "Add explicit JWT, permission, scope, service-role, transaction, and audit handling.");

const report = [
  "# v372 Production Edge Function Audit", "", `Generated: ${summary.generatedAt}`, "", "## Summary", "",
  `- Total Edge Functions scanned: ${summary.total}`,
  `- Production-ready: ${summary.productionReady}`,
  `- Dev-only: ${summary.devOnly}`,
  `- Skeleton: ${summary.skeleton}`,
  `- Unsafe: ${summary.unsafe}`,
  `- Deprecated: ${summary.deprecated}`,
  `- Misleading ok:true skeletons: ${summary.misleadingOk}`,
  "", `Next action: ${summary.nextAction}`, "", "## Function Inventory", "", v372RowsToMarkdown(summary.rows), "", "## QA Findings", "",
  `Critical: ${findings.filter((finding) => finding.severity === "critical").length}`,
  `Warnings: ${findings.filter((finding) => finding.severity === "warning").length}`,
  "", "| Severity | Area | Finding | Action |", "|---|---|---|---|",
  ...findings.map((finding) => `| ${finding.severity} | ${finding.area} | ${finding.finding.replaceAll("|", "\\|")} | ${finding.action.replaceAll("|", "\\|")} |`), "",
].join("\n");

fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(path.join(root, "docs/V372_EDGE_FUNCTION_AUDIT.md"), report);
console.log(report);
const criticals = findings.filter((finding) => finding.severity === "critical");
if (criticals.length) {
  console.error(`\nV372 Edge Function audit failed with ${criticals.length} critical finding(s).`);
  process.exit(1);
}
