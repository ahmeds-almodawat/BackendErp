import { buildSetupPayload, buildBackendReadinessScore, validateSetupForBackend, getSupabaseConfig } from '../services/supabaseCutoverBridge';

export function rowsToCsv(rows: Array<Record<string, any>>) {
  if (!rows.length) return '';
  const headers = Array.from(rows.reduce<Set<string>>((set, row) => { Object.keys(row || {}).forEach((k) => set.add(k)); return set; }, new Set<string>()));
  const esc = (value: unknown) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(','), ...rows.map((row) => headers.map((h) => esc(row[h])).join(','))].join('\n');
}

export function buildV301Snapshot(state: any, totals: any = {}) {
  const config = getSupabaseConfig();
  const validationRows = validateSetupForBackend(state);
  const critical = validationRows.filter((r) => r.severity === 'critical');
  const warnings = validationRows.filter((r) => r.severity === 'warning');
  const payload = buildSetupPayload(state);
  const backendScore = buildBackendReadinessScore(validationRows, config.configured);
  const counts = {
    branches: payload.branches.length,
    stores: payload.stores.length,
    suppliers: payload.suppliers.length,
    items: payload.items.length,
    costCenters: payload.cost_centers.length,
    accounts: payload.chart_accounts.length,
    employees: payload.employees.length,
    userAccounts: payload.user_accounts.length,
    roles: payload.roles.length,
    permissions: payload.permissions.length,
  };
  const scores = {
    localMvp: 99,
    erpFoundation: Math.max(0, Math.min(98, 97 - critical.length * 3 - warnings.length)),
    enterpriseDirection: 99,
    productionReadiness: Math.max(0, Math.min(92, 91 - critical.length * 3 - warnings.length)),
    backendSecurity: backendScore,
  };
  return {
    version: 'v301 Supabase Cutover Foundation',
    config,
    counts,
    totals,
    validationRows,
    critical,
    warnings,
    payload,
    scores,
    nextSteps: [
      { step: 1, title: 'Configure Supabase env', detail: 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.', status: config.configured ? 'ready' : 'pending' },
      { step: 2, title: 'Run migrations', detail: 'supabase db reset locally or supabase db push remotely after reviewing SQL.', status: 'manual' },
      { step: 3, title: 'Validate setup data', detail: 'Resolve critical duplicate/orphan errors before sync.', status: critical.length ? 'blocked' : 'ready' },
      { step: 4, title: 'Dry-run setup sync', detail: 'Use Backend Cutover → Sync tab to dry-run payload.', status: 'ready' },
      { step: 5, title: 'Pilot setup persistence', detail: 'Enable actual setup-sync once RLS and Auth are verified.', status: 'manual' },
    ],
  };
}

export function buildV301CutoverPlan(snapshot: any) {
  return [
    { phase: 'A', area: 'Environment', control: 'Supabase variables configured', status: snapshot.config.configured ? 'ready' : 'pending', action: 'Create .env.local from .env.example and add project URL/anon key.' },
    { phase: 'B', area: 'Schema', control: 'v301 setup persistence tables', status: 'manual', action: 'Apply supabase/migrations/20260502301000_v301_setup_persistence.sql.' },
    { phase: 'C', area: 'RLS', control: 'Company isolation policies', status: 'manual', action: 'Smoke test owner/admin user before pilot.' },
    { phase: 'D', area: 'Setup Sync', control: 'Dry-run payload', status: snapshot.critical.length ? 'blocked' : 'ready', action: 'Resolve validation blockers, then run dry-run.' },
    { phase: 'E', area: 'Cutover', control: 'Pilot write mode', status: 'not started', action: 'After dry-run succeeds, enable real setup-sync Edge Function write mode.' },
  ];
}

export function buildV301QaSuite(snapshot: any) {
  return [
    { id: 'V301-QA-001', test: 'App boots in local mode', expected: 'No Supabase env required for local testing', status: 'manual' },
    { id: 'V301-QA-002', test: 'Setup validation', expected: 'Critical duplicate/orphan setup errors are visible', status: snapshot.validationRows.length ? 'ready' : 'needs data' },
    { id: 'V301-QA-003', test: 'Export setup JSON', expected: 'Download includes branches, stores, suppliers, items, accounts and roles', status: 'manual' },
    { id: 'V301-QA-004', test: 'Generate SQL seed', expected: 'SQL seed is generated for review only', status: 'manual' },
    { id: 'V301-QA-005', test: 'Local dry-run', expected: 'Works even without Supabase env', status: 'manual' },
    { id: 'V301-QA-006', test: 'Backend ping', expected: 'Shows safe not-configured message or Edge Function health result', status: snapshot.config.configured ? 'manual' : 'not configured' },
    { id: 'V301-QA-007', test: 'No production claim', expected: 'Scores remain honest until live Auth/RLS/posting is tested', status: 'pass-check' },
  ];
}
