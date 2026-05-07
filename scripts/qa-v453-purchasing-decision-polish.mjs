import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const app = fs.readFileSync(path.join(root, 'src/app/AppShell.tsx'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const docExists = fs.existsSync(path.join(root, 'docs/V453_PURCHASING_DECISION_POLISH.md'));

const required = [
  ['Batch No. label', "'Batch No.'"],
  ['Reject material request', 'const rejectRequest'],
  ['Delete material request', 'const deleteRequest'],
  ['Request stock coverage', 'const requestCoverage'],
  ['Use stock action', 'issueRequestFromStock'],
  ['Shortage PO split action', 'createShortagePosFromRequest'],
  ['Supplier inference for split PO', 'inferSupplierForItem'],
  ['Cancel PO action', 'const cancelPo'],
  ['Delete PO action', 'const deletePo'],
  ['Multi-supplier PO guidance', 'One purchase order belongs to one supplier'],
];

const findings = [];
for (const [label, token] of required) {
  if (!app.includes(token)) findings.push({ severity: 'critical', area: label, finding: `Missing token: ${token}`, action: 'Re-apply v453 purchasing decision polish patch.' });
}
if (!pkg.scripts?.['qa:v453']) findings.push({ severity: 'critical', area: 'package.json', finding: 'qa:v453 script missing', action: 'Wire qa:v453 into package.json.' });
if (!String(pkg.scripts?.['qa:all'] ?? '').includes('qa:v453')) findings.push({ severity: 'critical', area: 'package.json', finding: 'qa:v453 not included in qa:all', action: 'Add qa:v453 to qa:all.' });
if (!docExists) findings.push({ severity: 'warning', area: 'Documentation', finding: 'v453 document missing', action: 'Restore docs/V453_PURCHASING_DECISION_POLISH.md.' });

const critical = findings.filter((f) => f.severity === 'critical').length;
const warnings = findings.filter((f) => f.severity === 'warning').length;
const report = ['# v453 Purchasing Decision Polish QA', '', `Generated: ${new Date().toISOString()}`, '', `Critical: ${critical}`, `Warnings: ${warnings}`, '', '| Severity | Area | Finding | Action |', '|---|---|---|---|', ...findings.map((f) => `| ${f.severity} | ${f.area} | ${f.finding} | ${f.action} |`)];
if (!findings.length) report.push('', 'No v453 purchasing decision polish issues detected.');
fs.writeFileSync(path.join(root, 'docs/V453_PURCHASING_DECISION_POLISH_QA.md'), report.join('\n'));
console.log(report.join('\n'));
if (critical) process.exit(1);
