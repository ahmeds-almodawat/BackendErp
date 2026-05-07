import fs from 'node:fs';
import path from 'node:path';
import { buildV373RlsClosureSummary, v373RowsToMarkdown } from '../src/engines/enterpriseV373RlsClosureEngine.ts';

const root = process.cwd();
const findings = [];
const add = (severity, area, finding, action) => findings.push({ severity, area, finding, action });
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

function walk(dir, predicate = () => true) {
  const out = [];
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return out;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const p = path.join(full, entry.name);
    const rel = path.relative(root, p).replaceAll(path.sep, '/');
    if (entry.isDirectory()) out.push(...walk(rel, predicate));
    else if (predicate(rel)) out.push(rel);
  }
  return out;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

for (const file of [
  'src/engines/enterpriseV373RlsClosureEngine.ts',
  'scripts/qa-v373-rls-closure.mjs',
]) {
  if (!exists(file)) add('critical', 'file inventory', `Missing ${file}`, 'Restore the v373 RLS closure file.');
}

const migrationFiles = walk('supabase/migrations', (rel) => rel.endsWith('.sql')).sort();
if (!migrationFiles.length) add('critical', 'Supabase migrations', 'No Supabase migrations found.', 'Restore supabase/migrations before running RLS closure.');

const enabledByTable = new Map();
const policiesByTable = new Map();
const policyFilesByTable = new Map();

for (const file of migrationFiles) {
  const body = read(file);
  for (const m of body.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?public\.([a-zA-Z0-9_]+)\s+enable\s+row\s+level\s+security/gi)) {
    const table = m[1];
    enabledByTable.set(table, unique([...(enabledByTable.get(table) ?? []), file]));
  }

  for (const m of body.matchAll(/create\s+policy\s+(?:if\s+not\s+exists\s+)?"?([^"\n]+?)"?\s+on\s+public\.([a-zA-Z0-9_]+)/gis)) {
    const policyName = m[1].trim().replace(/\s+/g, ' ');
    const table = m[2];
    policiesByTable.set(table, unique([...(policiesByTable.get(table) ?? []), policyName]));
    policyFilesByTable.set(table, unique([...(policyFilesByTable.get(table) ?? []), file]));
  }
}

const inputs = [...enabledByTable.entries()].map(([table, enabledIn]) => ({
  table,
  enabledIn,
  policyNames: policiesByTable.get(table) ?? [],
  policyFiles: policyFilesByTable.get(table) ?? [],
}));

if (!inputs.length) add('critical', 'RLS scan', 'No RLS-enabled tables detected.', 'Confirm migrations are present and use standard enable row level security syntax.');

const summary = buildV373RlsClosureSummary(inputs);

if (summary.unresolvedTables > 0) {
  add('critical', 'RLS closure', `${summary.unresolvedTables} table(s) are unresolved.`, 'Classify every RLS table as explicit-policy, backend-rpc-only, module-policy-test-required, or guardrail-policy-review.');
}

if (summary.backendRpcOnlyTables > 0) {
  add('warning', 'RLS closure', `${summary.backendRpcOnlyTables} table(s) are backend-rpc-only until explicit module policy tests exist.`, 'Add module RLS/RPC tests before production enablement.');
}

if (summary.modulePolicyTestRequiredTables > 0) {
  add('warning', 'RLS closure', `${summary.modulePolicyTestRequiredTables} master/general table(s) require explicit policy tests.`, 'Add branch/company scope read/write tests or direct policies.');
}

const pkg = JSON.parse(read('package.json'));
if (!pkg.scripts?.['qa:v373']) add('critical', 'package scripts', 'qa:v373 is not defined.', 'Add qa:v373 to package.json.');
if (!String(pkg.scripts?.['qa:all'] ?? '').includes('qa:v373')) add('critical', 'package scripts', 'qa:v373 is not wired into qa:all.', 'Insert qa:v373 after qa:v372 and before later gates.');

const docsDir = path.join(root, 'docs');
fs.mkdirSync(docsDir, { recursive: true });

const report = [
  '# v373 RLS Closure Report',
  '',
  `Generated: ${summary.generatedAt}`,
  '',
  '## Summary',
  '',
  `- Total RLS-enabled tables: ${summary.totalTables}`,
  `- Explicit policy tables: ${summary.explicitPolicyTables}`,
  `- Backend/RPC-only documented tables: ${summary.backendRpcOnlyTables}`,
  `- Module policy-test required tables: ${summary.modulePolicyTestRequiredTables}`,
  `- Guardrail review tables: ${summary.guardrailPolicyReviewTables}`,
  `- Critical-risk tables: ${summary.criticalRiskTables}`,
  `- High-risk tables: ${summary.highRiskTables}`,
  '',
  `Next action: ${summary.nextAction}`,
  '',
  '## Closure Matrix',
  '',
  v373RowsToMarkdown(summary.rows),
  '',
  '## QA Findings',
  '',
  `Critical: ${findings.filter((f) => f.severity === 'critical').length}`,
  `Warnings: ${findings.filter((f) => f.severity === 'warning').length}`,
  '',
  '| Severity | Area | Finding | Action |',
  '|---|---|---|---|',
  ...findings.map((f) => `| ${f.severity} | ${f.area} | ${f.finding.replaceAll('|', '\\|')} | ${f.action.replaceAll('|', '\\|')} |`),
  '',
].join('\n');

fs.writeFileSync(path.join(docsDir, 'V373_RLS_CLOSURE_REPORT.md'), report);
fs.writeFileSync(path.join(docsDir, 'V373_RLS_CLOSURE_REGISTRY.json'), JSON.stringify(summary, null, 2));

console.log(report);

const criticals = findings.filter((f) => f.severity === 'critical');
if (criticals.length) {
  console.error(`\nV373 RLS closure scan failed with ${criticals.length} critical finding(s).`);
  process.exit(1);
}
