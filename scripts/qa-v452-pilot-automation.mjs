
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const checks = [];
const exists = (rel) => fs.existsSync(path.join(root, rel));
const read = (rel) => exists(rel) ? fs.readFileSync(path.join(root, rel), 'utf8') : '';
function check(area, ok, finding, action){ checks.push({ severity: ok ? 'ok' : 'critical', area, finding, action }); }
check('engine', exists('src/engines/enterpriseV452PilotAutomationEngine.ts'), 'Pilot automation engine exists', 'Add engine.');
check('page', exists('src/modules/EnterpriseV452PilotAutomationPage.tsx'), 'Pilot automation page exists', 'Add page.');
check('migration', exists('supabase/migrations/20260506245200_v452_pilot_automation.sql'), 'v452 migration exists', 'Add migration.');
check('wiring', read('src/app/AppShell.tsx').includes('pilotAutomation'), 'AppShell has pilotAutomation route', 'Run apply-v452-wiring.');
check('wiring', read('src/app/AppShell.tsx').includes('EnterpriseV452PilotAutomationPage'), 'AppShell imports pilot page', 'Run apply-v452-wiring.');
check('package', read('package.json').includes('qa:v452'), 'package has qa:v452', 'Run apply-v452-wiring.');
check('sql', !/create\s+policy\s+if\s+not\s+exists/i.test(read('supabase/migrations/20260506245200_v452_pilot_automation.sql')), 'v452 SQL avoids unsupported policy syntax', 'Use drop/create policy.');
check('safety', read('src/engines/enterpriseV452PilotAutomationEngine.ts').includes('local/demo only') || read('src/engines/enterpriseV452PilotAutomationEngine.ts').includes('Local/demo only'), 'Automation marked local/demo only', 'Keep production blocked.');
const critical = checks.filter(c=>c.severity==='critical');
const report = ['# v452 Pilot Automation QA','',`Generated: ${new Date().toISOString()}`,'',`Critical: ${critical.length}`,'','| Severity | Area | Finding | Action |','|---|---|---|---|',...checks.filter(c=>c.severity!=='ok').map(c=>`| ${c.severity} | ${c.area} | ${c.finding} | ${c.action} |`)];
fs.writeFileSync(path.join(root,'docs','V452_PILOT_AUTOMATION_QA.md'),report.join('\n'),'utf8');
console.log(report.join('\n'));
if (critical.length) process.exit(1);
