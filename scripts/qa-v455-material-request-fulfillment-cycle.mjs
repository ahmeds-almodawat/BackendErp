import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appShell = fs.readFileSync(path.join(root, 'src/app/AppShell.tsx'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const migrationPath = path.join(root, 'supabase/migrations/20260506245500_v455_material_request_fulfillment_cycle.sql');
const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';

const findings = [];
const fail = (area, finding, action) => findings.push({ severity: 'critical', area, finding, action });
const warn = (area, finding, action) => findings.push({ severity: 'warning', area, finding, action });

if (!pkg.scripts?.['qa:v455']) fail('package', 'qa:v455 is not wired in package.json.', 'Add qa:v455 script.');
if (!String(pkg.scripts?.['qa:all'] || '').includes('qa:v455')) fail('package', 'qa:all does not include qa:v455.', 'Wire qa:v455 into qa:all.');

[
  'Create Transfer / Issue',
  'createTransferOrIssueReservedStock',
  'material_request_transfer_out',
  'material_request_transfer_in',
  'material_request_internal_issue',
  'fulfillmentMode',
  'Store Transfer',
].forEach((needle) => {
  if (!appShell.includes(needle)) fail('AppShell', `Missing expected v455 marker: ${needle}`, 'Re-apply v455 AppShell patch.');
});

if (appShell.includes('Issue Reserved')) warn('UX', 'Old label Issue Reserved still exists.', 'Prefer Create Transfer / Issue for clarity.');

[
  'material_request_fulfillment_events',
  'material_request_fulfillment_snapshot_v455',
  'fulfillment_mode',
  'transfer_id',
].forEach((needle) => {
  if (!migration.includes(needle)) fail('migration', `Missing expected v455 SQL marker: ${needle}`, 'Check v455 migration file.');
});

const report = [
  '# v455 Material Request Fulfillment Cycle QA',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  `Critical: ${findings.filter((f) => f.severity === 'critical').length}`,
  `Warnings: ${findings.filter((f) => f.severity === 'warning').length}`,
  '',
  '| Severity | Area | Finding | Action |',
  '|---|---|---|---|',
  ...findings.map((f) => `| ${f.severity} | ${f.area} | ${f.finding} | ${f.action} |`),
  findings.length ? '' : '\nNo v455 material request fulfillment issues detected.',
].join('\n');

fs.writeFileSync(path.join(root, 'docs/V455_MATERIAL_REQUEST_FULFILLMENT_CYCLE_QA.md'), report);

if (findings.some((f) => f.severity === 'critical')) {
  console.error(report);
  process.exit(1);
}

console.log(report);
