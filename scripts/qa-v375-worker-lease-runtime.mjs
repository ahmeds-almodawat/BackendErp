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
    const rel = path.relative(root, path.join(full, entry.name)).replaceAll(path.sep, '/');
    if (entry.isDirectory()) out.push(...walk(rel, predicate));
    else if (predicate(rel)) out.push(rel);
  }
  return out;
}

const pkg = JSON.parse(read('package.json'));
if (!pkg.scripts?.['qa:v375']) add('critical', 'package scripts', 'qa:v375 is missing.', 'Add qa:v375 script.');
if (!String(pkg.scripts?.['qa:all'] || '').includes('qa:v375')) add('critical', 'package scripts', 'qa:v375 is not wired into qa:all.', 'Add qa:v375 to qa:all.');

const migrationFiles = walk('supabase/migrations', (rel) => rel.endsWith('.sql'));
const v375File = migrationFiles.find((file) => /v375|worker_lease_runtime/i.test(file));
if (!v375File) add('critical', 'migration', 'v375 worker lease runtime migration not found.', 'Add a v375 SQL migration.');

const sql = v375File ? read(v375File) : '';
const requiredTables = [
  'worker_jobs',
  'worker_job_runs',
  'worker_job_leases',
  'worker_job_checkpoints',
  'worker_job_artifacts',
  'worker_dead_letters',
  'worker_audit_events',
];
for (const table of requiredTables) {
  if (!new RegExp(`public\\.${table}|${table}`, 'i').test(sql)) add('critical', 'runtime tables', `${table} is not referenced in v375 migration.`, 'Ensure v375 builds on all v374 runtime tables.');
}

const requiredFunctions = [
  'worker_enqueue_job',
  'worker_acquire_job',
  'worker_heartbeat',
  'worker_complete_job',
  'worker_fail_job',
  'worker_expire_stale_leases',
  'worker_record_artifact',
];
for (const fn of requiredFunctions) {
  if (!new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}`, 'i').test(sql)) add('critical', 'runtime RPCs', `${fn} is missing.`, 'Add the required worker runtime RPC.');
}

for (const token of ['for update skip locked', 'lease_token', 'expires_at', 'heartbeat_at', 'checkpoint', 'idempotency_key', 'dead_letter', 'worker_job_artifacts']) {
  if (!sql.toLowerCase().includes(token)) add('critical', 'runtime semantics', `Missing ${token}.`, 'Preserve lease/idempotency/checkpoint/dead-letter semantics.');
}

for (const fn of requiredFunctions) {
  const grantService = new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}[\\s\\S]*?to\\s+service_role`, 'i').test(sql);
  if (!grantService) add('critical', 'security grants', `${fn} is not granted to service_role.`, 'Grant execution to service_role only.');
  const grantAuthenticated = new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${fn}[\\s\\S]*?to\\s+authenticated`, 'i').test(sql);
  if (grantAuthenticated) add('critical', 'security grants', `${fn} is granted to authenticated.`, 'Worker runtime RPCs must not be browser-callable.');
}

if (!exists('docs/V375_WORKER_LEASE_RUNTIME.md')) add('warning', 'documentation', 'v375 documentation missing.', 'Add docs/V375_WORKER_LEASE_RUNTIME.md.');

findings.sort((a, b) => ({ critical: 3, warning: 2, info: 1 }[b.severity] - { critical: 3, warning: 2, info: 1 }[a.severity]) || a.area.localeCompare(b.area));
const report = [
  '# v375 Worker Lease Runtime QA',
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
  findings.length ? '' : 'No v375 worker lease runtime issues detected.',
].join('\n');

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs/V375_WORKER_LEASE_RUNTIME_QA.md'), report);
console.log(report);
if (findings.some((f) => f.severity === 'critical')) process.exit(1);
