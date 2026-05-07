import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const requiredFiles = [
  'src/engines/enterpriseV391V394OperationalConfidenceEngine.ts',
  'src/modules/EnterpriseV391V394OperationalConfidencePage.tsx',
  'supabase/migrations/20260506239100_v391_v394_operational_confidence_gates.sql',
  'docs/V391_V394_OPERATIONAL_CONFIDENCE_GATES.md',
];

const requiredRoutes = ['reportPackGate', 'alertsGate', 'supportGate', 'performanceGate'];
const requiredTables = [
  'operational_confidence_snapshots',
  'operational_alert_rules',
  'operational_alert_events',
  'support_diagnostics_runs',
  'performance_budget_snapshots',
];

const findings = [];
function add(severity, area, finding, action) { findings.push({ severity, area, finding, action }); }

for (const file of requiredFiles) {
  if (!existsSync(file)) add('critical', 'Files', `Missing ${file}`, 'Restore the v391-v394 patch file.');
}

const appShell = existsSync('src/app/AppShell.tsx') ? readFileSync('src/app/AppShell.tsx', 'utf8') : '';
for (const route of requiredRoutes) {
  if (!appShell.includes(route)) add('critical', 'Routing', `Missing route ${route} in AppShell.`, 'Wire the operational confidence page route.');
}

const pkg = existsSync('package.json') ? readFileSync('package.json', 'utf8') : '';
if (!pkg.includes('qa:v391-v394')) add('critical', 'Package scripts', 'Missing qa:v391-v394 script.', 'Add qa:v391-v394 to package.json.');
if (!pkg.includes('npm run qa:v391-v394')) add('critical', 'Package scripts', 'qa:all does not run qa:v391-v394.', 'Wire qa:v391-v394 into qa:all.');

const migration = existsSync('supabase/migrations/20260506239100_v391_v394_operational_confidence_gates.sql') ? readFileSync('supabase/migrations/20260506239100_v391_v394_operational_confidence_gates.sql', 'utf8') : '';
for (const table of requiredTables) {
  if (!migration.includes(table)) add('critical', 'Migration', `Missing table ${table}.`, 'Restore v391-v394 migration table.');
}
if (/create\s+policy\s+if\s+not\s+exists/i.test(migration)) add('critical', 'Migration', 'Migration uses unsupported CREATE POLICY IF NOT EXISTS syntax.', 'Use drop policy if exists + create policy.');
if (/^\s*\\i\s+/m.test(migration)) add('critical', 'Migration', 'Migration contains psql include command.', 'Inline included SQL.');

if (!findings.length) add('good', 'v391-v394', 'No v391-v394 operational confidence issues detected.', 'Proceed to qa:all and local build.');

const critical = findings.filter((item) => item.severity === 'critical').length;
const warnings = findings.filter((item) => item.severity === 'warning').length;
const report = [
  '# v391-v394 Operational Confidence Gates QA',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  `Critical: ${critical}`,
  `Warnings: ${warnings}`,
  '',
  '| Severity | Area | Finding | Action |',
  '|---|---|---|---|',
  ...findings.map((item) => `| ${item.severity} | ${item.area} | ${String(item.finding).replace(/\|/g, '\\|')} | ${String(item.action).replace(/\|/g, '\\|')} |`),
].join('\n');

mkdirSync(dirname('docs/V391_V394_OPERATIONAL_CONFIDENCE_QA.md'), { recursive: true });
writeFileSync('docs/V391_V394_OPERATIONAL_CONFIDENCE_QA.md', report, 'utf8');
console.log(report);
if (critical) process.exit(1);
