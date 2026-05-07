import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const findings = [];
const add = (severity, area, finding, action) => findings.push({ severity, area, finding, action });
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

function walk(dir, predicate = () => true) {
  const out = [];
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return out;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const p = path.join(full, entry.name);
    const rel = path.relative(root, p).replaceAll(path.sep, '/');
    if (entry.isDirectory()) out.push(...walk(rel, predicate));
    else if (predicate(rel)) out.push(rel);
  }
  return out;
}

const requiredFiles = [
  'supabase/migrations/20260506237600_v376_inventory_rebuild_worker.sql',
  'scripts/qa-v376-inventory-rebuild-worker.mjs',
  'docs/V376_INVENTORY_REBUILD_WORKER.md',
];

for (const file of requiredFiles) {
  if (!exists(file)) add('critical', 'file inventory', `Missing ${file}`, 'Restore the v376 patch file.');
}

const pkg = JSON.parse(read('package.json'));
if (!pkg.scripts?.['qa:v376']) add('critical', 'package scripts', 'qa:v376 is missing', 'Add qa:v376 to package.json.');
if (!String(pkg.scripts?.['qa:all'] || '').includes('qa:v376')) add('critical', 'package scripts', 'qa:v376 is not wired into qa:all', 'Include qa:v376 in qa:all after qa:v375.');

const migrationPath = 'supabase/migrations/20260506237600_v376_inventory_rebuild_worker.sql';
const migration = exists(migrationPath) ? read(migrationPath) : '';

const mustContain = [
  'inventory_rebuild_runs',
  'inventory_rebuild_balances',
  'inventory_rebuild_events',
  'worker_enqueue_inventory_rebuild',
  'worker_acquire_inventory_rebuild_job',
  'worker_run_inventory_rebuild_batch',
  'worker_inventory_rebuild_source_table',
  'inventory_stock_movements',
  'stock_movements',
  'inventory_movements',
  'local_inventory_movements',
  'worker_enqueue_job',
  'worker_runtime_audit',
  'worker_job_checkpoints',
  'worker_job_artifacts',
  'worker_dead_letters',
  'for update skip locked',
  'idempotency_key',
  'dead_lettered',
  'grant execute on function public.worker_run_inventory_rebuild_batch',
  'to service_role',
];

for (const token of mustContain) {
  if (!migration.toLowerCase().includes(token.toLowerCase())) {
    add('critical', 'v376 migration', `Missing required token: ${token}`, 'Restore inventory rebuild worker SQL coverage.');
  }
}

if (/grant\s+execute\s+on\s+function\s+public\.worker_run_inventory_rebuild_batch[^;]+to\s+authenticated/i.test(migration)) {
  add('critical', 'security', 'worker_run_inventory_rebuild_batch is granted to authenticated', 'Worker runtime RPCs must be service_role only.');
}

if (!/revoke\s+all\s+on\s+function\s+public\.worker_run_inventory_rebuild_batch/i.test(migration)) {
  add('warning', 'security', 'No explicit revoke for worker_run_inventory_rebuild_batch detected', 'Keep explicit revokes before service_role grant.');
}

if (!/status\s*=\s*case\s+when\s+attempt_count\s*>=\s*max_attempts\s+then\s+'dead_lettered'/i.test(migration)) {
  add('warning', 'retry/dead-letter', 'Dead-letter transition pattern not detected', 'Confirm failed rebuild jobs transition to retry/dead_lettered.');
}

if (!/checkpoint\s*=\s*jsonb_build_object\('phase',\s*'completed'/i.test(migration)) {
  add('warning', 'checkpoint', 'Completed checkpoint pattern not detected', 'Confirm rebuild worker writes a completion checkpoint.');
}

const v375Migrations = walk('supabase/migrations', (rel) => rel.includes('v375') && rel.endsWith('.sql'));
if (!v375Migrations.length) {
  add('critical', 'dependency', 'No v375 worker lease runtime migration detected', 'Apply v375 before v376.');
} else {
  const v375 = v375Migrations.map(read).join('\n');
  for (const token of ['worker_jobs', 'worker_job_runs', 'worker_job_leases', 'worker_enqueue_job', 'worker_runtime_audit']) {
    if (!v375.includes(token)) add('critical', 'dependency', `v375 dependency missing ${token}`, 'Repair v375 before v376.');
  }
}

const doc = exists('docs/V376_INVENTORY_REBUILD_WORKER.md') ? read('docs/V376_INVENTORY_REBUILD_WORKER.md') : '';
for (const token of ['Inventory Rebuild Worker', 'worker_enqueue_inventory_rebuild', 'Source Table Compatibility', 'service_role', 'v377']) {
  if (!doc.includes(token)) add('warning', 'documentation', `Docs missing ${token}`, 'Refresh V376 documentation.');
}

const report = [
  '# v376 Inventory Rebuild Worker QA',
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
  findings.length ? '' : 'No v376 inventory rebuild worker issues detected.',
].join('\n');

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs/V376_INVENTORY_REBUILD_WORKER_REPORT.md'), report);
console.log(report);

if (findings.some((f) => f.severity === 'critical')) process.exit(1);
