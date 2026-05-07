import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const findings = [];
const add = (severity, area, finding, action) => findings.push({ severity, area, finding, action });
const exists = (file) => fs.existsSync(path.join(root, file));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const requiredFiles = [
  'src/engines/enterpriseV382BackendModeEngine.ts',
  'src/modules/EnterpriseV382BackendModePage.tsx',
  'supabase/migrations/20260506238200_v382_backend_mode_gate.sql',
  'docs/V382_BACKEND_MODE_CUTOVER_GATE.md',
  'scripts/qa-v382-backend-mode-gate.mjs',
];

for (const file of requiredFiles) {
  if (!exists(file)) add('critical', 'file inventory', `Missing ${file}`, 'Restore the v382 backend mode gate file.');
}

const pkg = JSON.parse(read('package.json'));
if (!pkg.scripts?.['qa:v382']) add('critical', 'package scripts', 'qa:v382 missing', 'Wire qa:v382 to scripts/qa-v382-backend-mode-gate.mjs.');
if (!String(pkg.scripts?.['qa:all'] || '').includes('qa:v382')) add('critical', 'package scripts', 'qa:v382 is not included in qa:all', 'Add qa:v382 to qa:all.');

const appShell = read('src/app/AppShell.tsx');
for (const token of ['EnterpriseV382BackendModePage', "'backend'", 'Backend Mode', 'v382 Backend Mode']) {
  if (!appShell.includes(token)) add('critical', 'AppShell wiring', `Missing ${token}`, 'Wire the v382 backend route into AppShell.');
}

const engine = read('src/engines/enterpriseV382BackendModeEngine.ts');
for (const token of ['buildV382BackendModeSnapshot', 'serviceRoleExposure', 'production-blocked', 'VITE_SUPABASE_SERVICE_ROLE_KEY', 'envRecipe']) {
  if (!engine.includes(token)) add('critical', 'v382 engine', `Missing ${token}`, 'Restore backend gate checks.');
}

const page = read('src/modules/EnterpriseV382BackendModePage.tsx');
for (const token of ['Backend Mode Gate', 'Staging .env.local recipe', 'service-role', 'buildV382BackendModeSnapshot']) {
  if (!page.includes(token)) add('critical', 'v382 page', `Missing ${token}`, 'Restore backend mode UI evidence.');
}

const migration = read('supabase/migrations/20260506238200_v382_backend_mode_gate.sql');
for (const token of ['backend_mode_gate_snapshots', 'backend_mode_gate_events', 'backend_mode_gate_event', 'enable row level security']) {
  if (!migration.includes(token)) add('critical', 'v382 migration', `Missing ${token}`, 'Restore v382 evidence migration.');
}
if (/create\s+policy\s+if\s+not\s+exists/i.test(migration)) add('critical', 'SQL syntax', 'Migration uses unsupported CREATE POLICY IF NOT EXISTS', 'Use drop policy if exists + create policy.');
if (/^\s*\\i\s+/m.test(migration)) add('critical', 'SQL syntax', 'Migration contains psql include command', 'Inline SQL in Supabase migrations.');

try {
  const { buildV382BackendModeSnapshot } = await import('../src/engines/enterpriseV382BackendModeEngine.ts');
  const local = buildV382BackendModeSnapshot({});
  if (local.version !== 'v382 Backend Mode Cutover Gate') add('critical', 'runtime engine', 'Unexpected v382 engine version', 'Fix buildV382BackendModeSnapshot version.');
  const prodBlocked = buildV382BackendModeSnapshot({ VITE_RUNTIME_MODE: 'production' });
  if (prodBlocked.gateStatus !== 'production-blocked') add('critical', 'runtime engine', 'Production without Supabase was not blocked', 'Production must be blocked without backend configuration.');
  const unsafe = buildV382BackendModeSnapshot({ VITE_RUNTIME_MODE: 'staging', VITE_SUPABASE_SERVICE_ROLE_KEY: 'secret' });
  if (unsafe.gateStatus !== 'unsafe') add('critical', 'runtime engine', 'Frontend service-role exposure was not marked unsafe', 'Detect VITE_ service keys as critical.');
} catch (error) {
  add('critical', 'runtime import', error?.message || String(error), 'Fix v382 TypeScript engine import.');
}

findings.sort((a, b) => ({ critical: 3, warning: 2, info: 1 }[b.severity] - { critical: 3, warning: 2, info: 1 }[a.severity]) || a.area.localeCompare(b.area));

const report = [
  '# v382 Backend Mode Gate QA',
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
  findings.length ? '' : 'No v382 backend mode gate issues detected.',
].join('\n');

fs.writeFileSync(path.join(root, 'docs/V382_BACKEND_MODE_GATE_QA.md'), report);
console.log(report);

if (findings.some((f) => f.severity === 'critical')) process.exit(1);
