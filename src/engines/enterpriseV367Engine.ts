import { moduleRegistry } from '../modules/moduleRegistry';
import { defaultHealthChecks } from '../modules/ops/healthChecks';
import { appShellReductionTasks, summarizeAppShellReduction } from '../modules/ops/appShellReductionPlan';
import { productionConfig, assertProductionCanUseBackend } from '../lib/config/productionConfig';
import { getSupabaseConfig } from '../services/supabaseCutoverBridge';

export type V367Status = 'ready' | 'warning' | 'critical' | 'manual';
export type V367Tone = 'ready' | 'warn' | 'bad' | 'info';

export interface V367GateRow {
  area: string;
  gate: string;
  status: V367Status;
  signal: string;
  action: string;
}

export interface V367ModuleRow {
  module: string;
  owner: string;
  risk: string;
  backendTables: number;
  permissionCoverage: string;
  missingPermissions: string;
  status: V367Status;
  nextAction: string;
}

export interface V367UpgradeWave {
  wave: string;
  title: string;
  status: V367Status;
  entryCriteria: string;
  exitEvidence: string;
  owner: string;
}

export interface V367QaRow {
  id: string;
  test: string;
  expected: string;
  status: V367Status;
  evidence: string;
}

function arr<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function uniqueCount(values: unknown[]) {
  return new Set(values.map((value) => String(value ?? '').trim().toLowerCase()).filter(Boolean)).size;
}

function duplicateCount(values: unknown[]) {
  const cleaned = values.map((value) => String(value ?? '').trim().toLowerCase()).filter(Boolean);
  return Math.max(0, cleaned.length - uniqueCount(cleaned));
}

function journalBalance(journal: any) {
  const lines = arr(journal?.lines);
  const debit = lines.reduce((sum, line: any) => sum + numberValue(line?.debit), 0);
  const credit = lines.reduce((sum, line: any) => sum + numberValue(line?.credit), 0);
  return { debit, credit, diff: Math.abs(debit - credit) };
}

function averageCost(state: any, itemId: string) {
  const movements = arr(state?.stockMovements).filter((movement: any) => movement?.itemId === itemId && movement?.direction === 'in' && numberValue(movement?.qty) > 0 && numberValue(movement?.unitCost) > 0);
  const qty = movements.reduce((sum, movement: any) => sum + numberValue(movement?.qty), 0);
  const value = movements.reduce((sum, movement: any) => sum + numberValue(movement?.qty) * numberValue(movement?.unitCost), 0);
  if (qty > 0) return value / qty;
  return numberValue(arr(state?.items).find((item: any) => item?.id === itemId)?.standardCost);
}

function stockBalances(state: any) {
  const balances = new Map<string, { storeId: string; itemId: string; qty: number; cost: number }>();
  for (const movement of arr(state?.stockMovements)) {
    const storeId = String((movement as any)?.storeId ?? '');
    const itemId = String((movement as any)?.itemId ?? '');
    if (!storeId || !itemId) continue;
    const key = `${storeId}|${itemId}`;
    const existing = balances.get(key) ?? { storeId, itemId, qty: 0, cost: averageCost(state, itemId) };
    existing.qty += ((movement as any)?.direction === 'in' ? 1 : -1) * numberValue((movement as any)?.qty);
    existing.cost = averageCost(state, itemId);
    balances.set(key, existing);
  }
  return Array.from(balances.values());
}

