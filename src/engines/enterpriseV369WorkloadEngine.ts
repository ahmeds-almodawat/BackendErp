import { productionConfig } from '../lib/config/productionConfig';
import { getSupabaseConfig } from '../services/supabaseCutoverBridge';

export type V369Status = 'ready' | 'watch' | 'limit' | 'blocked';
export type V369Tone = 'ready' | 'warn' | 'bad' | 'info';
export type V369LaneKey = 'interactive' | 'background' | 'scheduled' | 'archive';

export interface V369DatasetLoad {
  dataset: string;
  rows: number;
  midRangeBudget: number;
  heavyWorkBudget: number;
  usagePct: number;
  status: V369Status;
  lane: V369LaneKey;
  recommendedBatchSize: number;
  action: string;
}

export interface V369JobLane {
  lane: V369LaneKey;
  title: string;
  status: V369Status;
  concurrency: number;
  maxBatchRows: number;
  maxRuntimeSeconds: number;
  throttle: string;
  useFor: string;
}

export interface V369HeavyJob {
  id: string;
  module: string;
  job: string;
  lane: V369LaneKey;
  status: V369Status;
  priority: 'P0' | 'P1' | 'P2';
  estimatedRows: number;
  batchSize: number;
  batches: number;
  trigger: string;
  guardrail: string;
  output: string;
}

export interface V369Guardrail {
  area: string;
  status: V369Status;
  signal: string;
  action: string;
}

export interface V369RunbookStep {
  step: string;
  owner: string;
  cadence: string;
  evidence: string;
  doneWhen: string;
}

export interface V369WorkloadSnapshot {
  version: string;
  posture: string;
  generatedAt: string;
  runtime: {
    mode: string;
    supabaseConfigured: boolean;
    browserStateBytes: number;
  };
  counts: {
    totalRows: number;
    readyDatasets: number;
    watchDatasets: number;
    limitDatasets: number;
    blockedGuardrails: number;
    heavyJobs: number;
  };
  scores: {
    platformScore: number;
    capacityScore: number;
    batchSafetyScore: number;
    dataReadinessScore: number;
  };
  datasets: V369DatasetLoad[];
  lanes: V369JobLane[];
  jobs: V369HeavyJob[];
  guardrails: V369Guardrail[];
  runbook: V369RunbookStep[];
}

type DatasetSpec = {
  key: string;
  label: string;
  midRangeBudget: number;
  heavyWorkBudget: number;
};

const datasetSpecs: DatasetSpec[] = [
  { key: 'branches', label: 'Branches', midRangeBudget: 50, heavyWorkBudget: 250 },
  { key: 'stores', label: 'Stores', midRangeBudget: 200, heavyWorkBudget: 1000 },
  { key: 'suppliers', label: 'Suppliers', midRangeBudget: 5000, heavyWorkBudget: 25000 },
  { key: 'items', label: 'Items / SKUs', midRangeBudget: 25000, heavyWorkBudget: 150000 },
  { key: 'menuItems', label: 'Menu items', midRangeBudget: 12000, heavyWorkBudget: 60000 },
  { key: 'recipeLines', label: 'Recipe lines', midRangeBudget: 100000, heavyWorkBudget: 500000 },
  { key: 'stockMovements', label: 'Stock ledger movements', midRangeBudget: 500000, heavyWorkBudget: 2500000 },
  { key: 'inventoryLots', label: 'Inventory lots', midRangeBudget: 350000, heavyWorkBudget: 1750000 },
  { key: 'purchaseInvoices', label: 'Purchase invoices', midRangeBudget: 120000, heavyWorkBudget: 600000 },
  { key: 'sales', label: 'Sales / POS rows', midRangeBudget: 1000000, heavyWorkBudget: 5000000 },
  { key: 'journals', label: 'Journal entries', midRangeBudget: 250000, heavyWorkBudget: 1000000 },
  { key: 'audits', label: 'Audit log rows', midRangeBudget: 750000, heavyWorkBudget: 4000000 },
  { key: 'employees', label: 'Employees', midRangeBudget: 5000, heavyWorkBudget: 25000 },
  { key: 'bankReconLines', label: 'Bank reconciliation lines', midRangeBudget: 200000, heavyWorkBudget: 1000000 },
];

