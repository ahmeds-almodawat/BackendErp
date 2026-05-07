import fs from 'node:fs';
import path from 'node:path';
import { buildV374RuntimeSchemaSnapshot, v374SnapshotToMarkdown } from '../src/engines/enterpriseV374JobRuntimeSchemaEngine.ts';

const root = process.cwd();
const migrationDir = path.join(root, 'supabase', 'migrations');
const docsDir = path.join(root, 'docs');
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

const requiredFiles = [
  'src/engines/enterpriseV374JobRuntimeSchemaEngine.ts',
  'scripts/qa-v374-job-runtime-schema.mjs',
  'docs/V374_JOB_RUNTIME_SCHEMA.md',
];

for (const file of requiredFiles) {
  if (!exists(file)) add('critical', 'file inventory', `Missing ${file}`, 'Restore the v374 patch file.');
}

const pkg = JSON.parse(read('package.json'));
if (!pkg.scripts?.['qa:v374']) add('critical', 'package scripts', 'qa:v374 is missing', 'Add qa:v374 script.');
if (!String(pkg.scripts?.['qa:all'] || '').includes('qa:v374')) add('critical', 'package scripts', 'qa:v374 is not wired into qa:all', 'Add qa:v374 to qa:all after qa:v373 and before later gates.');

const migrationFiles = fs.existsSync(migrationDir)
  ? fs.readdirSync(migrationDir).filter((file) => file.endsWith('.sql')).sort()
  : [];

const v374Migration = migrationFiles.find((file) => /v374.*job.*runtime|374/i.test(file));
if (!v374Migration) {
  add('critical', 'Supabase migrations', 'No v374 job runtime migration found', 'Add the v374 migration under supabase/migrations.');
}

let snapshot;
if (v374Migration) {
  const migrationPath = path.join('supabase', 'migrations', v374Migration);
  const sql = read(migrationPath);
  snapshot = buildV374RuntimeSchemaSnapshot(sql, migrationPath);

  for (const finding of snapshot.findings) {
    if (finding.status !== 'ready') {
      add('critical', 'job runtime schema', `${finding.table} is ${finding.status}`, finding.action);
    }
  }

  if (!/for\s+select\s+to\s+authenticated/i.test(sql)) {
    add('warning', 'RLS posture', 'v374 migration has no authenticated read policies', 'Runtime tables should be observable to authenticated admin/reporting users, while writes remain service/RPC controlled.');
  }

  if (/for\s+(insert|update|delete)\s+to\s+authenticated/i.test(sql)) {
    add('warning', 'RLS posture', 'v374 migration grants direct authenticated writes', 'Prefer service-role/RPC-only writes for worker runtime tables until v383 RBAC.');
  }

  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(path.join(docsDir, 'V374_JOB_RUNTIME_SCHEMA_REPORT.md'), v374SnapshotToMarkdown(snapshot));
  fs.writeFileSync(path.join(docsDir, 'V374_JOB_RUNTIME_SCHEMA_REGISTRY.json'), JSON.stringify(snapshot, null, 2) + '\n');
}

const severityRank = { critical: 3, warning: 2, info: 1 };
findings.sort((a, b) => severityRank[b.severity] - severityRank[a.severity] || a.area.localeCompare(b.area));

const report = [
  '# v374 Job Runtime Schema QA',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  `Critical: ${findings.filter((finding) => finding.severity === 'critical').length}`,
  `Warnings: ${findings.filter((finding) => finding.severity === 'warning').length}`,
  '',
  '| Severity | Area | Finding | Action |',
  '|---|---|---|---|',
  ...findings.map((finding) => `| ${finding.severity} | ${finding.area} | ${finding.finding.replaceAll('|', '\\|')} | ${finding.action.replaceAll('|', '\\|')} |`),
  '',
  findings.length ? '' : 'No v374 job runtime schema issues detected.',
].join('\n');

fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(path.join(docsDir, 'V374_JOB_RUNTIME_SCHEMA_QA.md'), report);
console.log(report);

if (findings.some((finding) => finding.severity === 'critical')) {
  process.exit(1);
}
