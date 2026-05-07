export type V384AuthorityStatus = 'backend-authoritative' | 'worker-backed' | 'staging-foundation' | 'local-risk' | 'blocked';
export type V384GateStatus = 'local-watch' | 'staging-blocked' | 'staging-ready' | 'production-blocked' | 'production-ready';
export type V384Risk = 'low' | 'medium' | 'high' | 'critical';

export interface V384AuthorityDefinition {
  key: string;
  module: string;
  workflow: string;
  currentAuthority: string;
  targetAuthority: string;
  requiredBackendObject: string;
  requiredGate: string;
  risk: V384Risk;
  productionBlocking: boolean;
}

export interface V384AuthorityRow extends V384AuthorityDefinition {
  status: V384AuthorityStatus;
  evidence: string;
  action: string;
}

export interface V384LocalRiskRow {
  key: string;
  label: string;
  risk: V384Risk;
  evidence: string;
  action: string;
}

export interface V384BackendObjectStatus {
  objectName: string;
  objectType: 'table' | 'rpc' | 'edge-function' | 'worker' | 'page' | 'config';
  status: V384AuthorityStatus;
  evidence: string;
}

export interface V384AuthoritySnapshot {
  version: string;
  generatedAt: string;
  gateStatus: V384GateStatus;
  gateScore: number;
  counts: {
    workflows: number;
    backendAuthoritative: number;
    workerBacked: number;
    stagingFoundation: number;
    localRisk: number;
    blocked: number;
    productionBlockers: number;
  };
  authorityRows: V384AuthorityRow[];
  backendObjects: V384BackendObjectStatus[];
  localRisks: V384LocalRiskRow[];
  nextAction: string;
}

