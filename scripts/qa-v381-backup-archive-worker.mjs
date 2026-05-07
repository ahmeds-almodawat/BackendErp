import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const findings = [];
const add = (severity, area, finding, action) => findings.push({ severity, area, finding, action });
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

const requiredFiles = [
  'src/engines/enterpriseV381PlatformBackupEngine.ts',
  'src/modules/EnterpriseV381BackupPage.tsx',
  'supabase/migrations/20260506238100_v381_backup_archive_worker.sql',
  'docs/V381_BACKUP_ARCHIVE_WORKER.md',
  'scripts/qa-v381-backup-archive-worker.mjs',
];

for (const file of requiredFiles) if (!exists(file)) add('critical', 'file inventory', `Missing ${file}`, 'Restore the v381 file.');

if (exists('package.json')) {
  const pkg = JSON.parse(read('package.json'));
  if (!pkg.scripts?.['qa:v381']) add('critical', 'package scripts', 'qa:v381 is missing', 'Wire qa:v381 in package.json.');
  if (!String(pkg.scripts?.['qa:all'] || '').includes('qa:v381')) add('critical', 'package scripts', 'qa:v381 is not included in qa:all', 'Add qa:v381 to qa:all.');
}

if (exists('src/app/AppShell.tsx')) {
  const app = read('src/app/AppShell.tsx');
  for (const token of ['EnterpriseV381BackupPage', "'backup'", 'Backup / Restore', 'Loading backup center']) {
    if (!app.includes(token)) add('critical', 'route wiring', `AppShell missing ${token}`, 'Wire the v381 route and navigation.');
  }
}

if (exists('src/engines/enterpriseV381PlatformBackupEngine.ts')) {
  const engine = read('src/engines/enterpriseV381PlatformBackupEngine.ts');
  for (const token of ['createV381PlatformBackupPackage', 'previewV381RestoreFile', 'manifest.json', 'erp-state.json', 'application/zip', 'crc32']) {
    if (!engine.includes(token)) add('critical', 'backup engine', `Backup engine missing ${token}`, 'Restore backup package create/parse behavior.');
  }
  if (engine.includes('import JSZip') || engine.includes('from \'jszip\'') || engine.includes('from "jszip"')) add('critical', 'backup engine', 'Backup engine depends on JSZip', 'Keep v381 dependency-free or add dependency intentionally with lock update.');
}

if (exists('src/modules/EnterpriseV381BackupPage.tsx')) {
  const page = read('src/modules/EnterpriseV381BackupPage.tsx');
  for (const token of ['Download one ZIP', 'Restore and replace current data', 'previewV381RestoreFile', 'createV381PlatformBackupPackage', 'confirmReplace']) {
    if (!page.includes(token)) add('critical', 'backup page', `Backup page missing ${token}`, 'Restore export/preview/confirm/restore UX.');
  }
}

if (exists('supabase/migrations/20260506238100_v381_backup_archive_worker.sql')) {
  const sql = read('supabase/migrations/20260506238100_v381_backup_archive_worker.sql');
  for (const token of [
    'backup_archive_runs',
    'backup_archive_artifacts',
    'backup_restore_runs',
    'backup_archive_events',
    'worker_enqueue_backup_archive',
    'worker_acquire_backup_archive_job',
    'worker_run_backup_archive_batch',
    'worker_record_restore_evidence',
    'grant execute on function public.worker_run_backup_archive_batch',
    'to service_role',
  ]) if (!sql.includes(token)) add('critical', 'migration', `v381 migration missing ${token}`, 'Restore v381 backup/archive schema and RPCs.');

  for (const bad of ['create policy if not exists', '\\i ']) if (sql.toLowerCase().includes(bad.toLowerCase())) add('critical', 'migration syntax', `v381 migration contains unsupported ${bad}`, 'Use cleaned PostgreSQL-compatible migration syntax.');
  if (/grant\s+execute\s+on\s+function[^;]+to\s+authenticated/i.test(sql)) add('critical', 'migration security', 'v381 worker RPC grants to authenticated', 'Worker RPCs must be service_role only.');
}

findings.sort((a, b) => ({ critical: 3, warning: 2, info: 1 }[b.severity] - { critical: 3, warning: 2, info: 1 }[a.severity]) || a.area.localeCompare(b.area));
const report = [
  '# v381 Backup / Archive Worker QA',
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
  findings.length ? '' : 'No v381 backup/archive worker issues detected.',
].join('\n');
fs.writeFileSync(path.join(root, 'docs/V381_BACKUP_ARCHIVE_WORKER_QA.md'), report);
console.log(report);
if (findings.some((f) => f.severity === 'critical')) process.exit(1);
