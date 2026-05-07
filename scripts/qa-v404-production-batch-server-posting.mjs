import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationPath = path.join(root, 'supabase', 'migrations', '20260506240400_v404_production_batch_server_posting.sql');
const packagePath = path.join(root, 'package.json');
const docPath = path.join(root, 'docs', 'V404_PRODUCTION_BATCH_SERVER_POSTING.md');
const reportPath = path.join(root, 'docs', 'V404_PRODUCTION_BATCH_SERVER_POSTING_QA.md');

const findings = [];
function check(condition, area, finding, action, severity = 'critical') {
  if (!condition) findings.push({ severity, area, finding, action });
}
function read(file) { return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''; }

const migration = read(migrationPath);
const pkg = JSON.parse(read(packagePath) || '{}');
const scripts = pkg.scripts || {};

check(Boolean(migration), 'migration', 'v404 migration file is missing.', 'Restore supabase/migrations/20260506240400_v404_production_batch_server_posting.sql.');
check(migration.includes('production_post_batch_server'), 'rpc', 'Main production posting RPC is missing.', 'Add public.production_post_batch_server.');
check(migration.includes('FOR UPDATE') || migration.includes('for update'), 'locking', 'Production batch is not locked during posting.', 'Lock production batch source row before posting.');
check(migration.includes('app_current_user_has_permission'), 'permission', 'Permission guard is missing.', 'Require finance.post, inventory.adjust, or production.post.');
check(migration.includes('production_batch_inputs'), 'inputs', 'Production input lines are not used.', 'Use raw material input lines for consumption posting.');
check(migration.includes('production_batch_outputs'), 'outputs', 'Production output lines are not used.', 'Use output lines for finished/semi-finished stock posting.');
check(migration.includes('inventory_stock_movements'), 'inventory', 'Inventory movements are missing.', 'Create input consumption and output receipt movements.');
check(migration.includes('inventory_stock_balances'), 'inventory', 'Inventory balance updates are missing.', 'Update stock balances for consumed/output items.');
check(migration.includes('posting_batches'), 'posting', 'Posting batch integration is missing.', 'Create official posting batch.');
check(migration.includes('posting_batch_lines'), 'posting', 'Posting batch lines are missing.', 'Create balanced GL lines.');
check(migration.includes('finance_journal_entries_backend'), 'finance', 'Finance journal header is missing.', 'Create finance journal header.');
check(migration.includes('finance_journal_lines_backend'), 'finance', 'Finance journal lines are missing.', 'Create finance journal lines.');
check(migration.includes('production_batch_server_posting_events'), 'audit', 'Production posting evidence table is missing.', 'Create audit/evidence events.');
check(migration.includes('production_post_batch(batch_id uuid)'), 'wrapper', 'Compatibility wrapper production_post_batch is missing.', 'Route existing callers to server posting.');
check(migration.includes('live_production_post_batch'), 'wrapper', 'Live production wrapper is missing.', 'Route live production caller to server posting.');
check(!/create\s+policy\s+if\s+not\s+exists/i.test(migration), 'sql', 'Unsupported CREATE POLICY IF NOT EXISTS found.', 'Use guarded DO block.');
check(!/^\s*\\i\s+/m.test(migration), 'sql', 'psql include command found.', 'Inline SQL in Supabase migration.');
check(scripts['qa:v404'] === 'node scripts/qa-v404-production-batch-server-posting.mjs', 'package', 'qa:v404 script is missing or incorrect.', 'Wire qa:v404 in package.json.');
check((scripts['qa:all'] || '').includes('npm run qa:v404'), 'package', 'qa:all does not include qa:v404.', 'Add qa:v404 to qa:all.');
check(fs.existsSync(docPath), 'docs', 'v404 documentation is missing.', 'Restore docs/V404_PRODUCTION_BATCH_SERVER_POSTING.md.');

const critical = findings.filter(f => f.severity === 'critical').length;
const warnings = findings.filter(f => f.severity !== 'critical').length;
const lines = [
  '# v404 Production Batch Server Posting QA',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  `Critical: ${critical}`,
  `Warnings: ${warnings}`,
  '',
  '| Severity | Area | Finding | Action |',
  '|---|---|---|---|',
  ...findings.map(f => `| ${f.severity} | ${f.area} | ${f.finding.replace(/\|/g, '\\|')} | ${f.action.replace(/\|/g, '\\|')} |`),
  '',
  findings.length ? '' : 'No v404 production batch server posting issues detected.',
];
fs.writeFileSync(reportPath, lines.join('\n'));

console.log(lines.join('\n'));
if (critical) process.exit(1);