export const V384_AUTHORITY_DEFINITIONS: V384AuthorityDefinition[] = [
  {
    key: 'setup.master-data',
    module: 'setup',
    workflow: 'Branches, stores, suppliers, items, categories, chart accounts',
    currentAuthority: 'Local state with Supabase setup persistence foundation',
    targetAuthority: 'Supabase tables with scoped writes and audit',
    requiredBackendObject: 'branches, stores, suppliers, items, chart_accounts, setup_sync_batches',
    requiredGate: 'Explicit RLS + settings.manage/setup.manage permission',
    risk: 'high',
    productionBlocking: true,
  },
  {
    key: 'access.users-rbac',
    module: 'access',
    workflow: 'Users, roles, permissions, branch/store scope',
    currentAuthority: 'Local user/access tables with RBAC evidence gate',
    targetAuthority: 'Supabase Auth + app_roles/app_permissions/app_user_roles + scope assignments',
    requiredBackendObject: 'app_permissions, app_roles, app_user_roles, branch_user_assignments, rbac_gate_snapshots',
    requiredGate: 'v383 RBAC production hardening + server-side role management RPC',
    risk: 'critical',
    productionBlocking: true,
  },
  {
    key: 'finance.posting',
    module: 'finance',
    workflow: 'Manual journals, invoices, payments, reversals, period locks',
    currentAuthority: 'Posting contracts exist; production posting functions still need final authority proof',
    targetAuthority: 'Database transaction RPCs with locks, immutable posted records, reversals only',
    requiredBackendObject: 'posting_batches, posting_batch_lines, finance_journal_entries_backend, worker_finance_reconciliation_*',
    requiredGate: 'Balanced posting + immutable records + permission check + period lock check',
    risk: 'critical',
    productionBlocking: true,
  },
  {
    key: 'inventory.ledger',
    module: 'inventory',
    workflow: 'Stock movements, balances, counts, adjustments, valuation rebuild',
    currentAuthority: 'Local movement model plus v376 rebuild worker evidence',
    targetAuthority: 'Inventory movement ledger + costing snapshots + worker rebuild results',
    requiredBackendObject: 'inventory_stock_movements, inventory_stock_balances, inventory_rebuild_runs, inventory_rebuild_balances',
    requiredGate: 'Movement ledger source exists and rebuild reconciles with GL',
    risk: 'critical',
    productionBlocking: true,
  },
  {
    key: 'pos.replay',
    module: 'sales',
    workflow: 'Foodics/POS import, replay, duplicate prevention, settlement handoff',
    currentAuthority: 'v377 POS replay worker foundation, final posting not connected',
    targetAuthority: 'POS staging -> replay -> settlement -> finance/inventory posting',
    requiredBackendObject: 'pos_replay_runs, pos_replay_applied_rows, foodics_staging_rows, sales_pos_batches',
    requiredGate: 'Idempotent replay + payment/VAT/COGS posting authority',
    risk: 'critical',
    productionBlocking: true,
  },
  {
    key: 'imports.cutover',
    module: 'imports',
    workflow: 'CSV/Excel import staging, validation, approval, cutover, rollback evidence',
    currentAuthority: 'v378 cutover worker evidence layer',
    targetAuthority: 'Validated staging rows with approval and idempotent cutover to target tables',
    requiredBackendObject: 'import_staging_rows, import_cutover_runs, import_cutover_applied_rows',
    requiredGate: 'Approved import only + row-level validation + duplicate hash + rollback package',
    risk: 'high',
    productionBlocking: true,
  },
  {
    key: 'reports.snapshots',
    module: 'reports',
    workflow: 'Dashboard KPIs, report packs, Smart Analysis, management reports',
    currentAuthority: 'v379 report snapshot worker foundation',
    targetAuthority: 'Report snapshots generated from posted/backend truth only',
    requiredBackendObject: 'report_snapshot_runs, report_snapshot_sources, report_snapshot_artifacts',
    requiredGate: 'Truth score blocks reports when source data is incomplete/untrusted',
    risk: 'high',
    productionBlocking: true,
  },
  {
    key: 'backup.restore',
    module: 'administration',
    workflow: 'Backup ZIP, restore ZIP, archive evidence, restore proof',
    currentAuthority: 'v381 local platform backup ZIP + backend evidence tables',
    targetAuthority: 'Database/storage backup plan with restore drill proof',
    requiredBackendObject: 'backup_archive_runs, backup_restore_runs, backup_archive_artifacts',
    requiredGate: 'Restore drill on staging before production cutover',
    risk: 'high',
    productionBlocking: true,
  },
  {
    key: 'backend.mode',
    module: 'administration',
    workflow: 'Local/staging/production gate, Supabase configuration, service-key exposure checks',
    currentAuthority: 'v382 backend mode gate',
    targetAuthority: 'Production cannot run without Supabase, auth, branch scope, and no demo data',
    requiredBackendObject: 'productionConfig, providerSelector, backend_mode_gate_snapshots',
    requiredGate: 'VITE_RUNTIME_MODE=production hard blocks unsafe fallback',
    risk: 'critical',
    productionBlocking: true,
  },
];

export const V384_BACKEND_OBJECTS: V384BackendObjectStatus[] = [
  { objectName: 'worker_enqueue_job / worker_acquire_job', objectType: 'rpc', status: 'worker-backed', evidence: 'v375 worker lease runtime is present.' },
  { objectName: 'worker_enqueue_inventory_rebuild', objectType: 'rpc', status: 'worker-backed', evidence: 'v376 inventory rebuild worker is present.' },
  { objectName: 'worker_enqueue_pos_replay', objectType: 'rpc', status: 'worker-backed', evidence: 'v377 POS replay worker is present.' },
  { objectName: 'worker_enqueue_import_cutover', objectType: 'rpc', status: 'worker-backed', evidence: 'v378 import cutover worker is present.' },
  { objectName: 'worker_enqueue_report_snapshot', objectType: 'rpc', status: 'worker-backed', evidence: 'v379 report snapshot worker is present.' },
  { objectName: 'worker_enqueue_finance_reconciliation', objectType: 'rpc', status: 'worker-backed', evidence: 'v380 finance reconciliation worker is evidence-only.' },
  { objectName: 'platform backup ZIP', objectType: 'page', status: 'staging-foundation', evidence: 'v381 Backup / Restore page supports local platform backup/restore.' },
  { objectName: 'Backend Mode gate', objectType: 'page', status: 'staging-foundation', evidence: 'v382 backend mode cutover gate is present.' },
  { objectName: 'RBAC Gate', objectType: 'page', status: 'staging-foundation', evidence: 'v383 RBAC production hardening gate is present.' },
  { objectName: 'finance-posting Edge Function', objectType: 'edge-function', status: 'blocked', evidence: 'Must not be considered production authority until skeleton/dry-run markers are removed and real transaction logic exists.' },
  { objectName: 'inventory-posting Edge Function', objectType: 'edge-function', status: 'blocked', evidence: 'Must not be considered production authority until ledger/costing validation is implemented.' },
  { objectName: 'foodics-post Edge Function', objectType: 'edge-function', status: 'blocked', evidence: 'POS replay exists, but final settlement/posting is not production authority yet.' },
];

