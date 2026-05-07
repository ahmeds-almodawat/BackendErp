export type BackendMode = 'local' | 'supabase-ready' | 'supabase-missing-key';

const asArray = (value: any) => Array.isArray(value) ? value : [];
const clean = (value: any) => String(value ?? '').trim();

export function getBackendMode() {
  const env = (import.meta as any).env || {};
  const url = clean(env.VITE_SUPABASE_URL);
  const anon = clean(env.VITE_SUPABASE_ANON_KEY);
  const edge = clean(env.VITE_SUPABASE_EDGE_BASE_URL || url ? `${url}/functions/v1` : '');
  let mode: BackendMode = 'local';
  if (url && anon) mode = 'supabase-ready';
  if (url && !anon) mode = 'supabase-missing-key';
  return { mode, url, anonKeyConfigured: Boolean(anon), edgeBaseUrl: edge, canCallEdge: Boolean(url && anon) };
}

function duplicateRows(rows: any[], key: string) {
  const map = new Map<string, any[]>();
  rows.forEach((row) => {
    const value = clean(row?.[key]).toLowerCase();
    if (!value) return;
    map.set(value, [...(map.get(value) || []), row]);
  });
  return Array.from(map.entries()).filter(([, list]) => list.length > 1).map(([value, list]) => ({ key, value, count: list.length }));
}

export function buildSetupPayload(state: any) {
  const payload = {
    generatedAt: new Date().toISOString(),
    company: {
      code: 'LOCAL-RESTAURANT-GROUP',
      nameEn: 'Restaurant Group Pilot',
      nameAr: 'مجموعة مطاعم التجربة',
      currency: 'SAR',
      vatRate: 0.15,
    },
    branches: asArray(state?.branches),
    stores: asArray(state?.stores),
    suppliers: asArray(state?.suppliers),
    items: asArray(state?.items),
    costCenters: asArray(state?.costCenters),
    chartAccounts: asArray(state?.chartAccounts),
    employees: asArray(state?.employees),
    userAccounts: asArray(state?.userAccounts),
    roles: asArray(state?.roles),
    permissions: asArray(state?.permissions),
    userRoles: asArray(state?.userRoles),
    accessScopes: asArray(state?.accessScopes),
  };
  return payload;
}

export function validateSetupPayload(state: any) {
  const branches = asArray(state?.branches);
  const stores = asArray(state?.stores);
  const suppliers = asArray(state?.suppliers);
  const items = asArray(state?.items);
  const accounts = asArray(state?.chartAccounts);
  const costCenters = asArray(state?.costCenters);
  const recipes = asArray(state?.recipeLines);
  const menuItems = asArray(state?.menuItems);
  const issues: Array<{ id: string; severity: 'critical' | 'warning' | 'info' | 'ready'; area: string; issue: string; fix: string; count: number }> = [];
  const push = (severity: 'critical' | 'warning' | 'info' | 'ready', area: string, issue: string, fix: string, count = 1) => issues.push({ id: `SETUP-${String(issues.length + 1).padStart(3, '0')}`, severity, area, issue, fix, count });

  if (!branches.length) push('critical', 'Branches', 'No branches loaded', 'Import or create branches before backend sync');
  if (!stores.length) push('critical', 'Stores', 'No stores loaded', 'Import or create stores and link them to branches');
  if (!items.length) push('critical', 'Items', 'No item/SKU master loaded', 'Import item master before Foodics full posting');
  if (!accounts.length) push('critical', 'Finance', 'Chart of accounts missing', 'Import chart of accounts before finance pilot');
  duplicateRows(branches, 'code').forEach((d) => push('critical', 'Branches', `Duplicate branch code: ${d.value}`, 'Keep branch codes unique', d.count));
  duplicateRows(stores, 'code').forEach((d) => push('critical', 'Stores', `Duplicate store code: ${d.value}`, 'Keep store codes unique', d.count));
  duplicateRows(items, 'sku').forEach((d) => push('critical', 'Items', `Duplicate SKU: ${d.value}`, 'Keep SKU unique because Foodics mapping uses SKU', d.count));
  duplicateRows(accounts, 'code').forEach((d) => push('critical', 'Finance', `Duplicate account code: ${d.value}`, 'Keep chart account codes unique', d.count));

  const branchIds = new Set(branches.map((b: any) => b.id));
  const invalidStores = stores.filter((s: any) => s.branchId && s.branchId !== 'main' && !branchIds.has(s.branchId));
  if (invalidStores.length) push('critical', 'Stores', `${invalidStores.length} stores link to missing branches`, 'Fix store branch links before backend sync', invalidStores.length);
  const missingSupplierCompliance = suppliers.filter((s: any) => !clean(s.vatNo) || !clean(s.bankName) || !clean(s.bankAccount) || !clean(s.representativeName) || !clean(s.representativePhone));
  if (missingSupplierCompliance.length) push('warning', 'Suppliers', `${missingSupplierCompliance.length} suppliers miss VAT/bank/representative fields`, 'Complete supplier compliance fields before production AP', missingSupplierCompliance.length);
  const itemsMissingUnit = items.filter((i: any) => !clean(i.baseUnit));
  if (itemsMissingUnit.length) push('warning', 'Items', `${itemsMissingUnit.length} items have no base unit`, 'Add base unit for inventory costing and recipe conversion', itemsMissingUnit.length);
  const costCenterBranchIssues = costCenters.filter((c: any) => c.branchId && c.branchId !== 'all' && !branchIds.has(c.branchId));
  if (costCenterBranchIssues.length) push('warning', 'Cost Centers', `${costCenterBranchIssues.length} cost centers link to missing branch`, 'Fix cost center branch assignment', costCenterBranchIssues.length);
  const menuMissingRecipes = menuItems.filter((m: any) => !recipes.some((r: any) => r.menuItemId === m.id));
  if (menuMissingRecipes.length) push('warning', 'Recipes', `${menuMissingRecipes.length} menu items have no recipe`, 'Allow starter sales accounting or add recipes before full ERP posting', menuMissingRecipes.length);
  if (!issues.length) push('ready', 'Setup', 'Master data is clean for pilot sync', 'Proceed with setup-sync dry-run', 0);

  const blockers = issues.filter((i) => i.severity === 'critical').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const readiness = Math.max(0, Math.min(100, Math.round(100 - blockers * 14 - warnings * 4)));
  return { readiness, blockers, warnings, issues };
}

export async function callSetupSyncDryRun(payload: any) {
  const backend = getBackendMode();
  if (!backend.canCallEdge) {
    return { ok: true, mode: backend.mode, dryRun: true, localOnly: true, message: 'Local dry-run passed. Supabase environment is not configured.', received: summarizePayload(payload) };
  }
  const response = await fetch(`${backend.edgeBaseUrl}/setup-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(import.meta as any).env.VITE_SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ dryRun: true, payload }),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, mode: backend.mode, status: response.status, ...data };
}

export function summarizePayload(payload: any) {
  return {
    branches: asArray(payload?.branches).length,
    stores: asArray(payload?.stores).length,
    suppliers: asArray(payload?.suppliers).length,
    items: asArray(payload?.items).length,
    costCenters: asArray(payload?.costCenters).length,
    accounts: asArray(payload?.chartAccounts).length,
    employees: asArray(payload?.employees).length,
    userAccounts: asArray(payload?.userAccounts).length,
    roles: asArray(payload?.roles).length,
    permissions: asArray(payload?.permissions).length,
  };
}
