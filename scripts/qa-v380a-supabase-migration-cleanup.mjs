import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const findings = [];
const add = (severity, area, finding, action) => findings.push({ severity, area, finding, action });

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function walk(dir) {
  const out = [];
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return out;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const p = path.join(full, entry.name);
    const rel = path.relative(root, p).replaceAll(path.sep, '/');
    if (entry.isDirectory()) out.push(...walk(rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

if (!exists('supabase/migrations')) {
  add('critical', 'Supabase migrations', 'Missing supabase/migrations directory.', 'Restore migrations before creating the first Supabase project.');
}

const migrationFiles = walk('supabase/migrations').filter((file) => file.endsWith('.sql'));
if (migrationFiles.length === 0) {
  add('critical', 'Supabase migrations', 'No SQL migration files found.', 'Add or restore SQL migrations before db reset.');
}

const forbiddenPolicyFiles = [];
for (const file of migrationFiles) {
  const body = read(file);
  if (/create\s+policy\s+if\s+not\s+exists/i.test(body)) forbiddenPolicyFiles.push(file);
}

if (forbiddenPolicyFiles.length > 0) {
  add(
    'critical',
    'PostgreSQL policy syntax',
    `${forbiddenPolicyFiles.length} migration(s) still contain unsupported CREATE POLICY IF NOT EXISTS syntax: ${forbiddenPolicyFiles.slice(0, 12).join(', ')}${forbiddenPolicyFiles.length > 12 ? '...' : ''}`,
    'Run npm run repair:migrations:policy-syntax, then rerun qa:v380a.'
  );
}

const pkg = exists('package.json') ? JSON.parse(read('package.json')) : {};
if (!pkg.scripts?.['repair:migrations:policy-syntax']) {
  add('critical', 'package scripts', 'Missing repair:migrations:policy-syntax script.', 'Wire the v380a repair script in package.json.');
}
if (!pkg.scripts?.['qa:v380a']) {
  add('critical', 'package scripts', 'Missing qa:v380a script.', 'Wire qa:v380a in package.json.');
}
if (!String(pkg.scripts?.['qa:all'] || '').includes('qa:v380a')) {
  add('warning', 'package scripts', 'qa:all does not include qa:v380a.', 'Include qa:v380a in the full quality gate before typecheck/build.');
}

const createPolicyCount = migrationFiles.reduce((sum, file) => sum + (read(file).match(/create\s+policy\s+/gi)?.length ?? 0), 0);
const dropPolicyCount = migrationFiles.reduce((sum, file) => sum + (read(file).match(/drop\s+policy\s+if\s+exists/gi)?.length ?? 0), 0);

if (!exists('docs/V380A_SUPABASE_MIGRATION_CLEANUP.md')) {
  add('warning', 'documentation', 'Missing docs/V380A_SUPABASE_MIGRATION_CLEANUP.md.', 'Add the v380a migration cleanup runbook.');
}

const severityRank = { critical: 3, warning: 2, info: 1 };
findings.sort((a, b) => severityRank[b.severity] - severityRank[a.severity] || a.area.localeCompare(b.area));

const report = [
  '# v380a Supabase Migration Cleanup QA',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  `Critical: ${findings.filter((f) => f.severity === 'critical').length}`,
  `Warnings: ${findings.filter((f) => f.severity === 'warning').length}`,
  `Migration files scanned: ${migrationFiles.length}`,
  `CREATE POLICY statements detected: ${createPolicyCount}`,
  `DROP POLICY IF EXISTS statements detected: ${dropPolicyCount}`,
  '',
  '| Severity | Area | Finding | Action |',
  '|---|---|---|---|',
  ...findings.map((f) => `| ${f.severity} | ${f.area} | ${f.finding.replaceAll('|', '\\|')} | ${f.action.replaceAll('|', '\\|')} |`),
  '',
  findings.length ? '' : 'No v380a Supabase migration cleanup issues detected.',
].join('\n');

fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs', 'V380A_SUPABASE_MIGRATION_CLEANUP_QA.md'), report);
console.log(report);

if (findings.some((f) => f.severity === 'critical')) process.exit(1);
