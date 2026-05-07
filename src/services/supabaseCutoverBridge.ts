export type BackendMode = 'local' | 'supabase-ready' | 'supabase-configured';
export type SetupValidationSeverity = 'critical' | 'warning' | 'ready';

export type SetupValidationRow = {
  area: string;
  severity: SetupValidationSeverity;
  finding: string;
  action: string;
  count?: number;
};

export type SetupPayload = {
  meta: {
    version: string;
    exportedAt: string;
    source: string;
    mode: BackendMode;
  };
  company: {
    code: string;
    name_en: string;
    name_ar: string;
    currency: string;
    vat_rate: number;
  };
  branches: any[];
  stores: any[];
  suppliers: any[];
  items: any[];
  cost_centers: any[];
  chart_accounts: any[];
  employees: any[];
  user_accounts: any[];
  roles: any[];
  permissions: any[];
  access_scopes: any[];
};

export function getSupabaseConfig() {
  const env = ((import.meta as any).env || {}) as Record<string, string | undefined>;
  const url = (env.VITE_SUPABASE_URL || '').trim();
  const anonKey = (env.VITE_SUPABASE_ANON_KEY || '').trim();
  const backendMode = (env.VITE_BACKEND_MODE || env.VITE_APP_MODE || 'local').trim();
  const configured = Boolean(url && anonKey && !anonKey.includes('replace') && !url.includes('your-project-ref'));
  const mode: BackendMode = configured ? 'supabase-configured' : url ? 'supabase-ready' : 'local';
  return { url, anonKey, backendMode, configured, mode };
}

export function buildSetupPayload(state: any): SetupPayload {
  const config = getSupabaseConfig();
  const normalize = (rows: any[]) => Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
  return {
    meta: {
      version: 'v301-supabase-cutover-foundation',
      exportedAt: new Date().toISOString(),
      source: 'restaurant-erp-local-browser',
      mode: config.mode,
    },
    company: {
      code: 'COMP-001',
      name_en: 'Restaurant ERP Company',
      name_ar: 'شركة نظام المطاعم',
      currency: 'SAR',
      vat_rate: 15,
    },
    branches: normalize(state?.branches),
    stores: normalize(state?.stores),
    suppliers: normalize(state?.suppliers),
    items: normalize(state?.items),
    cost_centers: normalize(state?.costCenters),
    chart_accounts: normalize(state?.chartAccounts),
    employees: normalize(state?.employees),
    user_accounts: normalize(state?.userAccounts),
    roles: normalize(state?.roles),
    permissions: normalize(state?.permissions),
    access_scopes: normalize(state?.userAccess),
  };
}

function duplicates(values: string[]) {
  const seen = new Set<string>();
  const dups = new Set<string>();
  values.filter(Boolean).forEach((v) => {
    const key = String(v).trim().toLowerCase();
    if (seen.has(key)) dups.add(v);
    seen.add(key);
  });
  return Array.from(dups);
}