function countRows<T>(rows: T[] | undefined): number {
  return Array.isArray(rows) ? rows.length : 0;
}

function hasAnyRows(state: any, keys: string[]): boolean {
  return keys.some((key) => countRows(state?.[key]) > 0);
}

function statusForDefinition(definition: V384AuthorityDefinition, state: any): V384AuthorityStatus {
  if (definition.key === 'backend.mode') return 'staging-foundation';
  if (definition.key === 'access.users-rbac') {
    const hasRoles = hasAnyRows(state, ['roles', 'userAccess', 'userAccounts']);
    return hasRoles ? 'staging-foundation' : 'local-risk';
  }
  if (definition.key === 'finance.posting') return 'blocked';
  if (definition.key === 'inventory.ledger') return 'worker-backed';
  if (definition.key === 'pos.replay') return 'worker-backed';
  if (definition.key === 'imports.cutover') return 'worker-backed';
  if (definition.key === 'reports.snapshots') return 'worker-backed';
  if (definition.key === 'backup.restore') return 'staging-foundation';
  if (definition.key === 'setup.master-data') return hasAnyRows(state, ['branches', 'stores', 'suppliers', 'items', 'chartAccounts']) ? 'local-risk' : 'staging-foundation';
  return 'local-risk';
}

function actionForStatus(status: V384AuthorityStatus, definition: V384AuthorityDefinition): string {
  if (status === 'backend-authoritative') return 'Keep covered by integration, RLS, and restore tests.';
  if (status === 'worker-backed') return `Connect ${definition.module} UI actions to backend worker/RPC APIs and prove source-to-report reconciliation.`;
  if (status === 'staging-foundation') return `Promote to backend authority only after ${definition.requiredGate}.`;
  if (status === 'blocked') return `Do not use in production. Implement ${definition.requiredGate}.`;
  return `Replace local mutations with backend-owned flows for ${definition.workflow}.`;
}

export function buildV384AuthorityRows(state: any): V384AuthorityRow[] {
  return V384_AUTHORITY_DEFINITIONS.map((definition) => {
    const status = statusForDefinition(definition, state);
    return {
      ...definition,
      status,
      evidence: `${definition.currentAuthority}. Required backend object: ${definition.requiredBackendObject}.`,
      action: actionForStatus(status, definition),
    };
  });
}

