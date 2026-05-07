import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const findings = [];
const add = (severity, area, finding, action) => findings.push({ severity, area, finding, action });
const exists = (file) => fs.existsSync(path.join(root, file));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const migration = 'supabase/migrations/20260506237800_v378_import_cutover_worker.sql';
const doc = 'docs/V378_IMPORT_CUTOVER_WORKER.md';

for (const file of [migration, doc, 'scripts/qa-v378-import-cutover-worker.mjs']) {
  if (!exists(file)) add('critical', 'file inventory', `Missing ${file}`, 'Restore the v378 patch file.');
}

if (exists(migration)) {
  const sql = read(migration);
  for (const table of ['import_cutover_runs', 'import_cutover_applied_rows', 'import_cutover_events']) {
    if (!new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}`, 'i').test(sql)) {
      add('critical', 'schema', `Missing table ${table}`, 'Add the import cutover runtime table.');
    }
    if (!new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, 'i').test(sql)) {
      add('critical', 'RLS', `${table} does not enable RLS`, 'Enable RLS on v378 runtime tables.');
    }
  }

  for (const fn of ['worker_import_cutover_source_table', 'worker_enqueue_import_cutover', 'worker_acquire_import_cutover_job', 'worker_run_import_cutover_batch']) {
    if (!new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}`, 'i').test(sql)) {
      add('critical', 'RPC', `Missing ${fn}`, 'Add the v378 worker RPC.');
    }
    if (!new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}[\\s\\S]+to\\s+service_role`, 'i').test(sql)) {
      add('critical', 'RPC security', `${fn} is not granted to service_role`, 'Grant execution to service_role only.');
    }
  }

  for (const token of [
    'worker_enqueue_job',
    'worker_acquire_job',
    'worker_heartbeat',
    'worker_complete_job',
    'worker_fail_job',
    'worker_record_artifact',
    'row_hash',
    'unique index',
    'checkpoint',
    'validation_summary',
    'duplicate_rows',
    'service_role',
  ]) {
    if (!sql.includes(token)) add('critical', 'runtime contract', `Missing token ${token}`, 'Preserve idempotent worker runtime behavior.');
  }

  if (/grant\s+execute\s+on\s+function\s+public\.worker_run_import_cutover_batch[\s\S]+to\s+authenticated/i.test(sql)) {
    add('critical', 'RPC security', 'Import cutover batch RPC is granted to authenticated users.', 'Keep worker execution service-role only.');
  }
}

const pkg = JSON.parse(read('package.json'));
if (!pkg.scripts?.['qa:v378']) add('critical', 'package.json', 'qa:v378 is missing.', 'Add qa:v378 script.');
if (!String(pkg.scripts?.['qa:all'] || '').includes('qa:v378')) add('critical', 'package.json', 'qa:v378 is not wired into qa:all.', 'Add qa:v378 to qa:all.');

findings.sort((a, b) => ({ critical: 3, warning: 2, info: 1 }[b.severity] - { critical: 3, warning: 2, info: 1 }[a.severity]) || a.area.localeCompare(b.area));
const report = [
  '# v378 Import Cutover Worker QA',
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
  findings.length ? '' : 'No v378 import cutover worker issues detected.',
].join('\n');

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs/V378_IMPORT_CUTOVER_WORKER_QA.md'), report);
console.log(report);
if (findings.some((f) => f.severity === 'critical')) process.exit(1);