export function validateSetupForBackend(state: any): SetupValidationRow[] {
  const branches = Array.isArray(state?.branches) ? state.branches : [];
  const stores = Array.isArray(state?.stores) ? state.stores : [];
  const suppliers = Array.isArray(state?.suppliers) ? state.suppliers : [];
  const items = Array.isArray(state?.items) ? state.items : [];
  const costCenters = Array.isArray(state?.costCenters) ? state.costCenters : [];
  const accounts = Array.isArray(state?.chartAccounts) ? state.chartAccounts : [];
  const roles = Array.isArray(state?.roles) ? state.roles : [];
  const employees = Array.isArray(state?.employees) ? state.employees : [];
  const userAccounts = Array.isArray(state?.userAccounts) ? state.userAccounts : [];
  const rows: SetupValidationRow[] = [];
  const push = (area: string, severity: SetupValidationSeverity, finding: string, action: string, count?: number) => rows.push({ area, severity, finding, action, count });

  push('Branches', branches.length ? 'ready' : 'critical', `${branches.length} branches loaded`, branches.length ? 'Ready for backend sync' : 'Create or import branches first', branches.length);
  push('Stores', stores.length ? 'ready' : 'critical', `${stores.length} stores loaded`, stores.length ? 'Ready for backend sync' : 'Create/import stores and link them to branches', stores.length);
  push('Items', items.length ? 'ready' : 'critical', `${items.length} SKUs loaded`, items.length ? 'Ready for backend sync' : 'Create/import item master first', items.length);
  push('Chart of Accounts', accounts.length ? 'ready' : 'critical', `${accounts.length} accounts loaded`, accounts.length ? 'Ready for backend sync' : 'Load chart of accounts before finance cutover', accounts.length);

  const branchCodes = duplicates(branches.map((b: any) => b.code));
  if (branchCodes.length) push('Branches', 'critical', `Duplicate branch codes: ${branchCodes.join(', ')}`, 'Fix duplicate branch codes before syncing', branchCodes.length);
  const storeCodes = duplicates(stores.map((s: any) => s.code));
  if (storeCodes.length) push('Stores', 'critical', `Duplicate store codes: ${storeCodes.join(', ')}`, 'Fix duplicate store codes before syncing', storeCodes.length);
  const itemSkus = duplicates(items.map((i: any) => i.sku));
  if (itemSkus.length) push('Items', 'critical', `Duplicate SKUs: ${itemSkus.join(', ')}`, 'Fix duplicate SKUs before syncing', itemSkus.length);
  const accountCodes = duplicates(accounts.map((a: any) => a.code));
  if (accountCodes.length) push('Chart of Accounts', 'critical', `Duplicate account codes: ${accountCodes.join(', ')}`, 'Fix duplicate account codes before syncing', accountCodes.length);

  const branchIds = new Set(branches.map((b: any) => b.id));
  const orphanStores = stores.filter((s: any) => s.branchId && !['main', 'company'].includes(s.branchId) && !branchIds.has(s.branchId));
  if (orphanStores.length) push('Stores', 'critical', `${orphanStores.length} stores linked to missing branches`, 'Fix store-to-branch links', orphanStores.length);
  const orphanCostCenters = costCenters.filter((c: any) => c.branchId && !['company', 'main'].includes(c.branchId) && !branchIds.has(c.branchId));
  if (orphanCostCenters.length) push('Cost Centers', 'warning', `${orphanCostCenters.length} cost centers linked to missing branches`, 'Review cost center branch links', orphanCostCenters.length);

  const missingUnits = items.filter((i: any) => !i.purchaseUnit || !i.consumptionUnit);
  if (missingUnits.length) push('Items', 'warning', `${missingUnits.length} items missing purchase/consumption units`, 'Complete unit setup before inventory cutover', missingUnits.length);
  const supplierCompliance = suppliers.filter((s: any) => !s.vatNo || !s.bankName || !s.bankAccount || !s.representativeName);
  if (supplierCompliance.length) push('Suppliers', 'warning', `${supplierCompliance.length} suppliers missing VAT/bank/representative info`, 'Complete supplier compliance fields before AP pilot', supplierCompliance.length);
  const employeeCodes = duplicates(employees.map((e: any) => e.code));
  if (employeeCodes.length) push('Employees', 'critical', `Duplicate employee codes: ${employeeCodes.join(', ')}`, 'Fix duplicate employee codes before syncing users', employeeCodes.length);
  const userEmails = duplicates(userAccounts.map((u: any) => u.email));
  if (userEmails.length) push('Users', 'critical', `Duplicate user emails: ${userEmails.join(', ')}`, 'Fix duplicate user emails before Auth cutover', userEmails.length);
  const employeeIds = new Set(employees.map((e: any) => e.id));
  const usersWithoutEmployees = userAccounts.filter((u: any) => !employeeIds.has(u.employeeId));
  if (usersWithoutEmployees.length) push('Users', 'critical', `${usersWithoutEmployees.length} user accounts missing linked employee`, 'Create linked employee for every user account', usersWithoutEmployees.length);
  const employeesWithoutUsers = employees.filter((e: any) => !userAccounts.some((u: any) => u.employeeId === e.id));
  if (employeesWithoutUsers.length) push('Users', 'warning', `${employeesWithoutUsers.length} employees do not have user accounts`, 'Use Users & Employees page to create login accounts where needed', employeesWithoutUsers.length);
  push('Roles', roles.length ? 'ready' : 'warning', `${roles.length} roles loaded`, roles.length ? 'Ready for permission sync' : 'Create at least Owner/Admin role before backend pilot', roles.length);

  return rows;
}

export function buildBackendReadinessScore(rows: SetupValidationRow[], configured = getSupabaseConfig().configured) {
  const critical = rows.filter((r) => r.severity === 'critical').length;
  const warning = rows.filter((r) => r.severity === 'warning').length;
  const base = configured ? 82 : 68;
  return Math.max(0, Math.min(96, base - critical * 8 - warning * 2));
}

function sqlValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '0';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function buildSetupSeedSql(payload: SetupPayload) {
  const lines: string[] = [];
  lines.push('-- v301 backend setup seed generated from local ERP state');
  lines.push('-- Review before applying to production. Prefer setup-sync Edge Function for live use.');
  lines.push('begin;');
  lines.push(`insert into public.companies (code, name_en, name_ar, currency, vat_rate) values (${sqlValue(payload.company.code)}, ${sqlValue(payload.company.name_en)}, ${sqlValue(payload.company.name_ar)}, ${sqlValue(payload.company.currency)}, ${sqlValue(payload.company.vat_rate)}) on conflict (code) do update set name_en = excluded.name_en, name_ar = excluded.name_ar, currency = excluded.currency, vat_rate = excluded.vat_rate;`);
  payload.branches.forEach((b: any) => lines.push(`insert into public.branches (id, company_id, code, name_en, name_ar, location, active) select ${sqlValue(b.id)}, c.id, ${sqlValue(b.code)}, ${sqlValue(b.nameEn)}, ${sqlValue(b.nameAr)}, ${sqlValue(b.location)}, ${sqlValue(b.active !== false)} from public.companies c where c.code = ${sqlValue(payload.company.code)} on conflict (id) do update set code = excluded.code, name_en = excluded.name_en, name_ar = excluded.name_ar, location = excluded.location, active = excluded.active;`));
  payload.stores.forEach((s: any) => lines.push(`insert into public.stores (id, company_id, branch_id, code, name_en, name_ar, store_type, active) select ${sqlValue(s.id)}, c.id, ${s.branchId === 'main' || s.branchId === 'company' ? 'null' : sqlValue(s.branchId)}, ${sqlValue(s.code)}, ${sqlValue(s.nameEn)}, ${sqlValue(s.nameAr)}, ${sqlValue(s.type)}, ${sqlValue(s.active !== false)} from public.companies c where c.code = ${sqlValue(payload.company.code)} on conflict (id) do update set code = excluded.code, branch_id = excluded.branch_id, name_en = excluded.name_en, name_ar = excluded.name_ar, store_type = excluded.store_type, active = excluded.active;`));
  payload.items.forEach((i: any) => lines.push(`insert into public.items (id, company_id, sku, name_en, name_ar, category, purchase_unit, consumption_unit, conversion_factor, standard_cost, active) select ${sqlValue(i.id)}, c.id, ${sqlValue(i.sku)}, ${sqlValue(i.nameEn)}, ${sqlValue(i.nameAr)}, ${sqlValue(i.category)}, ${sqlValue(i.purchaseUnit)}, ${sqlValue(i.consumptionUnit)}, ${sqlValue(i.conversionFactor || 1)}, ${sqlValue(i.standardCost || 0)}, ${sqlValue(i.active !== false)} from public.companies c where c.code = ${sqlValue(payload.company.code)} on conflict (id) do update set sku = excluded.sku, name_en = excluded.name_en, name_ar = excluded.name_ar, category = excluded.category, purchase_unit = excluded.purchase_unit, consumption_unit = excluded.consumption_unit, conversion_factor = excluded.conversion_factor, standard_cost = excluded.standard_cost, active = excluded.active;`));
  payload.suppliers.forEach((s: any) => lines.push(`insert into public.suppliers (id, company_id, code, name, vat_no, payment_terms, contact_name, phone, email, bank_name, bank_account, representative_name, representative_phone, active) select ${sqlValue(s.id)}, c.id, ${sqlValue(s.code)}, ${sqlValue(s.name)}, ${sqlValue(s.vatNo)}, ${sqlValue(s.paymentTerms)}, ${sqlValue(s.contactName)}, ${sqlValue(s.phone)}, ${sqlValue(s.email)}, ${sqlValue(s.bankName)}, ${sqlValue(s.bankAccount)}, ${sqlValue(s.representativeName)}, ${sqlValue(s.representativePhone)}, ${sqlValue(s.active !== false)} from public.companies c where c.code = ${sqlValue(payload.company.code)} on conflict (id) do update set code = excluded.code, name = excluded.name, vat_no = excluded.vat_no, payment_terms = excluded.payment_terms, contact_name = excluded.contact_name, phone = excluded.phone, email = excluded.email, bank_name = excluded.bank_name, bank_account = excluded.bank_account, representative_name = excluded.representative_name, representative_phone = excluded.representative_phone, active = excluded.active;`));
  payload.cost_centers.forEach((cc: any) => lines.push(`insert into public.cost_centers (id, company_id, branch_id, code, name_en, name_ar, budget, active) select ${sqlValue(cc.id)}, c.id, ${cc.branchId === 'company' ? 'null' : sqlValue(cc.branchId)}, ${sqlValue(cc.code)}, ${sqlValue(cc.nameEn)}, ${sqlValue(cc.nameAr)}, ${sqlValue(cc.budget || 0)}, ${sqlValue(cc.active !== false)} from public.companies c where c.code = ${sqlValue(payload.company.code)} on conflict (id) do update set code = excluded.code, branch_id = excluded.branch_id, name_en = excluded.name_en, name_ar = excluded.name_ar, budget = excluded.budget, active = excluded.active;`));
  payload.employees.forEach((e: any) => lines.push(`insert into public.employees (id, company_id, code, name, branch_id, department, job_title, salary, active) select ${sqlValue(e.id)}, c.id, ${sqlValue(e.code)}, ${sqlValue(e.name)}, ${e.branchId === 'company' ? 'null' : sqlValue(e.branchId)}, ${sqlValue(e.department)}, ${sqlValue(e.jobTitle)}, ${sqlValue(e.salary || 0)}, ${sqlValue(e.active !== false)} from public.companies c where c.code = ${sqlValue(payload.company.code)} on conflict (id) do update set code = excluded.code, name = excluded.name, branch_id = excluded.branch_id, department = excluded.department, job_title = excluded.job_title, salary = excluded.salary, active = excluded.active;`));
  payload.user_accounts.forEach((u: any) => lines.push(`insert into public.user_accounts (id, company_id, employee_id, email, display_name, status, auth_provider, must_change_password, active) select ${sqlValue(u.id)}, c.id, ${sqlValue(u.employeeId)}, ${sqlValue(u.email)}, ${sqlValue(u.displayName)}, ${sqlValue(u.status || 'active')}, ${sqlValue(u.authProvider || 'local')}, ${sqlValue(Boolean(u.mustChangePassword))}, ${sqlValue(u.active !== false)} from public.companies c where c.code = ${sqlValue(payload.company.code)} on conflict (id) do update set employee_id = excluded.employee_id, email = excluded.email, display_name = excluded.display_name, status = excluded.status, auth_provider = excluded.auth_provider, must_change_password = excluded.must_change_password, active = excluded.active;`));
  payload.chart_accounts.forEach((a: any) => lines.push(`insert into public.chart_accounts (id, company_id, code, name_en, name_ar, account_type, parent_code, active, require_cost_center) select ${sqlValue(a.id)}, c.id, ${sqlValue(a.code)}, ${sqlValue(a.nameEn)}, ${sqlValue(a.nameAr)}, ${sqlValue(a.type)}, ${sqlValue(a.parentCode)}, ${sqlValue(a.active !== false)}, ${sqlValue(Boolean(a.requireCostCenter))} from public.companies c where c.code = ${sqlValue(payload.company.code)} on conflict (id) do update set code = excluded.code, name_en = excluded.name_en, name_ar = excluded.name_ar, account_type = excluded.account_type, parent_code = excluded.parent_code, active = excluded.active, require_cost_center = excluded.require_cost_center;`));
  lines.push('commit;');
  return lines.join('\n');
}