export function buildV384LocalRisks(state: any): V384LocalRiskRow[] {
  const risks: V384LocalRiskRow[] = [];
  const localDataRows = [
    ['branches', countRows(state?.branches)],
    ['stores', countRows(state?.stores)],
    ['suppliers', countRows(state?.suppliers)],
    ['items', countRows(state?.items)],
    ['journalEntries', countRows(state?.journalEntries)],
    ['stockMovements', countRows(state?.stockMovements)],
    ['purchaseInvoices', countRows(state?.purchaseInvoices)],
    ['sales', countRows(state?.sales)],
  ].filter(([, count]) => Number(count) > 0);

  if (localDataRows.length) {
    risks.push({
      key: 'local-state-business-data',
      label: 'Business data still exists in local browser state',
      risk: 'critical',
      evidence: localDataRows.map(([key, count]) => `${key}: ${count}`).join(', '),
      action: 'Before production, migrate these flows to Supabase tables/RPCs and keep local state demo-only.',
    });
  }

  if (countRows(state?.journalEntries) > 0) {
    risks.push({
      key: 'local-journal-authority',
      label: 'Journal entries can still exist locally',
      risk: 'critical',
      evidence: `${countRows(state?.journalEntries)} local journal entr${countRows(state?.journalEntries) === 1 ? 'y' : 'ies'} detected.`,
      action: 'Production finance must use server-side posting batches and reversal-only correction.',
    });
  }

  if (countRows(state?.stockMovements) > 0) {
    risks.push({
      key: 'local-inventory-authority',
      label: 'Inventory movements can still exist locally',
      risk: 'critical',
      evidence: `${countRows(state?.stockMovements)} local stock movement rows detected.`,
      action: 'Production inventory must use movement ledger RPCs and rebuild worker evidence.',
    });
  }

  if (countRows(state?.audits) === 0) {
    risks.push({
      key: 'audit-evidence-low',
      label: 'No local audit evidence detected',
      risk: 'high',
      evidence: 'The local demo state has no audit events, or audit state is empty.',
      action: 'Every backend write path must create immutable audit evidence.',
    });
  }

  return risks;
}

function gateStatus(rows: V384AuthorityRow[], localRisks: V384LocalRiskRow[]): V384GateStatus {
  const criticalBlockers = rows.filter((row) => row.productionBlocking && (row.status === 'blocked' || row.status === 'local-risk')).length;
  const criticalLocalRisks = localRisks.filter((risk) => risk.risk === 'critical').length;
  if (criticalBlockers || criticalLocalRisks) return 'production-blocked';
  const workerRows = rows.filter((row) => row.status === 'worker-backed' || row.status === 'staging-foundation').length;
  return workerRows ? 'staging-ready' : 'local-watch';
}

function score(rows: V384AuthorityRow[], localRisks: V384LocalRiskRow[]): number {
  const points = rows.reduce((total, row) => {
    if (row.status === 'backend-authoritative') return total + 12;
    if (row.status === 'worker-backed') return total + 8;
    if (row.status === 'staging-foundation') return total + 5;
    if (row.status === 'local-risk') return total - (row.risk === 'critical' ? 14 : 8);
    return total - 18;
  }, 35);
  const riskPenalty = localRisks.reduce((total, risk) => total + (risk.risk === 'critical' ? 15 : risk.risk === 'high' ? 9 : 4), 0);
  return Math.max(0, Math.min(100, Math.round(points - riskPenalty)));
}

export function buildV384AuthoritySnapshot(state: any = {}): V384AuthoritySnapshot {
  const authorityRows = buildV384AuthorityRows(state);
  const localRisks = buildV384LocalRisks(state);
  const status = gateStatus(authorityRows, localRisks);
  const counts = {
    workflows: authorityRows.length,
    backendAuthoritative: authorityRows.filter((row) => row.status === 'backend-authoritative').length,
    workerBacked: authorityRows.filter((row) => row.status === 'worker-backed').length,
    stagingFoundation: authorityRows.filter((row) => row.status === 'staging-foundation').length,
    localRisk: authorityRows.filter((row) => row.status === 'local-risk').length,
    blocked: authorityRows.filter((row) => row.status === 'blocked').length,
    productionBlockers: authorityRows.filter((row) => row.productionBlocking && (row.status === 'blocked' || row.status === 'local-risk')).length + localRisks.filter((risk) => risk.risk === 'critical').length,
  };

  return {
    version: 'v384 Backend Source of Truth Gate',
    generatedAt: new Date().toISOString(),
    gateStatus: status,
    gateScore: score(authorityRows, localRisks),
    counts,
    authorityRows,
    backendObjects: V384_BACKEND_OBJECTS,
    localRisks,
    nextAction: status === 'production-ready'
      ? 'Keep production authority covered by RLS, worker, restore, and audit tests.'
      : 'Keep production blocked until finance/inventory/POS/import writes are backend-authoritative and local state is demo-only.',
  };
}

export function v384RowsToCsv(rows: Array<Record<string, unknown>>): string {
  const headers = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n');
}
