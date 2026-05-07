export type BackendMode = 'local' | 'supabase';
export type SetupEntityKey = 'companies' | 'branches' | 'stores' | 'suppliers' | 'items' | 'costCenters' | 'chartAccounts' | 'roles' | 'permissions';

export type BackendHealth = {
  configured: boolean;
  url?: string;
  mode: BackendMode;
  message: string;
};

export type SetupSyncPayload = {
  exportedAt: string;
  company: { id: string; nameEn: string; nameAr: string; currency: string; vatRate: number };
  branches: any[];
  stores: any[];
  suppliers: any[];
  items: any[];
  costCenters: any[];
  chartAccounts: any[];
  roles: any[];
  permissions: any[];
};

const normalize = (value: string) => String(value || '').trim().toLowerCase();
const uniqCount = (rows: any[], key: string) => new Set(rows.map((row) => normalize(row?.[key])).filter(Boolean)).size;

export function getBackendHealth(): BackendHealth {
  const env = (import.meta as any).env || {};
  const url = env.VITE_SUPABASE_URL || '';
  const anon = env.VITE_SUPABASE_ANON_KEY || '';
  const configured = Boolean(url && anon && !String(url).includes('your-project-ref'));
  return {
    configured,
    url: url ? String(url).replace(/\/rest\/v1.*$/, '') : undefined,
    mode: configured ? 'supabase' : 'local',
    message: configured
      ? 'Supabase environment variables are present. Setup sync can be wired to real tables.'
      : 'Running in Local Trial Mode. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable Supabase pilot mode.',
  };
}

export function buildSetupSyncPayload(state: any): SetupSyncPayload {
  return {
    exportedAt: new Date().toISOString(),
    company: { id: 'local-company', nameEn: 'Restaurant Group', nameAr: 'مجموعة المطاعم', currency: 'SAR', vatRate: 15 },
    branches: Array.isArray(state?.branches) ? state.branches : [],
    stores: Array.isArray(state?.stores) ? state.stores : [],
    suppliers: Array.isArray(state?.suppliers) ? state.suppliers : [],
    items: Array.isArray(state?.items) ? state.items : [],
    costCenters: Array.isArray(state?.costCenters) ? state.costCenters : [],
    chartAccounts: Array.isArray(state?.chartAccounts) ? state.chartAccounts : [],
    roles: Array.isArray(state?.roles) ? state.roles : [],
    permissions: Array.isArray(state?.permissions) ? state.permissions : [],
  };
}

export function validateSetupForBackend(state: any) {
  const branches = Array.isArray(state?.branches) ? state.branches : [];
  const stores = Array.isArray(state?.stores) ? state.stores : [];
  const suppliers = Array.isArray(state?.suppliers) ? state.suppliers : [];
  const items = Array.isArray(state?.items) ? state.items : [];
  const costCenters = Array.isArray(state?.costCenters) ? state.costCenters : [];
  const chartAccounts = Array.isArray(state?.chartAccounts) ? state.chartAccounts : [];
  const duplicateSkus = items.length - uniqCount(items, 'sku');
  const duplicateBranchCodes = branches.length - uniqCount(branches, 'code');
  const duplicateStoreCodes = stores.length - uniqCount(stores, 'code');
  const duplicateAccountCodes = chartAccounts.length - uniqCount(chartAccounts, 'code');
  const orphanStores = stores.filter((store: any) => store.branchId !== 'main' && !branches.some((branch: any) => branch.id === store.branchId)).length;
  const suppliersMissingCompliance = suppliers.filter((supplier: any) => !supplier.vatNo || !supplier.bankName || !supplier.bankAccount).length;
  const itemsMissingUnit = items.filter((item: any) => !item.purchaseUnit || !item.consumptionUnit).length;
  const costCentersMissingBranch = costCenters.filter((cc: any) => cc.branchId !== 'company' && !branches.some((branch: any) => branch.id === cc.branchId)).length;
  const rows = [
    { area: 'Branches', control: 'Unique branch code', count: duplicateBranchCodes, status: duplicateBranchCodes ? 'Blocker' : 'Ready' },
    { area: 'Stores', control: 'Unique store code', count: duplicateStoreCodes, status: duplicateStoreCodes ? 'Blocker' : 'Ready' },
    { area: 'Stores', control: 'Valid branch link', count: orphanStores, status: orphanStores ? 'Blocker' : 'Ready' },
    { area: 'Items', control: 'Unique SKU', count: duplicateSkus, status: duplicateSkus ? 'Blocker' : 'Ready' },
    { area: 'Items', control: 'Purchase/consumption units', count: itemsMissingUnit, status: itemsMissingUnit ? 'Warning' : 'Ready' },
    { area: 'Suppliers', control: 'VAT/bank compliance', count: suppliersMissingCompliance, status: suppliersMissingCompliance ? 'Warning' : 'Ready' },
    { area: 'Cost Centers', control: 'Valid branch link', count: costCentersMissingBranch, status: costCentersMissingBranch ? 'Blocker' : 'Ready' },
    { area: 'Chart of Accounts', control: 'Unique account code', count: duplicateAccountCodes, status: duplicateAccountCodes ? 'Blocker' : 'Ready' },
  ];
  const blockers = rows.filter((row) => row.status === 'Blocker').length;
  const warnings = rows.filter((row) => row.status === 'Warning').length;
  return { rows, blockers, warnings, score: Math.max(0, 100 - blockers * 18 - warnings * 5) };
}

export function downloadJson(fileName: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function postToSupabaseEdge(functionName: string, payload: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const env = (import.meta as any).env || {};
  const url = env.VITE_SUPABASE_URL || '';
  const anon = env.VITE_SUPABASE_ANON_KEY || '';
  if (!url || !anon) return { ok: false, status: 0, data: { error: 'Supabase environment is not configured.' } };
  const endpoint = `${String(url).replace(/\/$/, '')}/functions/v1/${functionName}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anon}`, apikey: anon },
    body: JSON.stringify(payload),
  });
  let data: any = null;
  try { data = await res.json(); } catch { data = await res.text(); }
  return { ok: res.ok, status: res.status, data };
}
