import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationPath = path.join(root, 'supabase', 'migrations', '20260506240300_v403_pos_day_settlement_server_posting.sql');
const packagePath = path.join(root, 'package.json');
const qaDocPath = path.join(root, 'docs', 'V403_POS_DAY_SETTLEMENT_SERVER_POSTING_QA.md');

const findings = [];
function add(severity, area, finding, action) {
  findings.push({ severity, area, finding, action });
}
function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}
function requireIncludes(text, token, area, action = 'Restore the expected v403 POS day settlement server-posting implementation.') {
  if (!text.includes(token)) add('critical', area, `Missing required token: ${token}`, action);
}

const migration = read(migrationPath);
const pkg = JSON.parse(read(packagePath) || '{}');

if (!migration) add('critical', 'migration', 'v403 migration file is missing.', 'Add supabase/migrations/20260506240300_v403_pos_day_settlement_server_posting.sql.');

[
  'pos_day_server_posting_events',
  'pos_day_server_posting_event',
  'pos_day_payment_account',
  'sales_post_pos_day_server',
  'sales_post_pos_batch',
  'live_sales_post_pos_batch',
  'posting_batches',
  'posting_batch_lines',
  'finance_journal_entries_backend',
  'finance_journal_lines_backend',
  'vat_transactions',
  'paymentTotal',
  'revenueAmount',
  'vatAmount',
  'cogsPosted',
  'settlement_over_short_account',
  'for update',
  'app_current_user_has_permission',
  'No open fiscal period found',
  'sales_pos_batches',
  'live_pos_import_batches',
].forEach((token) => requireIncludes(migration, token, 'migration'));

if (/create\s+policy\s+if\s+not\s+exists/i.test(migration)) {
  add('critical', 'sql-syntax', 'CREATE POLICY IF NOT EXISTS is not PostgreSQL-compatible.', 'Use guarded DO blocks or DROP POLICY IF EXISTS + CREATE POLICY.');
}
if (/^\s*\\i\s+/m.test(migration)) {
  add('critical', 'sql-syntax', 'psql include command found in migration.', 'Inline SQL includes before Supabase migration reset.');
}
if (/unique\s*\([^;]*coalesce\s*\(/i.test(migration)) {
  add('critical', 'sql-syntax', 'Table-level UNIQUE expression detected.', 'Use a unique expression index instead of UNIQUE(...) table constraint.');
}
if (/ok:\s*true|mode:\s*['\"]v\d+-skeleton|Production implementation placeholder/i.test(migration)) {
  add('critical', 'implementation', 'Migration appears to contain skeleton/placeholder success behavior.', 'Keep v403 as real server-side posting SQL, not a placeholder.');
}

const scripts = pkg.scripts || {};
if (scripts['qa:v403'] !== 'node scripts/qa-v403-pos-day-settlement-server-posting.mjs') {
  add('critical', 'package', 'qa:v403 script is missing or incorrect.', 'Wire qa:v403 in package.json.');
}
if (!String(scripts['qa:all'] || '').includes('npm run qa:v403')) {
  add('critical', 'package', 'qa:all does not include qa:v403.', 'Add npm run qa:v403 to qa:all after qa:v402.');
}

const critical = findings.filter((f) => f.severity === 'critical').length;
const warnings = findings.filter((f) => f.severity === 'warning').length;
const generated = new Date().toISOString();
const rows = findings.map((f) => `| ${f.severity} | ${f.area} | ${f.finding.replaceAll('|', '\\|')} | ${f.action.replaceAll('|', '\\|')} |`).join('\n');
const doc = `# v403 POS Day Settlement Server Posting QA\n\nGenerated: ${generated}\n\nCritical: ${critical}\nWarnings: ${warnings}\n\n| Severity | Area | Finding | Action |\n|---|---|---|---|\n${rows}\n\n${findings.length ? '' : 'No v403 POS day settlement server-posting issues detected.'}\n`;
fs.mkdirSync(path.dirname(qaDocPath), { recursive: true });
fs.writeFileSync(qaDocPath, doc);
console.log(doc);
if (critical > 0) process.exit(1);
