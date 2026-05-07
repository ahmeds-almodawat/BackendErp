import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const findings = [];

function add(severity, area, finding, action) {
  findings.push({ severity, area, finding, action });
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

const migration = 'supabase/migrations/20260506237900_v379_report_snapshot_worker.sql';
const doc = 'docs/V379_REPORT_SNAPSHOT_WORKER.md';

if (!exists(migration)) add('critical', 'migration', `Missing ${migration}`, 'Restore the v379 migration.');
if (!exists(doc)) add('critical', 'documentation', `Missing ${doc}`, 'Restore the v379 documentation.');

const pkg = JSON.parse(read('package.json'));
if (!pkg.scripts?.['qa:v379']) add('critical', 'package.json', 'qa:v379 is missing.', 'Add the v379 QA script.');
if (!String(pkg.scripts?.['qa:all'] || '').includes('qa:v379')) add('critical', 'package.json', 'qa:v379 is not wired into qa:all.', 'Add qa:v379 to qa:all after qa:v378.');

let sql = '';
if (exists(migration)) sql = read(migration);

const requiredTables = [
  'report_snapshot_runs',
  'report_snapshot_sources',
  'report_snapshot_artifacts',
  'report_snapshot_events',
];

for (const table of requiredTables) {
  if (!new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}`, 'i').test(sql)) {
    add('critical', 'tables', `Missing ${table}.`, 'Create the v379 report snapshot runtime table.');
  }
  if (!new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, 'i').test(sql)) {
    add('critical', 'RLS', `${table} does not enable RLS.`, 'Enable RLS on every report snapshot table.');
  }
}

const requiredFunctions = [
  'worker_report_snapshot_event',
  'worker_report_snapshot_source_counts',
  'worker_enqueue_report_snapshot',
  'worker_acquire_report_snapshot_job',
  'worker_run_report_snapshot_batch',
];

for (const fn of requiredFunctions) {
  if (!new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}\\b`, 'i').test(sql)) {
    add('critical', 'RPC', `Missing ${fn}.`, 'Add the v379 report snapshot RPC.');
  }
  if (!new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}[\\s\\S]+?to\\s+service_role`, 'i').test(sql)) {
    add('critical', 'RPC security', `${fn} is not granted to service_role.`, 'Grant worker RPC execution to service_role.');
  }
}

for (const fn of ['worker_enqueue_job', 'worker_runtime_audit', 'worker_jobs', 'worker_job_runs', 'worker_job_leases', 'worker_job_checkpoints', 'worker_dead_letters']) {
  if (!sql.includes(fn)) {
    add('critical', 'worker runtime integration', `Migration does not reference ${fn}.`, 'Integrate v379 with the v375 worker runtime.');
  }
}

for (const token of [
  'report.snapshot',
  'idempotency',
  'for update skip locked',
  'lease_token',
  'checkpoint',
  'artifact',
  'source_count',
  'total_row_count',
  'completed_with_warning',
  'dead_lettered',
]) {
  if (!sql.toLowerCase().includes(token.toLowerCase())) {
    add('critical', 'runtime behavior', `Missing ${token}.`, 'Keep enqueue/acquire/checkpoint/artifact/retry semantics in v379.');
  }
}

for (const table of [
  'finance_journal_lines_backend',
  'posting_batches',
  'inventory_rebuild_balances',
  'pos_replay_applied_rows',
  'import_cutover_applied_rows',
]) {
  if (!sql.includes(table)) {
    add('warning', 'source coverage', `Source table ${table} is not listed.`, 'Include key source tables for report snapshot freshness evidence.');
  }
}

if (/grant\s+execute\s+on\s+function\s+public\.worker_.*to\s+authenticated/i.test(sql)) {
  add('critical', 'RPC security', 'A v379 worker RPC is granted to authenticated.', 'Worker RPCs must be service_role only.');
}

let docs = '';
if (exists(doc)) docs = read(doc);
for (const token of ['Report Snapshot Worker', 'report_snapshot_runs', 'worker_enqueue_report_snapshot', 'service_role', 'v380']) {
  if (!docs.includes(token)) {
    add('warning', 'documentation', `Documentation missing ${token}.`, 'Refresh docs/V379_REPORT_SNAPSHOT_WORKER.md.');
  }
}

findings.sort((a, b) => ({ critical: 3, warning: 2, info: 1 }[b.severity] - { critical: 3, warning: 2, info: 1 }[a.severity]) || a.area.localeCompare(b.area));

const report = [
  '# v379 Report Snapshot Worker QA',
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
  findings.length ? '' : 'No v379 report snapshot worker issues detected.',
].join('\n');

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs/V379_REPORT_SNAPSHOT_WORKER_QA.md'), report);

console.log(report);

if (findings.some((f) => f.severity === 'critical')) {
  process.exit(1);
}