function gateStatus(hasCritical: boolean, hasWarning: boolean): V367Status {
  if (hasCritical) return 'critical';
  if (hasWarning) return 'warning';
  return 'ready';
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function statusTone(status: V367Status): V367Tone {
  if (status === 'ready') return 'ready';
  if (status === 'critical') return 'bad';
  if (status === 'warning') return 'warn';
  return 'info';
}

export function rowsToCsv(rows: any[]) {
  if (!rows.length) return '';
  const headers = Array.from(rows.reduce<Set<string>>((set, row) => {
    Object.keys(row || {}).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));
  const esc = (value: unknown) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(','), ...rows.map((row) => headers.map((header) => esc(row[header])).join(','))].join('\n');
}

export function buildV367ModuleRows(state: any): V367ModuleRow[] {
  const grantedPermissions = new Set(arr(state?.roles).flatMap((role: any) => arr(role?.permissions)).map((permission) => String(permission)));

  return moduleRegistry.map((entry) => {
    const missing = entry.permissionKeys.filter((permission) => !grantedPermissions.has(permission));
    const coverage = `${entry.permissionKeys.length - missing.length}/${entry.permissionKeys.length}`;
    const criticalRisk = entry.riskLevel === 'critical' || entry.riskLevel === 'high';
    const status = missing.length === 0 ? 'ready' : criticalRisk ? 'critical' : 'warning';

    return {
      module: entry.key,
      owner: entry.routeOwner,
      risk: entry.riskLevel,
      backendTables: entry.backendTables.length,
      permissionCoverage: coverage,
      missingPermissions: missing.slice(0, 5).join(', ') || 'none',
      status,
      nextAction: missing.length
        ? `Seed or map ${missing.length} missing permission(s), then retest role coverage.`
        : entry.backendCutoverTasks[0] ?? 'Keep module checks in the release gate.',
    };
  });
}

export function buildV367GateRows(state: any, totals: any = {}): V367GateRow[] {
  const branches = arr(state?.branches);
  const stores = arr(state?.stores);
  const suppliers = arr(state?.suppliers);
  const items = arr(state?.items);
  const menuItems = arr(state?.menuItems);
  const recipeLines = arr(state?.recipeLines);
  const chartAccounts = arr(state?.chartAccounts);
  const fiscalPeriods = arr(state?.fiscalPeriods);
  const roles = arr(state?.roles);
  const userAccounts = arr(state?.userAccounts);
  const sales = arr(state?.sales);
  const journals = arr(state?.journals);
  const audits = arr(state?.audits);
  const balances = stockBalances(state);
  const negativeStock = balances.filter((row) => row.qty < -0.001);
  const zeroCostStock = balances.filter((row) => row.qty > 0.001 && row.cost <= 0);
  const unbalancedJournals = journals.filter((journal: any) => journal?.status === 'posted' && journalBalance(journal).diff > 0.01);
  const duplicateSkus = duplicateCount(items.map((item: any) => item?.sku));
  const duplicateStoreCodes = duplicateCount(stores.map((store: any) => store?.code));
  const duplicateSupplierCodes = duplicateCount(suppliers.map((supplier: any) => supplier?.code));
  const orphanStores = stores.filter((store: any) => store?.branchId && store.branchId !== 'main' && !branches.some((branch: any) => branch?.id === store.branchId));
  const menuIds = new Set(menuItems.map((menu: any) => menu?.id));
  const itemIds = new Set(items.map((item: any) => item?.id));
  const orphanRecipes = recipeLines.filter((line: any) => !menuIds.has(line?.menuItemId) || !itemIds.has(line?.itemId));
  const menuWithoutRecipes = menuItems.filter((menu: any) => !recipeLines.some((line: any) => line?.menuItemId === menu?.id));
  const suppliersMissingIdentity = suppliers.filter((supplier: any) => !supplier?.vatNo || !supplier?.bankName || !supplier?.bankAccount);
  const supabase = getSupabaseConfig();
  const productionFindings = assertProductionCanUseBackend(supabase.configured);
  const healthNotChecked = defaultHealthChecks.filter((check) => check.requiredForGoLive && check.status === 'not_checked');
  const shell = summarizeAppShellReduction(appShellReductionTasks);
  const moduleRows = buildV367ModuleRows(state);
  const criticalModules = moduleRows.filter((row) => row.status === 'critical');

  return [
    {
      area: 'Master data',
      gate: 'Unique, connected setup records',
      status: gateStatus(branches.length === 0 || stores.length === 0 || items.length === 0, duplicateSkus > 0 || duplicateStoreCodes > 0 || duplicateSupplierCodes > 0 || orphanStores.length > 0 || orphanRecipes.length > 0),
      signal: `${branches.length} branches, ${stores.length} stores, ${items.length} items, ${duplicateSkus + duplicateStoreCodes + duplicateSupplierCodes} duplicate code issue(s), ${orphanStores.length + orphanRecipes.length} orphan link(s)`,
      action: 'Resolve missing setup, duplicate codes, and orphan links before live import or posting.',
    },
    {
      area: 'Finance',
      gate: 'GL foundation and balanced posted journals',
      status: gateStatus(chartAccounts.length === 0 || unbalancedJournals.length > 0, fiscalPeriods.length === 0),
      signal: `${chartAccounts.length} accounts, ${journals.length} journals, ${unbalancedJournals.length} unbalanced posted, ${fiscalPeriods.length} fiscal period(s), VAT payable ${numberValue(totals?.vatPayable).toFixed(2)}`,
      action: 'Keep unbalanced journals blocked and create fiscal periods before monthly close.',
    },
    {
      area: 'Inventory',
      gate: 'Stock ledger can support COGS',
      status: gateStatus(negativeStock.length > 0, zeroCostStock.length > 0 || arr(state?.stockMovements).length === 0),
      signal: `${arr(state?.stockMovements).length} movements, ${negativeStock.length} negative balance row(s), ${zeroCostStock.length} zero-cost stocked row(s)`,
      action: 'Post opening quantities/costs and correct negative balances before final COGS.',
    },
    {
      area: 'Sales and recipes',
      gate: 'POS sales can be costed from recipes',
      status: gateStatus(menuItems.length === 0 || sales.length === 0, menuWithoutRecipes.length > 0 || recipeLines.length === 0),
      signal: `${sales.length} sales document(s), ${menuItems.length} menu item(s), ${recipeLines.length} recipe line(s), ${menuWithoutRecipes.length} menu item(s) without recipes`,
      action: 'Map Foodics menu items to recipes, then retest sales posting and COGS.',
    },
    {
      area: 'Purchasing',
      gate: 'AP supplier and receiving controls',
      status: gateStatus(suppliers.length === 0, suppliersMissingIdentity.length > 0 || arr(state?.purchaseInvoices).length === 0),
      signal: `${suppliers.length} supplier(s), ${arr(state?.purchaseOrders).length} PO(s), ${arr(state?.goodsReceipts).length} GRN(s), ${arr(state?.purchaseInvoices).length} invoice(s), ${suppliersMissingIdentity.length} supplier identity gap(s)`,
      action: 'Complete supplier VAT/bank data and exercise PO/GRN/invoice matching in the pilot pack.',
    },
    {
      area: 'Access',
      gate: 'Roles, users, and critical permissions',
      status: gateStatus(roles.length === 0 || criticalModules.length > 0, userAccounts.length === 0),
      signal: `${roles.length} role(s), ${userAccounts.length} user account(s), ${criticalModules.length} high-risk module(s) missing permission coverage`,
      action: 'Seed authority matrix roles and validate module permission coverage before real users.',
    },
    {
      area: 'Backend',
      gate: 'Production mode cannot run on demo fallback',
      status: productionFindings.length ? 'critical' : supabase.configured ? 'ready' : 'warning',
      signal: `${productionConfig.runtimeMode} mode, Supabase ${supabase.configured ? 'configured' : 'not configured'}, ${productionFindings.length} production blocker(s)`,
      action: supabase.configured ? 'Run staging migrations and RPC smoke tests.' : 'Configure Supabase for staging/production, or keep runtime mode local-demo.',
    },
    {
      area: 'Operate',
      gate: 'Release, support, audit, and refactor controls',
      status: gateStatus(false, healthNotChecked.length > 0 || shell.status !== 'ready' || audits.length === 0),
      signal: `${healthNotChecked.length} required health check(s) not checked, AppShell refactor ${shell.status}, ${audits.length} audit row(s)`,
      action: 'Run the v367 QA gate, record audit evidence, and keep reducing AppShell by route ownership.',
    },
  ];
}

export function buildV367UpgradeWaves(gates: V367GateRow[]): V367UpgradeWave[] {
  const criticalCount = gates.filter((gate) => gate.status === 'critical').length;
  const warningCount = gates.filter((gate) => gate.status === 'warning').length;
  const backendGate = gates.find((gate) => gate.area === 'Backend');
  const financeGate = gates.find((gate) => gate.area === 'Finance');
  const inventoryGate = gates.find((gate) => gate.area === 'Inventory');

  return [
    {
      wave: '0',
      title: 'Freeze and evaluate',
      status: criticalCount ? 'critical' : warningCount ? 'warning' : 'ready',
      entryCriteria: 'Run v366 and v367 QA, export findings, and keep prototype claims honest.',
      exitEvidence: `${criticalCount} critical gate(s), ${warningCount} warning gate(s).`,
      owner: 'Release lead',
    },
    {
      wave: '1',
      title: 'Repair data truth',
      status: financeGate?.status === 'critical' || inventoryGate?.status === 'critical' ? 'critical' : financeGate?.status === 'warning' || inventoryGate?.status === 'warning' ? 'warning' : 'ready',
      entryCriteria: 'Master data, stock, recipes, and journals are internally consistent.',
      exitEvidence: 'No negative stock, zero-cost on-hand, or unbalanced posted journals.',
      owner: 'Finance and inventory leads',
    },
    {
      wave: '2',
      title: 'Backend authority',
      status: backendGate?.status ?? 'manual',
      entryCriteria: 'Supabase configured in staging with RLS and permission checks enabled.',
      exitEvidence: 'Posting and import RPCs return audited success/failure responses.',
      owner: 'Backend lead',
    },
    {
      wave: '3',
      title: 'Route decoupling',
      status: summarizeAppShellReduction().status === 'ready' ? 'ready' : 'manual',
      entryCriteria: 'Each route has a module owner and no new AppShell business logic is added.',
      exitEvidence: 'Finance, inventory, purchasing, and reports move into owned route packages.',
      owner: 'Frontend lead',
    },
    {
      wave: '4',
      title: 'Pilot go-live rehearsal',
      status: criticalCount ? 'critical' : 'manual',
      entryCriteria: 'All critical gates are closed and warning gates have owners.',
      exitEvidence: 'UAT seed pack, RLS dry-run, backup/restore, close pack, and rollback drill pass.',
      owner: 'Implementation lead',
    },
  ];
}

export function buildV367QaSuite(gates: V367GateRow[]): V367QaRow[] {
  const criticalCount = gates.filter((gate) => gate.status === 'critical').length;
  const warningCount = gates.filter((gate) => gate.status === 'warning').length;
  return [
    {
      id: 'V367-QA-001',
      test: 'Static mega-upgrade scan',
      expected: 'v367 files, scripts, metadata, docs, and route wiring are present.',
      status: 'manual',
      evidence: 'npm run qa:v367',
    },
    {
      id: 'V367-QA-002',
      test: 'Legacy repair scan still passes',
      expected: 'No v366 critical loose ends are reintroduced.',
      status: 'manual',
      evidence: 'npm run qa:v366',
    },
    {
      id: 'V367-QA-003',
      test: 'TypeScript project check',
      expected: 'The new evaluator and page compile with the app.',
      status: 'manual',
      evidence: 'npm run typecheck',
    },
    {
      id: 'V367-QA-004',
      test: 'Production bundle',
      expected: 'Lazy enterprise upgrade page builds without breaking Vite chunks.',
      status: 'manual',
      evidence: 'npm run build',
    },
    {
      id: 'V367-QA-005',
      test: 'Runtime gate review',
      expected: 'No production mode is allowed without Supabase configuration.',
      status: criticalCount ? 'critical' : warningCount ? 'warning' : 'ready',
      evidence: `${criticalCount} critical gate(s), ${warningCount} warning gate(s).`,
    },
  ];
}

export function buildV367MegaUpgradeSnapshot(state: any, totals: any = {}) {
  const gates = buildV367GateRows(state, totals);
  const modules = buildV367ModuleRows(state);
  const waves = buildV367UpgradeWaves(gates);
  const qa = buildV367QaSuite(gates);
  const criticalGates = gates.filter((gate) => gate.status === 'critical').length;
  const warningGates = gates.filter((gate) => gate.status === 'warning').length;
  const readyGates = gates.filter((gate) => gate.status === 'ready').length;
  const criticalModules = modules.filter((module) => module.status === 'critical').length;
  const warningModules = modules.filter((module) => module.status === 'warning').length;
  const readyModules = modules.filter((module) => module.status === 'ready').length;
  const supabase = getSupabaseConfig();

  const gateScore = clampScore(100 - criticalGates * 14 - warningGates * 5);
  const moduleScore = clampScore(100 - criticalModules * 9 - warningModules * 4);
  const backendScore = clampScore(supabase.configured ? 84 : productionConfig.runtimeMode === 'production' ? 5 : 52);
  const refactorScore = clampScore(100 - appShellReductionTasks.filter((task) => task.risk === 'high' || task.risk === 'critical').length * 8 - appShellReductionTasks.filter((task) => task.status !== 'done').length * 4);
  const upgradeScore = clampScore((gateScore * 0.42) + (moduleScore * 0.24) + (backendScore * 0.2) + (refactorScore * 0.14));

  return {
    version: 'v367 Mega Upgrade Patch',
    generatedAt: new Date().toISOString(),
    counts: {
      gates: gates.length,
      readyGates,
      warningGates,
      criticalGates,
      modules: modules.length,
      readyModules,
      warningModules,
      criticalModules,
      appShellRefactorTasks: appShellReductionTasks.length,
    },
    scores: {
      gateScore,
      moduleScore,
      backendScore,
      refactorScore,
      upgradeScore,
    },
    runtime: {
      mode: productionConfig.runtimeMode,
      supabaseConfigured: supabase.configured,
      supabaseUrl: supabase.url,
      productionFindings: assertProductionCanUseBackend(supabase.configured),
    },
    gates,
    modules,
    waves,
    qa,
  };
}
