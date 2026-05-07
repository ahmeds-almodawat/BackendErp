import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join('supabase', 'migrations', '20260506240100_v401_purchase_invoice_server_posting.sql');
const docPath = path.join('docs', 'V401_PURCHASE_INVOICE_SERVER_POSTING.md');
const pkgPath = 'package.json';

const issues = [];
function check(condition, severity, area, finding, action) {
  if (!condition) issues.push({ severity, area, finding, action });
}

const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const pkg = fs.existsSync(pkgPath) ? fs.readFileSync(pkgPath, 'utf8') : '';

check(Boolean(migration), 'critical', 'migration', 'v401 migration file is missing.', `Create ${migrationPath}.`);
check(fs.existsSync(docPath), 'warning', 'documentation', 'v401 documentation is missing.', `Create ${docPath}.`);
check(pkg.includes('qa:v401'), 'critical', 'package', 'qa:v401 script is not registered.', 'Add qa:v401 to package.json.');
check(pkg.includes('npm run qa:v401'), 'critical', 'package', 'qa:v401 is not included in qa:all.', 'Wire qa:v401 into qa:all.');

const requiredTerms = [
  'purchasing_post_purchase_invoice_server',
  'purchase_invoice_server_posting_events',
  'posting_batches',
  'posting_batch_lines',
  'finance_journal_entries_backend',
  'finance_journal_lines_backend',
  'ap_subledger_transactions',
  'vat_transactions',
  'inventory_stock_movements',
  'inventory_stock_balances',
  'finance_lock_posting_source',
  'finance_validate_posting_batch',
  'finance_can_post_to_period',
  'for update',
  'permission denied',
  'Only approved or validated purchase invoices can be server-posted',
  'on conflict (store_id, item_id) do update',
  'create or replace function public.purchasing_post_purchase_invoice(invoice_id uuid)'
];
for (const term of requiredTerms) {
  check(migration.includes(term), 'critical', 'migration', `Missing required v401 term: ${term}`, 'Ensure the server-side purchase invoice posting migration contains the required posting logic.');
}

const forbidden = [
  'create policy if not exists',
  '\\i ',
  'unique(company_id, source_system, import_type, batch_key, coalesce'
];
for (const term of forbidden) {
  check(!migration.toLowerCase().includes(term.toLowerCase()), 'critical', 'migration', `Forbidden SQL pattern remains in v401 migration: ${term}`, 'Use PostgreSQL-compatible guarded policy/index syntax.');
}

const report = [
  '# v401 Purchase Invoice Server Posting QA',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  `Critical: ${issues.filter(i => i.severity === 'critical').length}`,
  `Warnings: ${issues.filter(i => i.severity === 'warning').length}`,
  '',
  '| Severity | Area | Finding | Action |',
  '|---|---|---|---|',
  ...issues.map(i => `| ${i.severity} | ${i.area} | ${i.finding.replaceAll('|','\\|')} | ${i.action.replaceAll('|','\\|')} |`),
  issues.length ? '' : 'No v401 purchase invoice server posting issues detected.',
  ''
].join('\n');

fs.writeFileSync(path.join('docs', 'V401_PURCHASE_INVOICE_SERVER_POSTING_QA.md'), report);

console.log(report);
if (issues.some(i => i.severity === 'critical')) process.exit(1);
