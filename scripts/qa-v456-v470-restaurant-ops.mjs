import fs from 'node:fs';

const checks = [];
const warn = [];
function exists(path) { return fs.existsSync(path); }
function read(path) { return fs.readFileSync(path, 'utf8'); }
function critical(area, finding, action) { checks.push({ severity: 'critical', area, finding, action }); }
function warning(area, finding, action) { warn.push({ severity: 'warning', area, finding, action }); }
function requireFile(path, area) { if (!exists(path)) critical(area, `${path} is missing`, 'Re-apply v456-v470 patch.'); }

const files = [
  ['src/engines/enterpriseV456V470RestaurantOpsEngine.ts', 'engine'],
  ['src/modules/EnterpriseV456V470RestaurantOpsPage.tsx', 'module'],
  ['supabase/migrations/20260506245600_v456_v470_restaurant_ops_workflow.sql', 'migration'],
  ['docs/V456_V470_RESTAURANT_OPS_WORKFLOW.md', 'docs'],
  ['scripts/apply-v456-v470-wiring.mjs', 'wiring'],
];
files.forEach(([file, area]) => requireFile(file, area));

if (exists('package.json')) {
  const pkg = JSON.parse(read('package.json'));
  if (!pkg.scripts?.['qa:v456-v470']) warning('package', 'qa:v456-v470 is not wired yet.', 'Run node scripts/apply-v456-v470-wiring.mjs.');
  if (pkg.scripts?.['qa:all'] && !pkg.scripts['qa:all'].includes('qa:v456-v470')) warning('package', 'qa:all does not include qa:v456-v470 yet.', 'Run node scripts/apply-v456-v470-wiring.mjs.');
}

if (exists('src/app/AppShell.tsx')) {
  const app = read('src/app/AppShell.tsx');
  if (!app.includes('EnterpriseV456V470RestaurantOpsPage')) warning('AppShell', 'Restaurant Flow page is not wired in AppShell.', 'Run node scripts/apply-v456-v470-wiring.mjs.');
  if (!app.includes('restaurantOps')) warning('AppShell', 'restaurantOps route is not present.', 'Run node scripts/apply-v456-v470-wiring.mjs.');
}

if (exists('supabase/migrations/20260506245600_v456_v470_restaurant_ops_workflow.sql')) {
  const sql = read('supabase/migrations/20260506245600_v456_v470_restaurant_ops_workflow.sql');
  const badPatterns = [/create\s+policy\s+if\s+not\s+exists/i, /^\uFEFF/, /^\s*\\i\s+/m, /unique\s*\([^)]*coalesce\s*\(/i];
  for (const pattern of badPatterns) {
    if (pattern.test(sql)) critical('migration', `Bad SQL pattern detected: ${pattern}`, 'Repair migration syntax before db reset.');
  }
  ['restaurant_ops_workflow_snapshots', 'restaurant_ops_material_request_decisions', 'restaurant_ops_fulfillment_documents', 'restaurant_ops_supplier_split_plan', 'restaurant_ops_events', 'restaurant_ops_workflow_snapshot_v456'].forEach((token) => {
    if (!sql.includes(token)) critical('migration', `${token} missing from v456-v470 migration`, 'Re-apply migration file.');
  });
}

const report = `# v456-v470 Restaurant Operations Workflow QA\n\nGenerated: ${new Date().toISOString()}\n\nCritical: ${checks.length}\nWarnings: ${warn.length}\n\n| Severity | Area | Finding | Action |\n|---|---|---|---|\n${[...checks, ...warn].map((x) => `| ${x.severity} | ${x.area} | ${x.finding.replaceAll('|','/')} | ${x.action.replaceAll('|','/')} |`).join('\n')}\n${checks.length || warn.length ? '' : '\nNo v456-v470 restaurant operations workflow issues detected.'}\n`;
fs.writeFileSync('docs/V456_V470_RESTAURANT_OPS_WORKFLOW_QA.md', report);
console.log(report);
if (checks.length) process.exit(1);
