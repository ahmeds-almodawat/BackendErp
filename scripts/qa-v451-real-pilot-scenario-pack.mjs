import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [];

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function check(condition, area, finding, action, severity = 'critical') {
  if (!condition) checks.push({ severity, area, finding, action });
}

const requiredFiles = [
  'src/engines/enterpriseV451PilotScenarioEngine.ts',
  'src/modules/EnterpriseV451PilotScenarioPage.tsx',
  'supabase/migrations/20260506245100_v451_real_pilot_scenario_pack.sql',
  'docs/V451_REAL_PILOT_SCENARIO_PACK.md',
];

for (const file of requiredFiles) {
  check(exists(file), 'files', `Missing ${file}`, 'Re-apply the v451 patch.');
}

if (exists('src/engines/enterpriseV451PilotScenarioEngine.ts')) {
  const engine = read('src/engines/enterpriseV451PilotScenarioEngine.ts');
  for (const marker of [
    'buildV451PilotScenarioPack',
    'exportV451ScenarioCsv',
    'exportV451ReconciliationCsv',
    'opening-balances',
    'purchase-invoice',
    'supplier-payment',
    'pos-day',
    'production-batch',
    'stock-count',
    'vat-close',
    'backup-restore',
  ]) {
    check(engine.includes(marker), 'engine', `Engine missing marker ${marker}`, 'Restore v451 pilot scenario engine.');
  }
}

if (exists('src/modules/EnterpriseV451PilotScenarioPage.tsx')) {
  const page = read('src/modules/EnterpriseV451PilotScenarioPage.tsx');
  for (const marker of ['EnterpriseV451PilotScenarioPage', 'Export steps CSV', 'Report truth checks', 'Go / No-Go']) {
    check(page.includes(marker), 'page', `Page missing marker ${marker}`, 'Restore v451 page component.');
  }
}

if (exists('supabase/migrations/20260506245100_v451_real_pilot_scenario_pack.sql')) {
  const sql = read('supabase/migrations/20260506245100_v451_real_pilot_scenario_pack.sql');
  for (const marker of [
    'pilot_scenario_seed_sets',
    'pilot_scenario_steps',
    'pilot_scenario_runs',
    'pilot_scenario_results',
    'pilot_scenario_reconciliation_checks',
    'pilot_scenario_catalog',
    'pilot_record_scenario_result',
  ]) {
    check(sql.includes(marker), 'migration', `Migration missing ${marker}`, 'Restore v451 migration.');
  }
  check(!/create\s+policy\s+if\s+not\s+exists/i.test(sql), 'migration', 'Migration uses CREATE POLICY IF NOT EXISTS', 'Use drop policy if exists + create policy.');
  check(!/^\\i\s+/m.test(sql), 'migration', 'Migration contains psql include command', 'Inline SQL content.');
}

if (exists('package.json')) {
  const pkg = JSON.parse(read('package.json'));
  check(Boolean(pkg.scripts?.['qa:v451']), 'package', 'package.json missing qa:v451', 'Run node scripts/apply-v451-wiring.mjs.');
  check(String(pkg.scripts?.['qa:all'] ?? '').includes('qa:v451'), 'package', 'qa:all does not include qa:v451', 'Run node scripts/apply-v451-wiring.mjs.');
}

if (exists('src/app/AppShell.tsx')) {
  const app = read('src/app/AppShell.tsx');
  check(app.includes('EnterpriseV451PilotScenarioPage'), 'routing', 'AppShell missing V451 page import/use', 'Run node scripts/apply-v451-wiring.mjs.');
  check(app.includes('pilotScenario'), 'routing', 'AppShell missing pilotScenario route key', 'Run node scripts/apply-v451-wiring.mjs.');
  check(app.includes('Pilot Scenario'), 'navigation', 'Navigation missing Pilot Scenario label', 'Run node scripts/apply-v451-wiring.mjs.');
}

const report = [
  '# v451 Real Pilot Scenario Pack QA',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  `Critical: ${checks.filter((item) => item.severity === 'critical').length}`,
  `Warnings: ${checks.filter((item) => item.severity === 'warning').length}`,
  '',
  '| Severity | Area | Finding | Action |',
  '|---|---|---|---|',
  ...checks.map((item) => `| ${item.severity} | ${item.area} | ${item.finding} | ${item.action} |`),
  '',
  checks.length ? '' : 'No v451 pilot scenario pack issues detected.',
].join('\n');

fs.writeFileSync(path.join(root, 'docs/V451_REAL_PILOT_SCENARIO_PACK_QA.md'), report, 'utf8');
console.log(report);

if (checks.some((item) => item.severity === 'critical')) {
  process.exit(1);
}
