import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const findings = [];
const add = (severity, area, finding, action) => findings.push({ severity, area, finding, action });
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

const migration = 'supabase/migrations/20260506238000_v380_finance_reconciliation_worker.sql';
const doc = 'docs/V380_FINANCE_RECONCILIATION_WORKER.md';

if (!exists(migration)) add('critical', 'file inventory', `Missing ${migration}`, 'Restore the v380 migration.');
if (!exists(doc)) add('critical', 'file inventory', `Missing ${doc}`, 'Restore the v380 documentation.');

const pkg = JSON.parse(read('package.json'));
if (!pkg.scripts?.['qa:v380']) add('critical', 'package scripts', 'qa:v380 is not defined.', 'Add qa:v380 to package.json.');
if (!String(pkg.scripts?.['qa:all'] || '').includes('qa:v380')) add('critical', 'package scripts', 'qa:v380 is not wired into qa:all.', 'Add qa:v380 to qa:all.');

if (exists(migration)) {
  const sql = read(migration);
  for (const token of [
    'finance_reconciliation_runs',
    'finance_reconciliation_checks',
    'finance_reconciliation_mismatches',
    'finance_reconciliation_events',
    'worker_finance_reconciliation_source_counts',
    'worker_enqueue_finance_reconciliation',
    'worker_acquire_finance_reconciliation_job',
    'worker_run_finance_reconciliation_batch',
    'worker_finance_reconciliation_event',
    'finance.reconciliation',
    'worker_enqueue_job',
    'worker_complete_job',
    'worker_fail_job',
    'worker_job_checkpoints',
    'worker_job_artifacts',
    'service_role',
    'revoke execute on function',
    'grant execute on function',
    'finance_journal_lines_backend',
    'trial_balance_debit_credit',
  ]) {
    if (!sql.includes(token)) add('critical', 'migration coverage', `Missing token ${token}`, 'Repair the v380 migration coverage.');
  }

  if (/insert\s+into\s+public\.finance_journal|update\s+public\.finance_journal|delete\s+from\s+public\.finance_journal/i.test(sql)) {
    add('critical', 'finance safety', 'Migration appears to mutate finance journal records.', 'v380 must record reconciliation evidence only.');
  }

  if (!/alter\s+table\s+public\.finance_reconciliation_runs\s+enable\s+row\s+level\s+security/i.test(sql)) {
    add('critical', 'RLS', 'finance_reconciliation_runs RLS is not enabled.', 'Enable RLS on v380 tables.');
  }
}

const rank = { critical: 3, warning: 2, info: 1 };
findings.sort((a, b) => rank[b.severity] - rank[a.severity] || a.area.localeCompare(b.area));

const report = [
  '# v380 Finance Reconciliation Worker QA',
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
  findings.length ? '' : 'No v380 finance reconciliation worker issues detected.',
].join('\n');

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs/V380_FINANCE_RECONCILIATION_WORKER_QA.md'), report);
console.log(report);

if (findings.some((f) => f.severity === 'critical')) process.exit(1);
