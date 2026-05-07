import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'src/engines/enterpriseV421V450CommandSuiteEngine.ts',
  'src/modules/EnterpriseV421V450CommandSuitePage.tsx',
  'supabase/migrations/20260506242100_v421_v450_enterprise_command_suite.sql',
  'docs/V421_V450_ENTERPRISE_COMMAND_SUITE.md',
];

const findings = [];
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    findings.push({ severity: 'critical', area: 'file', finding: `Missing ${file}`, action: 'Restore the v421-v450 patch file.' });
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!pkg.scripts?.['qa:v421-v450']) findings.push({ severity: 'critical', area: 'package', finding: 'qa:v421-v450 is not registered.', action: 'Wire package.json script.' });
if (!String(pkg.scripts?.['qa:all'] || '').includes('qa:v421-v450')) findings.push({ severity: 'critical', area: 'package', finding: 'qa:all does not include qa:v421-v450.', action: 'Add qa:v421-v450 to qa:all.' });

const app = fs.readFileSync(path.join(root, 'src/app/AppShell.tsx'), 'utf8');
for (const token of ['EnterpriseV421V450CommandSuitePage', 'commandSuite', 'Command Suite']) {
  if (!app.includes(token)) findings.push({ severity: 'critical', area: 'app-shell', finding: `AppShell missing ${token}.`, action: 'Reapply AppShell route wiring.' });
}

const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260506242100_v421_v450_enterprise_command_suite.sql'), 'utf8');
for (const token of ['enterprise_command_snapshots', 'enterprise_operator_sops', 'enterprise_training_sessions', 'enterprise_support_cases', 'enterprise_data_quality_checks', 'enterprise_command_record_snapshot']) {
  if (!migration.includes(token)) findings.push({ severity: 'critical', area: 'migration', finding: `Migration missing ${token}.`, action: 'Repair v421-v450 migration.' });
}
if (/create\s+policy\s+if\s+not\s+exists/i.test(migration)) findings.push({ severity: 'critical', area: 'migration', finding: 'Migration uses unsupported CREATE POLICY IF NOT EXISTS.', action: 'Use drop/create policy syntax.' });

const lines = [
  '# v421-v450 Enterprise Command Suite QA',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  `Critical: ${findings.filter((f) => f.severity === 'critical').length}`,
  `Warnings: ${findings.filter((f) => f.severity === 'warning').length}`,
  '',
  '| Severity | Area | Finding | Action |',
  '|---|---|---|---|',
  ...findings.map((f) => `| ${f.severity} | ${f.area} | ${f.finding} | ${f.action} |`),
];
if (!findings.length) lines.push('', 'No v421-v450 enterprise command suite issues detected.');
fs.writeFileSync(path.join(root, 'docs/V421_V450_ENTERPRISE_COMMAND_SUITE_QA.md'), lines.join('\n'));
console.log(lines.join('\n'));
if (findings.some((f) => f.severity === 'critical')) process.exit(1);
