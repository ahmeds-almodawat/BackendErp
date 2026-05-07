import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const findings = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function finding(severity, area, message, action) {
  findings.push({ severity, area, message, action });
}

const requiredFiles = [
  'src/engines/enterpriseV385PurchasingWorkflowEngine.ts',
  'src/modules/EnterpriseV385PurchasingGatePage.tsx',
  'supabase/migrations/20260506238500_v385_purchasing_workflow_gate.sql',
  'docs/V385_PURCHASING_WORKFLOW_GATE.md',
  'scripts/qa-v385-purchasing-workflow-gate.mjs',
];

for (const file of requiredFiles) {
  if (!exists(file)) finding('critical', 'Files', `${file} is missing.`, 'Restore the v385 patch file.');
}

if (exists('package.json')) {
  const pkg = JSON.parse(read('package.json'));
  if (!pkg.scripts?.['qa:v385']) finding('critical', 'package.json', 'qa:v385 script is missing.', 'Add qa:v385 to package.json scripts.');
  if (!String(pkg.scripts?.['qa:all'] || '').includes('qa:v385')) finding('critical', 'package.json', 'qa:all does not include qa:v385.', 'Wire qa:v385 into qa:all.');
}

if (exists('src/app/AppShell.tsx')) {
  const app = read('src/app/AppShell.tsx');
  const tokens = ['purchasingGate', 'EnterpriseV385PurchasingGatePage', 'v385 Purchasing Gate', 'Purchasing Gate'];
  for (const token of tokens) {
    if (!app.includes(token)) finding('critical', 'AppShell', `AppShell missing ${token}.`, 'Wire the v385 page into route metadata, route groups, and page map.');
  }
}

if (exists('supabase/migrations/20260506238500_v385_purchasing_workflow_gate.sql')) {
  const sql = read('supabase/migrations/20260506238500_v385_purchasing_workflow_gate.sql');
  const requiredSql = [
    'purchasing_workflow_gate_snapshots',
    'purchasing_workflow_gate_findings',
    'purchasing_workflow_gate_events',
    'worker_record_purchasing_workflow_gate_snapshot',
    'revoke all on function',
    'grant execute on function',
    'to service_role',
  ];
  for (const token of requiredSql) {
    if (!sql.includes(token)) finding('critical', 'Migration', `Migration missing ${token}.`, 'Restore the complete v385 migration.');
  }
  if (/create\s+policy\s+if\s+not\s+exists/i.test(sql)) finding('critical', 'Migration', 'Migration uses unsupported CREATE POLICY IF NOT EXISTS syntax.', 'Use drop policy if exists + create policy.');
  if (/^\s*\\i\s+/m.test(sql)) finding('critical', 'Migration', 'Migration contains psql include command.', 'Inline SQL content instead of using \\i.');
}

const critical = findings.filter((item) => item.severity === 'critical').length;
const warnings = findings.filter((item) => item.severity === 'warning').length;
const report = [
  '# v385 Purchasing Workflow Gate QA',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  `Critical: ${critical}`,
  `Warnings: ${warnings}`,
  '',
  '| Severity | Area | Finding | Action |',
  '|---|---|---|---|',
  ...findings.map((item) => `| ${item.severity} | ${item.area} | ${item.message.replaceAll('|', '\\|')} | ${item.action.replaceAll('|', '\\|')} |`),
  ...(findings.length ? [] : ['', 'No v385 purchasing workflow gate issues detected.']),
].join('\n');
fs.writeFileSync(path.join(root, 'docs/V385_PURCHASING_WORKFLOW_GATE_QA.md'), report);
console.log(report);
if (critical) process.exit(1);
