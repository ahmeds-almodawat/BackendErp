export type Row = Record<string, string | number>;
function arr<T>(value: T[] | undefined): T[] { return Array.isArray(value) ? value : []; }
export function scoreRows() {
  return [
    { view: 'Local MVP / prototype', score: '9.4 / 10', note: 'Stable and strong for local workflow testing.' },
    { view: 'Serious ERP foundation', score: '8.9 / 10', note: 'Master data and backend sync bridge increase the real ERP foundation.' },
    { view: 'Enterprise design direction', score: '9.2 / 10', note: 'Auth/setup persistence is the correct next production step.' },
    { view: 'Production readiness', score: '6.8 / 10', note: 'Improved by setup persistence wiring, still not full production until real Supabase write/read is enabled.' },
    { view: 'Backend/security readiness', score: '7.4 / 10', note: 'Backend bridge, migrations, RLS policies and sync contracts are now stronger.' },
  ];
}
export function setupCounts(state: any) {
  return [
    { entity: 'Branches', count: arr(state?.branches).length, target: 'Supabase branches table', priority: 'Critical' },
    { entity: 'Stores', count: arr(state?.stores).length, target: 'Supabase stores table', priority: 'Critical' },
    { entity: 'Suppliers', count: arr(state?.suppliers).length, target: 'Supabase suppliers table', priority: 'High' },
    { entity: 'Items / SKUs', count: arr(state?.items).length, target: 'Supabase items table', priority: 'Critical' },
    { entity: 'Cost Centers', count: arr(state?.costCenters).length, target: 'Supabase cost_centers table', priority: 'High' },
    { entity: 'Chart of Accounts', count: arr(state?.chartAccounts).length, target: 'Supabase chart_accounts table', priority: 'Critical' },
    { entity: 'Roles', count: arr(state?.roles).length, target: 'Supabase roles + permissions', priority: 'Critical' },
  ];
}
export function persistencePlan(): Row[] {
  return [
    { step: 1, stream: 'Auth bootstrap', action: 'Create first company/admin profile and keep Local Admin fallback for trial mode.', status: 'Scaffolded' },
    { step: 2, stream: 'Setup sync', action: 'Push branches, stores, suppliers, items, COA and cost centers to Supabase staging.', status: 'Added in v181' },
    { step: 3, stream: 'Data validation', action: 'Run duplicate/orphan/compliance checks before any backend write.', status: 'Added in v181' },
    { step: 4, stream: 'Read fallback', action: 'If Supabase is not configured, continue using localStorage safely.', status: 'Added in v181' },
    { step: 5, stream: 'RLS pilot', action: 'Restrict company data and test scoped branch/store access.', status: 'Backend-ready' },
    { step: 6, stream: 'Cutover', action: 'Freeze local setup edits, sync master data, verify counts, then enable Supabase mode for pilot branch.', status: 'Next' },
  ];
}
export function authControls(): Row[] {
  return [
    { control: 'First admin bootstrap', purpose: 'Prevent locked-out system on first Supabase run', status: 'Designed' },
    { control: 'Company isolation', purpose: 'Every row belongs to company_id', status: 'Migration-ready' },
    { control: 'Role assignment', purpose: 'Admin can assign custom roles/scopes', status: 'Schema-ready' },
    { control: 'Local fallback', purpose: 'Continue trial if Supabase is offline', status: 'v181 ready' },
    { control: 'Denied action log', purpose: 'Record unauthorized attempts after production wiring', status: 'Scaffolded' },
  ];
}
export function rowsToCsv(rows: Row[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = (value: unknown) => /[",\n]/.test(String(value ?? '')) ? `"${String(value ?? '').replace(/"/g, '""')}"` : String(value ?? '');
  return [headers.join(','), ...rows.map((row) => headers.map((h) => esc(row[h])).join(','))].join('\n');
}
export function downloadCsv(fileName: string, rows: Row[]) {
  const blob = new Blob([rowsToCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
