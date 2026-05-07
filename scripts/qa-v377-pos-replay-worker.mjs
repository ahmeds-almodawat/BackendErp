import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const findings = [];
const add = (severity, area, finding, action) => findings.push({ severity, area, finding, action });
const exists = (file) => fs.existsSync(path.join(root, file));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

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
  'docs/V377_POS_REPLAY_WORKER.md',
  'scripts/qa-v377-pos-replay-worker.mjs',
];
for (const file of requiredFiles) if (!exists(file)) add('critical', 'file inventory', `Missing ${file}`, 'Restore v377 patch file.');

const pkg = JSON.parse(read('package.json'));
if (!pkg.scripts?.['qa:v377']) add('critical', 'package scripts', 'qa:v377 missing', 'Add qa:v377 script.');
if (!String(pkg.scripts?.['qa:all'] || '').includes('qa:v377')) add('critical', 'package scripts', 'qa:v377 not wired into qa:all', 'Add qa:v377 to qa:all after qa:v376.');

const migrations = walk('supabase/migrations', (rel) => rel.endsWith('.sql'));
const migration = migrations.find((file) => /v377.*pos.*replay/i.test(file)) || migrations.find((file) => read(file).includes('v377 POS Replay Worker'));
if (!migration) add('critical', 'migration', 'v377 POS replay migration missing', 'Add v377 SQL migration.');

let body = '';
if (migration) body = read(migration);

const requiredTokens = [
  'pos_replay_runs',
  'pos_replay_applied_rows',
  'pos_replay_events',
  'worker_pos_replay_source_table',
  'worker_enqueue_pos_replay',
  'worker_acquire_pos_replay_job',
  'worker_run_pos_replay_batch',
  'worker_enqueue_job',
  'worker_jobs',
  'worker_job_runs',
  'worker_job_leases',
  'worker_job_checkpoints',
  'worker_job_artifacts',
  'worker_dead_letters',
  'service_role',
  'revoke all on function public.worker_enqueue_pos_replay',
  'grant execute on function public.worker_enqueue_pos_replay',
  'on conflict',
  'replay_hash',
  'checkpoint',
  'pos.replay',
];
for (const token of requiredTokens) {
  if (body && !body.includes(token)) add('critical', 'migration content', `Missing token: ${token}`, 'Restore v377 worker runtime SQL coverage.');
}

const sourceCandidates = ['pos_staging_rows', 'foodics_staging_rows', 'sales_pos_staging_rows', 'foodics_orders', 'pos_sales_rows', 'sales_pos_batches'];
for (const token of sourceCandidates) {
  if (body && !body.includes(token)) add('warning', 'source detection', `Source candidate ${token} not detected`, 'Keep broad POS/Foodics source-table detection.');
}

if (body && /grant execute on function public\.worker_.*pos.* to authenticated/i.test(body)) {
  add('critical', 'security', 'POS replay worker RPC is granted to authenticated users', 'Worker RPCs must be service_role only.');
}

if (body && !/alter table public\.pos_replay_runs enable row level security/i.test(body)) {
  add('critical', 'RLS', 'pos_replay_runs RLS not enabled', 'Enable RLS on v377 runtime evidence tables.');
}

const severityRank = { critical: 3, warning: 2, info: 1 };
findings.sort((a, b) => severityRank[b.severity] - severityRank[a.severity] || a.area.localeCompare(b.area));

const report = [
  '# v377 POS Replay Worker QA',
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
  findings.length ? '' : 'No v377 POS replay worker issues detected.',
].join('\n');

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs/V377_POS_REPLAY_WORKER_QA.md'), report);
console.log(report);

if (findings.some((f) => f.severity === 'critical')) process.exit(1);
