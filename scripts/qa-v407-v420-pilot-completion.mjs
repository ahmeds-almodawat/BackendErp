import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'src/engines/enterpriseV407V420PilotEngine.ts',
  'src/modules/EnterpriseV407V420PilotCenterPage.tsx',
  'supabase/migrations/20260506240700_v407_v420_pilot_completion.sql',
  'docs/V407_V420_PRODUCTION_PILOT_COMPLETION.md',
];

const requiredPackageScripts = ['qa:v407-v420'];
const requiredAppShellMarkers = [
  'EnterpriseV407V420PilotCenterPage',
  "pilot: { en: 'Pilot Center'",
  "'pilot'",
  'v420 Pilot Center',
];
const requiredMigrationMarkers = [
  'pilot_completion_snapshots',
  'pilot_posting_rpc_catalog',
  'pilot_release_checklist',
  'pilot_completion_rpc_readiness',
  'pilot_record_completion_snapshot',
  'purchasing_post_purchase_invoice',
  'finance_close_period',
];
const requiredEngineMarkers = [
  'V407_POSTING_ACTIONS',
  'purchasing_post_purchase_invoice',
  'purchasing_post_supplier_payment',
  'sales_post_pos_batch',
  'production_post_batch',
  'inventory_post_adjustment',
  'inventory_post_stock_count',
  'finance_post_vat_settlement',
  'finance_close_period',
];

const findings = [];
function add(severity, area, finding, action) { findings.push({ severity, area, finding, action }); }
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

for (const rel of requiredFiles) {
  if (!fs.existsSync(path.join(root, rel))) add('critical', 'file', `${rel} is missing.`, 'Re-apply the v407-v420 patch.');
}

const pkg = JSON.parse(read('package.json'));
for (const script of requiredPackageScripts) {
  if (!pkg.scripts?.[script]) add('critical', 'package.json', `${script} is missing.`, 'Wire the QA script in package.json.');
}
if (!String(pkg.scripts?.['qa:all'] || '').includes('qa:v407-v420')) add('critical', 'package.json', 'qa:all does not include qa:v407-v420.', 'Add qa:v407-v420 to qa:all before typecheck/build.');

const app = read('src/app/AppShell.tsx');
for (const marker of requiredAppShellMarkers) {
  if (!app.includes(marker)) add('critical', 'AppShell', `Missing marker: ${marker}`, 'Ensure Pilot Center route is imported, labelled, navigated and rendered.');
}

const migration = read('supabase/migrations/20260506240700_v407_v420_pilot_completion.sql');
for (const marker of requiredMigrationMarkers) {
  if (!migration.includes(marker)) add('critical', 'migration', `Missing migration marker: ${marker}`, 'Restore the v407-v420 migration content.');
}
if (/create\s+policy\s+if\s+not\s+exists/i.test(migration)) add('critical', 'migration', 'CREATE POLICY IF NOT EXISTS is not valid PostgreSQL syntax.', 'Use drop policy if exists + create policy.');
if (/^\s*\\i\s+/m.test(migration)) add('critical', 'migration', 'psql include command found in migration.', 'Inline SQL includes before Supabase reset.');

const engine = read('src/engines/enterpriseV407V420PilotEngine.ts');
for (const marker of requiredEngineMarkers) {
  if (!engine.includes(marker)) add('critical', 'engine', `Missing engine marker: ${marker}`, 'Restore the posting action catalog.');
}

const report = [
  '# v407-v420 Production Pilot Completion QA',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  `Critical: ${findings.filter((f) => f.severity === 'critical').length}`,
  `Warnings: ${findings.filter((f) => f.severity === 'warning').length}`,
  '',
  '| Severity | Area | Finding | Action |',
  '|---|---|---|---|',
  ...findings.map((f) => `| ${f.severity} | ${f.area} | ${f.finding} | ${f.action} |`),
  findings.length ? '' : 'No v407-v420 pilot completion issues detected.',
].join('\n');

fs.writeFileSync(path.join(root, 'docs/V407_V420_PRODUCTION_PILOT_COMPLETION_QA.md'), report);

if (findings.some((f) => f.severity === 'critical')) {
  console.error(report);
  process.exit(1);
}
console.log(report);