function arr<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function stateSizeBytes(state: any) {
  try {
    return new Blob([JSON.stringify(state ?? {})]).size;
  } catch {
    try {
      return JSON.stringify(state ?? {}).length;
    } catch {
      return 0;
    }
  }
}

function statusForRows(rows: number, midRangeBudget: number, heavyWorkBudget: number): V369Status {
  if (rows <= midRangeBudget) return 'ready';
  if (rows <= heavyWorkBudget) return 'watch';
  return 'limit';
}

function laneForRows(rows: number, midRangeBudget: number): V369LaneKey {
  if (rows <= 2500) return 'interactive';
  if (rows <= midRangeBudget) return 'background';
  return 'scheduled';
}

function batchSizeForRows(rows: number, lane: V369LaneKey) {
  if (lane === 'interactive') return Math.max(100, Math.min(500, Math.max(rows, 1)));
  if (lane === 'background') return rows > 100000 ? 5000 : 2000;
  if (lane === 'scheduled') return rows > 1000000 ? 10000 : 5000;
  return 20000;
}

function datasetLoad(state: any, spec: DatasetSpec): V369DatasetLoad {
  const rows = arr((state ?? {})[spec.key]).length;
  const status = statusForRows(rows, spec.midRangeBudget, spec.heavyWorkBudget);
  const lane = laneForRows(rows, spec.midRangeBudget);
  return {
    dataset: spec.label,
    rows,
    midRangeBudget: spec.midRangeBudget,
    heavyWorkBudget: spec.heavyWorkBudget,
    usagePct: Math.round(rows / Math.max(spec.midRangeBudget, 1) * 100),
    status,
    lane,
    recommendedBatchSize: batchSizeForRows(rows, lane),
    action: status === 'ready'
      ? 'Keep direct screens fast; use background lane only for imports and recalculation.'
      : status === 'watch'
        ? 'Move bulk actions to chunked jobs and create progress checkpoints.'
        : 'Archive, snapshot, or move this workload to backend scheduled jobs before live use.',
  };
}

function journalBalance(journal: any) {
  const debit = arr(journal?.lines).reduce((sum, line: any) => sum + numberValue(line?.debit), 0);
  const credit = arr(journal?.lines).reduce((sum, line: any) => sum + numberValue(line?.credit), 0);
  return Math.abs(debit - credit);
}

function job(id: string, module: string, jobName: string, estimatedRows: number, trigger: string, output: string, priority: 'P0' | 'P1' | 'P2' = 'P1'): V369HeavyJob {
  const lane = laneForRows(estimatedRows, 100000);
  const batchSize = batchSizeForRows(estimatedRows, lane);
  const status = estimatedRows === 0 ? 'ready' : estimatedRows > 2500000 ? 'limit' : estimatedRows > 250000 ? 'watch' : 'ready';
  return {
    id,
    module,
    job: jobName,
    lane,
    status,
    priority,
    estimatedRows,
    batchSize,
    batches: Math.max(1, Math.ceil(estimatedRows / Math.max(batchSize, 1))),
    trigger,
    guardrail: lane === 'interactive' ? 'Must finish inside the user request.' : 'Must checkpoint progress and be resumable.',
    output,
  };
}

export function buildV369DatasetLoads(state: any): V369DatasetLoad[] {
  return datasetSpecs.map((spec) => datasetLoad(state, spec));
}