export async function callSetupSync(payload: SetupPayload, dryRun = true) {
  const config = getSupabaseConfig();
  if (!config.configured) {
    return {
      ok: true,
      mode: 'local-dry-run',
      message: 'Supabase env is not configured. Local dry-run completed; no remote data was changed.',
      counts: Object.fromEntries(Object.entries(payload).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, (v as any[]).length])),
    };
  }
  const endpoint = `${config.url.replace(/\/$/, '')}/functions/v1/setup-sync-v301`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: config.anonKey,
      authorization: `Bearer ${config.anonKey}`,
    },
    body: JSON.stringify({ dryRun, payload }),
  });
  const data = await response.json().catch(() => ({ message: response.statusText }));
  if (!response.ok) throw new Error(data?.error || data?.message || `Setup sync failed with HTTP ${response.status}`);
  return data;
}

export async function pingBackend() {
  const config = getSupabaseConfig();
  if (!config.configured) return { ok: false, mode: config.mode, message: 'Supabase URL/anon key not configured yet.' };
  const endpoint = `${config.url.replace(/\/$/, '')}/functions/v1/backend-health-v301`;
  const response = await fetch(endpoint, { headers: { apikey: config.anonKey, authorization: `Bearer ${config.anonKey}` } });
  const data = await response.json().catch(() => ({ message: response.statusText }));
  return { ok: response.ok, mode: config.mode, status: response.status, ...data };
}
