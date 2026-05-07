import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [];
const requiredFiles = [
  'src/engines/enterpriseV395V400ProductionReadinessEngine.ts',
  'src/modules/EnterpriseV395V400ProductionReadinessPage.tsx',
  'supabase/migrations/20260506239500_v395_v400_production_readiness_gates.sql',
  'docs/V395_V400_PRODUCTION_READINESS_GATES.md',
  'scripts/qa-v395-v400-production-readiness-gates.mjs',
];

function add(severity, area, finding, action) {
  checks.push({ severity, area, finding, action });
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

for (const rel of requiredFiles) {
  if (!fs.existsSync(path.join(root, rel))) add('critical', 'Required file', `${rel} is missing.`, 'Restore the v395-v400 production readiness patch file.');
}

const app = fs.existsSync(path.join(root, 'src/app/AppShell.tsx')) ? read('src/app/AppShell.tsx') : '';
const pkg = fs.existsSync(path.join(root, 'package.json')) ? JSON.parse(read('package.json')) : { scripts: {} };
const migration = fs.existsSync(path.join(root, 'supabase/migrations/20260506239500_v395_v400_production_readiness_gates.sql')) ? read('supabase/migrations/20260506239500_v395_v400_production_readiness_gates.sql') : '';
const engine = fs.existsSync(path.join(root, 'src/engines/enterpriseV395V400ProductionReadinessEngine.ts')) ? read('src/engines/enterpriseV395V400ProductionReadinessEngine.ts') : '';

const routes = ['tabletGate', 'deploymentGate', 'uatGate', 'securityGate', 'rehearsalGate', 'releaseGate'];
for (const route of routes) {
  if (!app.includes(route)) add('critical', 'Route wiring', `${route} is not wired in AppShell.`, 'Add route key, route meta, nav group, and page mapping.');
}

const gateIds = ['tablet', 'deployment', 'uat', 'security', 'rehearsal', 'release'];
for (const gateId of gateIds) {
  if (!engine.includes(`'${gateId}'`)) add('critical', 'Gate engine', `${gateId} gate is missing from engine union/build logic.`, 'Add gate ID to engine and page rendering.');
}

if (!app.includes('EnterpriseV395V400ProductionReadinessPage')) add('critical', 'Page import', 'Production readiness page is not imported in AppShell.', 'Lazy import EnterpriseV395V400ProductionReadinessPage.');
if (!pkg.scripts?.['qa:v395-v400']) add('critical', 'Package scripts', 'qa:v395-v400 is missing.', 'Add qa:v395-v400 script to package.json.');
if (!String(pkg.scripts?.['qa:all'] || '').includes('qa:v395-v400')) add('critical', 'Package scripts', 'qa:all does not include qa:v395-v400.', 'Wire qa:v395-v400 into qa:all.');

const tables = ['production_readiness_snapshots', 'production_uat_scenarios', 'production_security_findings', 'production_rehearsal_events', 'production_release_signoffs'];
for (const table of tables) {
  if (!migration.includes(`public.${table}`)) add('critical', 'Migration', `${table} table is missing from migration.`, 'Restore v395-v400 migration table.');
}
if (/create\s+policy\s+if\s+not\s+exists/i.test(migration)) add('critical', 'Migration syntax', 'Migration uses unsupported CREATE POLICY IF NOT EXISTS.', 'Use DROP POLICY IF EXISTS + CREATE POLICY.');
if (/^\s*\\i\s+/m.test(migration)) add('critical', 'Migration syntax', 'Migration uses psql include command.', 'Inline SQL content instead.');

const critical = checks.filter((item) => item.severity === 'critical').length;
const warnings = checks.filter((item) => item.severity === 'warning').length;
const report = [
  '# v395-v400 Production Readiness Gates QA',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  `Critical: ${critical}`,
  `Warnings: ${warnings}`,
  '',
  '| Severity | Area | Finding | Action |',
  '|---|---|---|---|',
  ...checks.map((item) => `| ${item.severity} | ${item.area} | ${item.finding.replace(/\|/g, '\\|')} | ${item.action.replace(/\|/g, '\\|')} |`),
  checks.length ? '' : 'No v395-v400 production readiness gate issues detected.',
].join('\n');

fs.writeFileSync(path.join(root, 'docs/V395_V400_PRODUCTION_READINESS_GATES_QA.md'), report, 'utf8');
console.log(report);
if (critical) process.exit(1);