export function buildV369JobLanes(datasets: V369DatasetLoad[]): V369JobLane[] {
  const scheduledPressure = datasets.some((row) => row.lane === 'scheduled');
  const archivePressure = datasets.some((row) => row.status === 'limit' || row.dataset === 'Audit log rows' && row.usagePct > 75);
  return [
    {
      lane: 'interactive',
      title: 'Interactive lane',
      status: 'ready',
      concurrency: 1,
      maxBatchRows: 500,
      maxRuntimeSeconds: 2,
      throttle: 'Keep UI actions small and synchronous.',
      useFor: 'Single document posting, small edits, lookups, and operator confirmations.',
    },
    {
      lane: 'background',
      title: 'Background lane',
      status: 'ready',
      concurrency: 2,
      maxBatchRows: 5000,
      maxRuntimeSeconds: 45,
      throttle: 'Yield between chunks and write progress after each batch.',
      useFor: 'Bulk imports, inventory recalculation, report pre-aggregation, and duplicate checks.',
    },
    {
      lane: 'scheduled',
      title: 'Scheduled heavy lane',
      status: scheduledPressure ? 'watch' : 'ready',
      concurrency: 1,
      maxBatchRows: 10000,
      maxRuntimeSeconds: 180,
      throttle: 'Run outside cashier and receiving peak windows.',
      useFor: 'Large backfills, month-end report rebuilds, RLS sweeps, and posting replay.',
    },
    {
      lane: 'archive',
      title: 'Archive lane',
      status: archivePressure ? 'watch' : 'ready',
      concurrency: 1,
      maxBatchRows: 20000,
      maxRuntimeSeconds: 300,
      throttle: 'Export immutable evidence before pruning browser/local hot data.',
      useFor: 'Audit retention, old POS movement archive, stale import batch evidence, and backup rotation.',
    },
  ];
}

export function buildV369HeavyJobs(state: any): V369HeavyJob[] {
  const importRows = arr(state?.items).length + arr(state?.menuItems).length + arr(state?.recipeLines).length + arr(state?.suppliers).length + arr(state?.costCenters).length;
  const reportRows = arr(state?.sales).length + arr(state?.stockMovements).length + arr(state?.journals).length + arr(state?.purchaseInvoices).length;
  const financeRows = arr(state?.journals).length + arr(state?.purchaseInvoices).length + arr(state?.supplierPayments).length + arr(state?.arInvoices).length;
  return [
    job('V369-JOB-001', 'Imports', 'Master data cutover validation', importRows, 'Before go-live load or large menu refresh', 'Validated import manifest, duplicate report, and rollback checkpoint', 'P0'),
    job('V369-JOB-002', 'Inventory', 'Stock ledger recalculation', arr(state?.stockMovements).length + arr(state?.inventoryLots).length, 'After opening stock, monthly count, or supplier return burst', 'Rebuilt on-hand, average cost, lot, and bin balances', 'P0'),
    job('V369-JOB-003', 'Sales / POS', 'POS posting replay', arr(state?.sales).length, 'After Foodics import outage or late branch upload', 'Posted sales, payment totals, and recipe deduction evidence', 'P0'),
    job('V369-JOB-004', 'Reports', 'Management report snapshot rebuild', reportRows, 'Nightly or after historical backfill', 'Frozen report snapshot pack with source row counts', 'P1'),
    job('V369-JOB-005', 'Finance', 'Subledger and GL reconciliation sweep', financeRows, 'Before period lock and payment run', 'AP/AR/GL exception list and balanced posting summary', 'P0'),
    job('V369-JOB-006', 'Security', 'RLS and permission smoke sweep', arr(state?.roles).length * 50 + arr(state?.userAccounts).length * 25, 'After role update or new branch rollout', 'Permission denial/allow matrix by module and scope', 'P1'),
    job('V369-JOB-007', 'Audit', 'Audit archive and evidence export', arr(state?.audits).length, 'Weekly or before local storage reaches limit', 'Signed archive file and retained hot-window audit rows', 'P2'),
    job('V369-JOB-008', 'Backup', 'Chunked backup export', datasetSpecs.reduce((sum, spec) => sum + arr((state ?? {})[spec.key]).length, 0), 'Before migration, cleanup, or large import', 'Chunked JSON/CSV backup with row-count manifest', 'P0'),
  ];
}

