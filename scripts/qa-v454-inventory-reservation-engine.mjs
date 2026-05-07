import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [];
const appPath = path.join(root, 'src/app/AppShell.tsx');
const pkgPath = path.join(root, 'package.json');
const migrationPath = path.join(root, 'supabase/migrations/20260506245400_v454_inventory_reservation_engine.sql');

function check(area, condition, finding, action) {
  if (!condition) checks.push({ severity: 'critical', area, finding, action });
}

const app = fs.existsSync(appPath) ? fs.readFileSync(appPath, 'utf8') : '';
const pkg = fs.existsSync(pkgPath) ? fs.readFileSync(pkgPath, 'utf8') : '';
const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';

check('AppShell', app.includes('type InventoryReservation'), 'InventoryReservation type missing.', 'Add reservation type.');
check('AppShell', app.includes('inventoryReservations: InventoryReservation[]'), 'ERP state lacks inventoryReservations.', 'Add reservations to ERPState.');
check('AppShell', app.includes('internalStockIssues: InternalStockIssue[]'), 'ERP state lacks internalStockIssues.', 'Add internal stock issue state.');
check('AppShell', app.includes('function getReservedQty'), 'Reserved quantity helper missing.', 'Add getReservedQty helper.');
check('AppShell', app.includes('function getFreeStock'), 'Free stock helper missing.', 'Add getFreeStock helper.');
check('Purchasing', app.includes('Reserve Stock'), 'Reserve Stock action missing.', 'Expose reserve button.');
check('Purchasing', app.includes('Issue Reserved'), 'Issue Reserved action missing.', 'Expose issue reserved button.');
check('Purchasing', app.includes('reserved_material_issue_out'), 'Reserved issue movement out missing.', 'Create stock movement evidence.');
check('Purchasing', app.includes('reserved_material_issue_in'), 'Reserved issue movement in missing.', 'Create stock movement evidence.');
check('Migration', migration.includes('create table if not exists public.inventory_reservations'), 'inventory_reservations table missing.', 'Add v454 migration.');
check('Migration', migration.includes('create table if not exists public.internal_stock_issues'), 'internal_stock_issues table missing.', 'Add internal issue evidence table.');
check('Migration', migration.includes('inventory_reservation_snapshot_v454'), 'reservation snapshot RPC missing.', 'Add evidence RPC.');
check('Package', pkg.includes('qa:v454'), 'qa:v454 script missing.', 'Wire package script.');
check('Package', pkg.includes('npm run qa:v454'), 'qa:v454 not included in qa:all.', 'Wire qa:v454 into qa:all.');

const report = ['# v454 Inventory Reservation Engine QA', '', `Generated: ${new Date().toISOString()}`, '', `Critical: ${checks.length}`, 'Warnings: 0', '', '| Severity | Area | Finding | Action |', '|---|---|---|---|'];
for (const issue of checks) report.push(`| ${issue.severity} | ${issue.area} | ${issue.finding} | ${issue.action} |`);
if (!checks.length) report.push('', 'No v454 inventory reservation engine issues detected.');
fs.writeFileSync(path.join(root, 'docs/V454_INVENTORY_RESERVATION_ENGINE_QA.md'), report.join('\n'));

if (checks.length) {
  console.error(report.join('\n'));
  process.exit(1);
}
console.log('v454 inventory reservation engine QA passed.');
