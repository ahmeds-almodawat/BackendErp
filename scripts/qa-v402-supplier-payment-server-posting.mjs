import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join('supabase', 'migrations', '20260506240200_v402_supplier_payment_server_posting.sql');
const docPath = path.join('docs', 'V402_SUPPLIER_PAYMENT_SERVER_POSTING.md');
const pkgPath = 'package.json';

const issues = [];
function check(condition, severity, area, finding, action) {
  if (!condition) issues.push({ severity, area, finding, action });
}

const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';
const pkg = fs.existsSync(pkgPath) ? fs.readFileSync(pkgPath, 'utf8') : '';

check(Boolean(migration), 'critical', 'migration', 'v402 migration file is missing.', `Create ${migrationPath}.`);
check(fs.existsSync(docPath), 'warning', 'documentation', 'v402 documentation is missing.', `Create ${docPath}.`);
check(pkg.includes('qa:v402'), 'critical', 'package', 'qa:v402 script is not registered.', 'Add qa:v402 to package.json.');
check(pkg.includes('npm run qa:v402'), 'critical', 'package', 'qa:v402 is not included in qa:all.', 'Wire qa:v402 into qa:all.');

const requiredTerms = [
  'purchasing_post_supplier_payment_server',
  'supplier_payment_server_posting_events',
  'supplier_payment_applications',
  'posting_batches',
  'posting_batch_lines',
  'finance_journal_entries_backend',
  'finance_journal_lines_backend',
  'ap_subledger_transactions',
  'finance_lock_posting_source',
  'finance_validate_posting_batch',
  'finance_can_post_to_period',
  'for update',
  'permission denied: finance.post required',
  'Only approved supplier payments can be server-posted',
  'Supplier payment exceeds open AP balance',
  "source_type = 'supplier_payment'",
  "source_type <> 'supplier_payment'",
  "status = 'posted'",
  'create or replace function public.purchasing_post_supplier_payment(payment_id uuid)',
  'grant execute on function public.purchasing_post_supplier_payment_server(uuid, uuid, date, jsonb, boolean) to authenticated'
];
for (const term of requiredTerms) {
  check(migration.includes(term), 'critical', 'migration', `Missing required v402 term: ${term}`, 'Ensure the server-side supplier payment posting migration contains the required posting logic.');
}

const forbidden = [
  'create policy if not exists',
  '\\i ',
  'unique(company_id, source_system, import_type, batch_key, coalesce'
];
for (const term of forbidden) {
  check(!migration.toLowerCase().includes(term.toLowerCase()), 'critical', 'migration', `Forbidden SQL pattern remains in v402 migration: ${term}`, 'Use PostgreSQL-compatible guarded policy/index syntax.');
}

const report = [
  '# v402 Supplier Payment Server Posting QA',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  `Critical: ${issues.filter(i => i.severity === 'critical').length}`,
  `Warnings: ${issues.filter(i => i.severity === 'warning').length}`,
  '',
  '| Severity | Area | Finding | Action |',
  '|---|---|---|---|',
  ...issues.map(i => `| ${i.severity} | ${i.area} | ${i.finding.replaceAll('|','\\|')} | ${i.action.replaceAll('|','\\|')} |`),
  issues.length ? '' : 'No v402 supplier payment server posting issues detected.',
  ''
].join('\n');

fs.writeFileSync(path.join('docs', 'V402_SUPPLIER_PAYMENT_SERVER_POSTING_QA.md'), report);

console.log(report);
if (issues.some(i => i.severity === 'critical')) process.exit(1);
