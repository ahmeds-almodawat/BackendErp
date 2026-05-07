import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const findings = [];
const add = (severity, area, finding, action) => findings.push({ severity, area, finding, action });
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

const requiredFiles = [
  'src/engines/enterpriseV384SourceOfTruthEngine.ts',
  'src/modules/EnterpriseV384SourceOfTruthPage.tsx',
  'supabase/migrations/20260506238400_v384_backend_source_of_truth_gate.sql',
  'docs/V384_BACKEND_SOURCE_OF_TRUTH_GATE.md',
];

for (const file of requiredFiles) {
  if (!exists(file)) add('critical', 'files', `${file} is missing`, 'Add the v384 source-of-truth gate file.');
}

if (exists('package.json')) {
  const pkg = JSON.parse(read('package.json'));
  if (!pkg.scripts?.['qa:v384']) add('critical', 'package.json', 'qa:v384 script is missing', 'Add qa:v384 to package scripts.');
  if (!String(pkg.scripts?.['qa:all'] || '').includes('qa:v384')) add('critical', 'package.json', 'qa:all does not run qa:v384', 'Wire qa:v384 into qa:all.');
}

if (exists('src/app/AppShell.tsx')) {
  const app = read('src/app/AppShell.tsx');
  const required = ['EnterpriseV384SourceOfTruthPage', "'truth'", 'Source of Truth', 'v384 Source of Truth'];
  for (const token of required) {
    if (!app.includes(token)) add('critical', 'AppShell', `AppShell missing ${token}`, 'Wire v384 Source of Truth page into route type, metadata, page map, and sidebar.');
  }
}

if (exists('src/engines/enterpriseV384SourceOfTruthEngine.ts')) {
  const engine = read('src/engines/enterpriseV384SourceOfTruthEngine.ts');
  for (const token of ['V384_AUTHORITY_DEFINITIONS', 'V384_BACKEND_OBJECTS', 'buildV384AuthoritySnapshot', 'v384RowsToCsv']) {
    if (!engine.includes(token)) add('critical', 'engine', `Source-of-truth engine missing ${token}`, 'Keep authority definitions, backend object map, snapshot builder, and CSV export in the engine.');
  }
  for (const blocker of ['finance.posting', 'inventory.ledger', 'pos.replay', 'imports.cutover', 'reports.snapshots']) {
    if (!engine.includes(blocker)) add('critical', 'engine', `Engine missing production blocker ${blocker}`, 'Track every critical ERP source-of-truth workflow.');
  }
}

if (exists('supabase/migrations/20260506238400_v384_backend_source_of_truth_gate.sql')) {
  const sql = read('supabase/migrations/20260506238400_v384_backend_source_of_truth_gate.sql');
  for (const table of ['backend_authority_snapshots', 'backend_authority_events', 'backend_authority_registry']) {
    if (!sql.includes(`public.${table}`)) add('critical', 'migration', `Migration missing ${table}`, 'Add all v384 authority evidence tables.');
  }
  for (const token of ['backend_authority_record_snapshot', 'revoke all on function', 'to service_role', 'drop policy if exists']) {
    if (!sql.includes(token)) add('critical', 'migration', `Migration missing ${token}`, 'Keep service-role-only snapshot writes and safe policy syntax.');
  }
  if (/create\s+policy\s+if\s+not\s+exists/i.test(sql)) add('critical', 'migration', 'Migration uses unsupported CREATE POLICY IF NOT EXISTS', 'Use DROP POLICY IF EXISTS then CREATE POLICY.');
  if (/^\s*\\i\s+/m.test(sql)) add('critical', 'migration', 'Migration contains psql include command', 'Inline SQL instead of using \\i.');
}

const rank = { critical: 3, warning: 2, info: 1 };
findings.sort((a, b) => rank[b.severity] - rank[a.severity] || a.area.localeCompare(b.area));
const report = [
  '# v384 Backend Source of Truth Gate QA',
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
  findings.length ? '' : 'No v384 backend source-of-truth issues detected.',
].join('\n');

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs/V384_BACKEND_SOURCE_OF_TRUTH_GATE_QA.md'), report);
console.log(report);

const criticals = findings.filter((f) => f.severity === 'critical');
if (criticals.length) process.exit(1);
