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
  'src/engines/enterpriseV386V390OperationalGatesEngine.ts',
  'src/modules/EnterpriseV386V390OperationalGatePage.tsx',
  'src/modules/EnterpriseV386InventoryGatePage.tsx',
  'src/modules/EnterpriseV387SalesGatePage.tsx',
  'src/modules/EnterpriseV388ProductionGatePage.tsx',
  'src/modules/EnterpriseV389FinanceCloseGatePage.tsx',
  'src/modules/EnterpriseV390HRGatePage.tsx',
  'supabase/migrations/20260506238600_v386_v390_operational_workflow_gates.sql',
  'docs/V386_V390_OPERATIONAL_WORKFLOW_GATES.md',
  'scripts/qa-v386-v390-operational-gates.mjs',
];

for (const file of requiredFiles) {
  if (!exists(file)) finding('critical', 'Files', `${file} is missing.`, 'Restore the v386-v390 mega patch file.');
}

if (exists('package.json')) {
  const pkg = JSON.parse(read('package.json'));
  for (const script of ['qa:v386', 'qa:v387', 'qa:v388', 'qa:v389', 'qa:v390', 'qa:v386-v390']) {
    if (!pkg.scripts?.[script]) finding('critical', 'package.json', `${script} script is missing.`, `Add ${script} to package.json scripts.`);
  }
  if (!String(pkg.scripts?.['qa:all'] || '').includes('qa:v386-v390')) finding('critical', 'package.json', 'qa:all does not include qa:v386-v390.', 'Wire qa:v386-v390 into qa:all.');
}

if (exists('src/app/AppShell.tsx')) {
  const app = read('src/app/AppShell.tsx');
  const tokens = [
    'inventoryGate',
    'salesGate',
    'productionGate',
    'financeCloseGate',
    'hrGate',
    'EnterpriseV386InventoryGatePage',
    'EnterpriseV387SalesGatePage',
    'EnterpriseV388ProductionGatePage',
    'EnterpriseV389FinanceCloseGatePage',
    'EnterpriseV390HRGatePage',
    'v386-v390 Ops Gates',
  ];
  for (const token of tokens) {
    if (!app.includes(token)) finding('critical', 'AppShell', `AppShell missing ${token}.`, 'Wire the v386-v390 route metadata, groups, imports, and page map.');
  }

  const pageMapRequirements = [
    ['inventoryGate', 'EnterpriseV386InventoryGatePage'],
    ['salesGate', 'EnterpriseV387SalesGatePage'],
    ['productionGate', 'EnterpriseV388ProductionGatePage'],
    ['financeCloseGate', 'EnterpriseV389FinanceCloseGatePage'],
    ['hrGate', 'EnterpriseV390HRGatePage'],
  ];

  for (const [routeKey, componentName] of pageMapRequirements) {
    const pattern = new RegExp(`${routeKey}\\s*:\\s*<[^\\n]*${componentName}`);
    if (!pattern.test(app)) {
      finding('critical', 'AppShell page map', `${routeKey} is present in navigation but not mapped to ${componentName}.`, `Add ${routeKey}: <ModuleSuspense ...><${componentName} ... /></ModuleSuspense> to the page map.`);
    }
  }
}

if (exists('src/modules/EnterpriseV386V390OperationalGatePage.tsx')) {
  const page = read('src/modules/EnterpriseV386V390OperationalGatePage.tsx');
  for (const defensiveToken of ['Array.isArray(gate.findings)', 'Array.isArray(gate.checks)', 'EMPTY_GATE']) {
    if (!page.includes(defensiveToken)) finding('critical', 'Render safety', `Shared operational gate page missing ${defensiveToken}.`, 'Re-apply the v386-v390 render safety hotfix.');
  }
}

if (exists('supabase/migrations/20260506238600_v386_v390_operational_workflow_gates.sql')) {
  const sql = read('supabase/migrations/20260506238600_v386_v390_operational_workflow_gates.sql');
  const requiredSql = [
    'operational_workflow_gate_snapshots',
    'operational_workflow_gate_events',
    'worker_record_operational_workflow_gate_snapshot',
    'worker_record_operational_workflow_gate_event',
    'revoke all on function',
    'grant execute on function',
    'to service_role',
  ];
  for (const token of requiredSql) {
    if (!sql.includes(token)) finding('critical', 'Migration', `Migration missing ${token}.`, 'Restore the complete v386-v390 migration.');
  }
  if (/create\s+policy\s+if\s+not\s+exists/i.test(sql)) finding('critical', 'Migration', 'Migration uses unsupported CREATE POLICY IF NOT EXISTS syntax.', 'Use drop policy if exists + create policy.');
  if (/^\s*\\i\s+/m.test(sql)) finding('critical', 'Migration', 'Migration contains psql include command.', 'Inline SQL content instead of using \\i.');
}

const critical = findings.filter((item) => item.severity === 'critical').length;
const warnings = findings.filter((item) => item.severity === 'warning').length;
const report = [
  '# v386-v390 Operational Workflow Gates QA',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  `Critical: ${critical}`,
  `Warnings: ${warnings}`,
  '',
  '| Severity | Area | Finding | Action |',
  '|---|---|---|---|',
  ...findings.map((item) => `| ${item.severity} | ${item.area} | ${item.message.replaceAll('|', '\\|')} | ${item.action.replaceAll('|', '\\|')} |`),
  ...(findings.length ? [] : ['', 'No v386-v390 operational workflow gate issues detected.']),
].join('\n');
fs.writeFileSync(path.join(root, 'docs/V386_V390_OPERATIONAL_WORKFLOW_GATES_QA.md'), report);
console.log(report);
if (critical) process.exit(1);
