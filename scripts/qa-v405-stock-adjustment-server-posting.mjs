import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join('supabase', 'migrations', '20260506240500_v405_stock_adjustment_server_posting.sql');
const packagePath = 'package.json';
const docPath = path.join('docs', 'V405_STOCK_ADJUSTMENT_SERVER_POSTING.md');
const qaDocPath = path.join('docs', 'V405_STOCK_ADJUSTMENT_SERVER_POSTING_QA.md');

const findings = [];
function add(severity, area, finding, action) {
  findings.push({ severity, area, finding, action });
}
function requireFile(file, label) {
  if (!fs.existsSync(file)) add('critical', label, `${file} is missing.`, 'Restore the v405 patch file.');
}
function mustContain(content, token, area, action = 'Add the missing v405 token.') {
  if (!content.includes(token)) add('critical', area, `Missing required token: ${token}`, action);
}

requireFile(migrationPath, 'migration');
requireFile(docPath, 'documentation');
requireFile(packagePath, 'package');

const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const pkg = fs.existsSync(packagePath) ? JSON.parse(fs.readFileSync(packagePath, 'utf8')) : { scripts: {} };

[
  'inventory_adjustment_server_posting_events',
  'inventory_post_adjustment_server',
  'inventory_post_stock_count_server',
  'inventory_post_adjustment(uuid)',
  'inventory_post_stock_count(uuid)',
  'stock_count_post_count(uuid)',
  'posting_batches',
  'posting_batch_lines',
  'finance_journal_entries_backend',
  'finance_journal_lines_backend',
  'inventory_stock_movements',
  'inventory_stock_balances',
  'for update',
  'alreadyPosted',
  'permission denied',
  'grant execute on function public.inventory_post_adjustment_server',
  'grant execute on function public.inventory_post_stock_count_server'
].forEach((token) => mustContain(migration, token, 'migration'));

if (migration.match(/create\s+policy\s+if\s+not\s+exists/i)) {
  add('critical', 'migration', 'CREATE POLICY IF NOT EXISTS is not valid PostgreSQL syntax.', 'Use guarded DO blocks with pg_policies.');
}
if (migration.match(/^\s*\\i\s+/m)) {
  add('critical', 'migration', 'psql include command found in migration.', 'Inline included SQL for Supabase migration runner.');
}
if (migration.charCodeAt(0) === 0xfeff) {
  add('critical', 'migration', 'Migration starts with UTF-8 BOM.', 'Save migration as UTF-8 without BOM.');
}

if (!pkg.scripts?.['qa:v405']) add('critical', 'package', 'qa:v405 script is missing.', 'Add qa:v405 to package scripts.');
if (!pkg.scripts?.['qa:all']?.includes('qa:v405')) add('critical', 'package', 'qa:all does not run qa:v405.', 'Wire qa:v405 into qa:all.');

const critical = findings.filter((f) => f.severity === 'critical').length;
const warnings = findings.filter((f) => f.severity === 'warning').length;
const lines = [
  '# v405 Stock Adjustment Server Posting QA',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  `Critical: ${critical}`,
  `Warnings: ${warnings}`,
  '',
  '| Severity | Area | Finding | Action |',
  '|---|---|---|---|',
  ...findings.map((f) => `| ${f.severity} | ${f.area} | ${f.finding.replaceAll('|', '\\|')} | ${f.action.replaceAll('|', '\\|')} |`),
  findings.length ? '' : 'No v405 stock adjustment server posting issues detected.'
];
fs.writeFileSync(qaDocPath, `${lines.join('\n')}\n`);

console.log(`v405 stock adjustment server posting QA: critical=${critical}, warnings=${warnings}`);
if (critical > 0) {
  console.error(lines.join('\n'));
  process.exit(1);
}