export function buildV369Guardrails(state: any, datasets: V369DatasetLoad[], jobs: V369HeavyJob[]): V369Guardrail[] {
  const supabase = getSupabaseConfig();
  const browserBytes = stateSizeBytes(state);
  const unbalanced = arr(state?.journals).filter((journal: any) => journalBalance(journal) > 0.01).length;
  const pendingApprovals = arr(state?.inventoryApprovals).filter((row: any) => ['pending', 'approved'].includes(String(row?.status))).length;
  const directHeavyJobs = jobs.filter((row) => row.lane === 'interactive' && row.estimatedRows > 500).length;
  const overLimit = datasets.filter((row) => row.status === 'limit').length;
  return [
    {
      area: 'Platform posture',
      status: 'ready',
      signal: 'Mid-range platform target with heavy work routed to background/scheduled lanes.',
      action: 'Keep cashier, receiving, and finance posting interactive; move bulk recalculation into resumable jobs.',
    },
    {
      area: 'Backend readiness',
      status: supabase.configured ? 'ready' : productionConfig.runtimeMode === 'production' ? 'blocked' : 'watch',
      signal: supabase.configured ? 'Supabase configuration is present.' : 'Supabase configuration is not present in this local runtime.',
      action: supabase.configured ? 'Use backend jobs for scheduled lanes.' : 'Use local rehearsals only; configure Supabase before production heavy work.',
    },
    {
      area: 'Browser hot-state size',
      status: browserBytes > 20_000_000 ? 'limit' : browserBytes > 5_000_000 ? 'watch' : 'ready',
      signal: `${Math.round(browserBytes / 1024)} KB estimated serialized state.`,
      action: browserBytes > 5_000_000 ? 'Archive old audits/POS rows and prefer backend snapshots.' : 'Local hot state remains within a practical browser range.',
    },
    {
      area: 'Dataset budgets',
      status: overLimit ? 'limit' : datasets.some((row) => row.status === 'watch') ? 'watch' : 'ready',
      signal: `${overLimit} dataset(s) exceed heavy-work budget; ${datasets.filter((row) => row.status === 'watch').length} are above mid-range budget.`,
      action: overLimit ? 'Do not run those datasets as direct UI operations.' : 'Keep batch sizes and archive windows enforced.',
    },
    {
      area: 'Posting integrity',
      status: unbalanced ? 'blocked' : 'ready',
      signal: `${unbalanced} unbalanced journal(s).`,
      action: unbalanced ? 'Fix journals before bulk reporting or close jobs.' : 'Bulk finance reports can use posted journal inputs.',
    },
    {
      area: 'Approval backlog',
      status: pendingApprovals > 1000 ? 'limit' : pendingApprovals ? 'watch' : 'ready',
      signal: `${pendingApprovals} pending/approved inventory approvals.`,
      action: pendingApprovals ? 'Clear approvals before large stock recount or close jobs.' : 'No approval backlog pressure detected.',
    },
    {
      area: 'Interactive safety',
      status: directHeavyJobs ? 'watch' : 'ready',
      signal: `${directHeavyJobs} heavy job(s) mapped to interactive lane.`,
      action: directHeavyJobs ? 'Move any large direct job to background lane.' : 'Heavy work is not assigned to the direct user path.',
    },
  ];
}

