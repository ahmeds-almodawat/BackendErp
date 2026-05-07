import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const findings = [];
const add = (severity, area, finding, action) => findings.push({ severity, area, finding, action });
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

const requiredFiles = [
  'src/engines/enterpriseV383RBACHardeningEngine.ts',
  'src/modules/EnterpriseV383RBACPage.tsx',
  'supabase/migrations/20260506238300_v383_rbac_production_hardening.sql',
  'docs/V383_RBAC_PRODUCTION_HARDENING.md',
];

for (const file of requiredFiles) {
  if (!exists(file)) add('critical', 'files', `${file} is missing`, 'Add the v383 RBAC hardening file.');
}

if (exists('package.json')) {
  const pkg = JSON.parse(read('package.json'));
  if (!pkg.scripts?.['qa:v383']) add('critical', 'package.json', 'qa:v383 script is missing', 'Add qa:v383 to package scripts.');
  if (!String(pkg.scripts?.['qa:all'] || '').includes('qa:v383')) add('critical', 'package.json', 'qa:all does not run qa:v383', 'Wire qa:v383 into qa:all.');
}

if (exists('src/app/AppShell.tsx')) {
  const app = read('src/app/AppShell.tsx');
  const required = ['EnterpriseV383RBACPage', "'rbac'", 'RBAC Gate', 'v383 RBAC Gate'];
  for (const token of required) {
    if (!app.includes(token)) add('critical', 'AppShell', `AppShell missing ${token}`, 'Wire v383 RBAC page into route type, metadata, page map, and sidebar.');
  }
}

if (exists('src/engines/enterpriseV383RBACHardeningEngine.ts')) {
  const engine = read('src/engines/enterpriseV383RBACHardeningEngine.ts');
  for (const token of ['V383_ROUTE_REQUIREMENTS', 'V383_RPC_REQUIREMENTS', 'V383_DANGEROUS_ACTIONS', 'buildV383RBACSnapshot']) {
    if (!engine.includes(token)) add('critical', 'engine', `RBAC engine missing ${token}`, 'Keep route, RPC, dangerous action, and snapshot builders in the engine.');
  }
}

if (exists('supabase/migrations/20260506238300_v383_rbac_production_hardening.sql')) {
  const sql = read('supabase/migrations/20260506238300_v383_rbac_production_hardening.sql');
  for (const table of ['rbac_gate_snapshots', 'rbac_gate_events', 'rbac_route_permission_registry', 'rbac_rpc_permission_registry', 'rbac_dangerous_action_registry']) {
    if (!sql.includes(`public.${table}`)) add('critical', 'migration', `Migration missing ${table}`, 'Add all v383 RBAC evidence tables.');
  }
  for (const token of ['rbac_record_gate_snapshot', 'revoke all on function', 'to service_role', 'drop policy if exists']) {
    if (!sql.includes(token)) add('critical', 'migration', `Migration missing ${token}`, 'Keep service-role-only write posture and safe policy syntax.');
  }
  if (/create\s+policy\s+if\s+not\s+exists/i.test(sql)) add('critical', 'migration', 'Migration uses unsupported CREATE POLICY IF NOT EXISTS', 'Use DROP POLICY IF EXISTS then CREATE POLICY.');
  if (/^\s*\\i\s+/m.test(sql)) add('critical', 'migration', 'Migration contains psql include command', 'Inline SQL instead of using \\i.');
}

const rank = { critical: 3, warning: 2, info: 1 };
findings.sort((a, b) => rank[b.severity] - rank[a.severity] || a.area.localeCompare(b.area));
const report = [
  '# v383 RBAC Production Hardening QA',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  `Critical: ${findings.filter((f) => f.severity === 'critical').length}`,
  `Warnings: ${findings.filter((f) => f.severity === 'warning').length}`,
  '',
  '| Severity | Area | Finding | Action |',
  '|---|---|---|---|',
  ...findings.map((f) => `| ${f.severity} | ${f.area} | ${f.finding.replaceAll('|', '\\|')} | ${f.action.replaceAll('|', '\\|')} |`),
  '',
  findings.length ? '' : 'No v383 RBAC hardening issues detected.',
].join('\n');

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs/V383_RBAC_PRODUCTION_HARDENING_QA.md'), report);
console.log(report);

const criticals = findings.filter((f) => f.severity === 'critical');
if (criticals.length) process.exit(1);