export function buildV369Runbook(): V369RunbookStep[] {
  return [
    { step: 'Freeze scope', owner: 'Operations lead', cadence: 'Before each heavy run', evidence: 'Job manifest with row counts, lane, batch size, and rollback point', doneWhen: 'No job starts without a manifest.' },
    { step: 'Preflight data', owner: 'Module owner', cadence: 'Before import/backfill', evidence: 'Duplicate, missing reference, and posting-lock checks', doneWhen: 'Critical preflight rows are zero.' },
    { step: 'Run in chunks', owner: 'Platform operator', cadence: 'During heavy work', evidence: 'Batch log with started/finished rows and checkpoint cursor', doneWhen: 'Every batch is resumable and idempotent.' },
    { step: 'Protect peak hours', owner: 'Restaurant operations', cadence: 'Daily', evidence: 'Scheduled lane avoids cashier/receiving rush windows', doneWhen: 'Interactive screens remain responsive.' },
    { step: 'Reconcile outputs', owner: 'Finance/controller', cadence: 'After each heavy run', evidence: 'Control totals before/after, exception report, and report snapshot id', doneWhen: 'Totals reconcile or exceptions are assigned.' },
    { step: 'Archive evidence', owner: 'Admin', cadence: 'Weekly/month-end', evidence: 'Backup manifest and exported audit/report packs', doneWhen: 'Hot local data stays inside budget.' },
  ];
}

export function buildV369WorkloadSnapshot(state: any, totals: any = {}): V369WorkloadSnapshot {
  const datasets = buildV369DatasetLoads(state);
  const lanes = buildV369JobLanes(datasets);
  const jobs = buildV369HeavyJobs(state);
  const guardrails = buildV369Guardrails(state, datasets, jobs);
  const totalRows = datasets.reduce((sum, row) => sum + row.rows, 0);
  const capacityPenalty = datasets.reduce((sum, row) => sum + (row.status === 'limit' ? 16 : row.status === 'watch' ? 6 : 0), 0);
  const batchPenalty = jobs.reduce((sum, row) => sum + (row.status === 'limit' ? 12 : row.status === 'watch' ? 5 : 0), 0);
  const dataPenalty = guardrails.reduce((sum, row) => sum + (row.status === 'blocked' ? 25 : row.status === 'limit' ? 16 : row.status === 'watch' ? 7 : 0), 0);
  const capacityScore = clampScore(100 - capacityPenalty);
  const batchSafetyScore = clampScore(100 - batchPenalty);
  const dataReadinessScore = clampScore(100 - dataPenalty + (numberValue(totals?.salesNet) > 0 ? 2 : 0));
  const platformScore = clampScore(capacityScore * 0.36 + batchSafetyScore * 0.34 + dataReadinessScore * 0.30);
  return {
    version: 'v369 Mid-Range Heavy Work Patch',
    posture: 'Mid-range restaurant ERP platform with heavy work handled through chunked, resumable lanes.',
    generatedAt: new Date().toISOString(),
    runtime: {
      mode: productionConfig.runtimeMode,
      supabaseConfigured: getSupabaseConfig().configured,
      browserStateBytes: stateSizeBytes(state),
    },
    counts: {
      totalRows,
      readyDatasets: datasets.filter((row) => row.status === 'ready').length,
      watchDatasets: datasets.filter((row) => row.status === 'watch').length,
      limitDatasets: datasets.filter((row) => row.status === 'limit').length,
      blockedGuardrails: guardrails.filter((row) => row.status === 'blocked').length,
      heavyJobs: jobs.length,
    },
    scores: { platformScore, capacityScore, batchSafetyScore, dataReadinessScore },
    datasets,
    lanes,
    jobs,
    guardrails,
    runbook: buildV369Runbook(),
  };
}

export function v369StatusTone(status: V369Status): V369Tone {
  if (status === 'ready') return 'ready';
  if (status === 'watch') return 'warn';
  if (status === 'limit' || status === 'blocked') return 'bad';
  return 'info';
}

export function v369RowsToCsv(rows: any[]) {
  if (!rows.length) return '';
  const headers = Array.from(rows.reduce<Set<string>>((set, row) => {
    Object.keys(row || {}).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));
  const esc = (value: unknown) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(','), ...rows.map((row) => headers.map((header) => esc(row?.[header])).join(','))].join('\n');
}
