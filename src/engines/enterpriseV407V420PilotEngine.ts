export type V407PilotSeverity = 'good' | 'warning' | 'critical';
export type V407PilotStatus = 'ready' | 'watch' | 'blocked';

export type V407PostingActionKey =
  | 'purchaseInvoice'
  | 'supplierPayment'
  | 'posDay'
  | 'productionBatch'
  | 'stockAdjustment'
  | 'stockCount'
  | 'vatSettlement'
  | 'periodClose';

export interface V407PostingAction {
  key: V407PostingActionKey;
  title: string;
  module: string;
  rpcName: string;
  idField?: string;
  idLabel?: string;
  requiredPermission: string;
  requiredStatus: string;
  backendObject: string;
  risk: 'medium' | 'high' | 'critical';
  description: string;
  nextProof: string;
}

export interface V407PostingTarget {
  actionKey: V407PostingActionKey;
  id: string;
  label: string;
  status?: string;
  source: string;
}

export interface V407WorkflowRow {
  actionKey: V407PostingActionKey;
  workflow: string;
  module: string;
  status: V407PilotStatus;
  localRecords: number;
  readyCandidates: number;
  rpcName: string;
  evidence: string;
  blocker: string;
  nextAction: string;
}

export interface V407PilotFinding {
  severity: V407PilotSeverity;
  area: string;
  finding: string;
  action: string;
}

export interface V407PilotChecklistItem {
  key: string;
  title: string;
  status: V407PilotStatus;
  owner: string;
  evidence: string;
  exitCriteria: string;
}

export interface V407PilotSnapshot {
  version: string;
  score: number;
  status: V407PilotStatus;
  actions: V407PostingAction[];
  workflows: V407WorkflowRow[];
  targets: V407PostingTarget[];
  findings: V407PilotFinding[];
  checklist: V407PilotChecklistItem[];
  counts: {
    backendPostingActions: number;
    readyWorkflows: number;
    blockedWorkflows: number;
    criticalFindings: number;
    localCandidateDocuments: number;
  };
  nextAction: string;
}

function arr(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function statusOf(doc: any): string {
  return String(doc?.status ?? (doc?.posted ? 'posted' : '')).toLowerCase();
}

function labelOf(doc: any, fallback: string): string {
  return String(doc?.ref || doc?.invoiceNo || doc?.code || doc?.name || doc?.id || fallback);
}

function isUuidLike(value: unknown): boolean {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isReadyStatus(status: string, accepted: string[]): boolean {
  return accepted.includes(status.toLowerCase());
}

function targetRows(actionKey: V407PostingActionKey, rows: any[], source: string): V407PostingTarget[] {
  return rows
    .filter((row) => row && row.id)
    .slice(0, 40)
    .map((row, index) => ({
      actionKey,
      id: String(row.id),
      label: labelOf(row, `${source} ${index + 1}`),
      status: statusOf(row),
      source,
    }));
}

export const V407_POSTING_ACTIONS: V407PostingAction[] = [
  {
    key: 'purchaseInvoice',
    title: 'Purchase invoice posting',
    module: 'Purchasing / Finance / Inventory',
    rpcName: 'purchasing_post_purchase_invoice',
    idField: 'invoice_id',
    idLabel: 'Purchase invoice UUID',
    requiredPermission: 'finance.post',
    requiredStatus: 'approved / validated',
    backendObject: 'purchase_invoices + posting_batches + inventory movements + AP/VAT',
    risk: 'critical',
    description: 'Posts supplier invoice into inventory, AP, VAT input, GL, journal and audit evidence.',
    nextProof: 'Run one approved invoice in local Supabase and verify posting batch + journal + AP/VAT records.',
  },
  {
    key: 'supplierPayment',
    title: 'Supplier payment posting',
    module: 'Purchasing / Treasury / Finance',
    rpcName: 'purchasing_post_supplier_payment',
    idField: 'payment_id',
    idLabel: 'Supplier payment UUID',
    requiredPermission: 'finance.post',
    requiredStatus: 'approved',
    backendObject: 'supplier_payments + AP applications + posting_batches + finance journal',
    risk: 'critical',
    description: 'Settles AP against cash/bank and creates auditable GL posting evidence.',
    nextProof: 'Post a payment against open AP and verify AP balance closes without overpayment.',
  },
  {
    key: 'posDay',
    title: 'POS day settlement',
    module: 'Sales / POS / Finance',
    rpcName: 'sales_post_pos_batch',
    idField: 'batch_id',
    idLabel: 'POS batch UUID',
    requiredPermission: 'sales.import or finance.post',
    requiredStatus: 'approved / validated / reconciled',
    backendObject: 'sales_pos_batches + payment settlements + VAT output + GL',
    risk: 'critical',
    description: 'Posts POS day revenue, VAT output and settlement clearing lines.',
    nextProof: 'Run one reconciled POS batch and compare payments to sales + VAT.',
  },
  {
    key: 'productionBatch',
    title: 'Production batch posting',
    module: 'Production / Inventory / Finance',
    rpcName: 'production_post_batch',
    idField: 'batch_id',
    idLabel: 'Production batch UUID',
    requiredPermission: 'production.post or inventory.adjust or finance.post',
    requiredStatus: 'approved / completed',
    backendObject: 'production batches + consumption/output movements + GL variance',
    risk: 'critical',
    description: 'Consumes raw materials, receives output and posts variance evidence.',
    nextProof: 'Post one recipe batch and reconcile input value to output and variance.',
  },
  {
    key: 'stockAdjustment',
    title: 'Stock adjustment posting',
    module: 'Inventory / Finance',
    rpcName: 'inventory_post_adjustment',
    idField: 'adjustment_id',
    idLabel: 'Stock adjustment UUID',
    requiredPermission: 'inventory.adjust or finance.post',
    requiredStatus: 'approved / validated',
    backendObject: 'stock adjustments + inventory movement + GL stock variance',
    risk: 'critical',
    description: 'Posts approved stock adjustments to inventory and finance variance accounts.',
    nextProof: 'Post one positive and one negative adjustment with negative-stock blocking enabled.',
  },
  {
    key: 'stockCount',
    title: 'Stock count posting',
    module: 'Inventory / Finance',
    rpcName: 'inventory_post_stock_count',
    idField: 'count_id',
    idLabel: 'Stock count UUID',
    requiredPermission: 'inventory.adjust or finance.post',
    requiredStatus: 'approved / validated',
    backendObject: 'stock counts + count variances + inventory/GL adjustment posting',
    risk: 'critical',
    description: 'Posts approved physical count variances into stock and finance evidence.',
    nextProof: 'Run one count sheet and verify variance movement and GL equality.',
  },
  {
    key: 'vatSettlement',
    title: 'VAT settlement',
    module: 'Finance / Tax',
    rpcName: 'finance_post_vat_settlement',
    idLabel: 'Period key',
    requiredPermission: 'finance.post',
    requiredStatus: 'open period',
    backendObject: 'VAT input/output evidence + settlement run',
    risk: 'critical',
    description: 'Calculates VAT payable/recoverable evidence and records settlement run.',
    nextProof: 'Run monthly VAT settlement after purchase and POS postings.',
  },
  {
    key: 'periodClose',
    title: 'Fiscal period close',
    module: 'Finance / Control',
    rpcName: 'finance_close_period',
    idLabel: 'Period key',
    requiredPermission: 'finance.post',
    requiredStatus: 'open period, no blockers',
    backendObject: 'fiscal_periods + finance close run + blocker evidence',
    risk: 'critical',
    description: 'Runs close blockers and closes/locks a fiscal period with audit evidence.',
    nextProof: 'Close a month after VAT settlement and verify blockers are zero or explicitly forced.',
  },
];

export function buildV407V420PilotSnapshot(state: any): V407PilotSnapshot {
  const purchaseInvoices = arr(state?.purchaseInvoices);
  const supplierPayments = arr(state?.supplierPayments);
  const posBatches = arr(state?.posBatches).concat(arr(state?.salesPosBatches), arr(state?.foodicsBatches));
  const productions = arr(state?.productions).concat(arr(state?.productionBatches));
  const adjustments = arr(state?.inventoryAdjustments).concat(arr(state?.stockAdjustments));
  const stockCounts = arr(state?.stockCounts).concat(arr(state?.monthlyStockCounts));
  const fiscalPeriods = arr(state?.fiscalPeriods);

  const targets: V407PostingTarget[] = [
    ...targetRows('purchaseInvoice', purchaseInvoices, 'purchaseInvoices'),
    ...targetRows('supplierPayment', supplierPayments, 'supplierPayments'),
    ...targetRows('posDay', posBatches, 'posBatches'),
    ...targetRows('productionBatch', productions, 'productions'),
    ...targetRows('stockAdjustment', adjustments, 'inventoryAdjustments'),
    ...targetRows('stockCount', stockCounts, 'stockCounts'),
  ];

  const workflowSource: Record<V407PostingActionKey, { rows: any[]; ready: string[]; source: string }> = {
    purchaseInvoice: { rows: purchaseInvoices, ready: ['approved', 'validated'], source: 'purchaseInvoices' },
    supplierPayment: { rows: supplierPayments, ready: ['approved'], source: 'supplierPayments' },
    posDay: { rows: posBatches, ready: ['approved', 'validated', 'reconciled'], source: 'posBatches' },
    productionBatch: { rows: productions, ready: ['approved', 'validated', 'released', 'completed'], source: 'productions' },
    stockAdjustment: { rows: adjustments, ready: ['approved', 'validated'], source: 'inventoryAdjustments' },
    stockCount: { rows: stockCounts, ready: ['approved', 'validated'], source: 'stockCounts' },
    vatSettlement: { rows: fiscalPeriods, ready: ['open'], source: 'fiscalPeriods' },
    periodClose: { rows: fiscalPeriods, ready: ['open'], source: 'fiscalPeriods' },
  };

  const workflows = V407_POSTING_ACTIONS.map((action) => {
    const source = workflowSource[action.key];
    const ready = source.rows.filter((row) => isReadyStatus(statusOf(row), source.ready)).length;
    const uuidReady = source.rows.filter((row) => isUuidLike(row?.id)).length;
    const records = source.rows.length;
    const status: V407PilotStatus = records === 0
      ? 'watch'
      : ready > 0 && (action.key === 'vatSettlement' || action.key === 'periodClose' || uuidReady > 0)
        ? 'ready'
        : ready > 0
          ? 'watch'
          : 'blocked';
    return {
      actionKey: action.key,
      workflow: action.title,
      module: action.module,
      status,
      localRecords: records,
      readyCandidates: ready,
      rpcName: action.rpcName,
      evidence: records
        ? `${records} local record(s), ${ready} status-ready candidate(s), ${uuidReady} UUID-compatible ID(s).`
        : `No local ${source.source} records were found in browser state. Backend table data may still exist in Supabase.`,
      blocker: status === 'ready' ? 'None detected in local state.' : status === 'watch' ? 'Needs backend/Supabase proof run.' : 'No approved/validated local candidate detected.',
      nextAction: action.nextProof,
    } satisfies V407WorkflowRow;
  });

  const findings: V407PilotFinding[] = [];
  const blocked = workflows.filter((row) => row.status === 'blocked');
  const watch = workflows.filter((row) => row.status === 'watch');

  if (blocked.length) findings.push({ severity: 'critical', area: 'Posting proof', finding: `${blocked.length} server posting workflow(s) have no local ready candidate.`, action: 'Create or import a realistic approved document for each blocked workflow before pilot UAT.' });
  if (watch.length) findings.push({ severity: 'warning', area: 'Backend proof', finding: `${watch.length} workflow(s) require live Supabase proof.`, action: 'Use the Pilot Center RPC console to run each function in local Supabase and record the result.' });
  if (!fiscalPeriods.length) findings.push({ severity: 'warning', area: 'Fiscal periods', finding: 'No fiscal periods are present in local browser state.', action: 'Seed or create fiscal periods before VAT settlement and close testing.' });
  if (!findings.length) findings.push({ severity: 'good', area: 'Pilot readiness', finding: 'No local pilot blocker detected.', action: 'Run Supabase RPC proof and begin UAT walkthrough.' });

  const checklist: V407PilotChecklistItem[] = [
    { key: 'fresh-reset', title: 'Fresh Supabase reset', status: 'ready', owner: 'Technical admin', evidence: 'supabase db reset must pass after every patch.', exitCriteria: 'No SQL migration errors; local Studio opens.' },
    { key: 'qa-all', title: 'Full QA and build', status: 'ready', owner: 'Technical admin', evidence: 'npm run qa:all and npm run build.', exitCriteria: 'No TypeScript/build/QA failures.' },
    { key: 'posting-proof', title: 'Posting RPC proof', status: blocked.length ? 'blocked' : 'watch', owner: 'Finance + operations', evidence: `${V407_POSTING_ACTIONS.length} backend posting actions are catalogued.`, exitCriteria: 'Each critical RPC tested once with real local Supabase data.' },
    { key: 'reports-proof', title: 'Report truth refresh', status: 'watch', owner: 'Finance manager', evidence: 'Report snapshot worker exists; financial statements still need final formula proof from posted ledgers.', exitCriteria: 'Trial balance, AP, VAT and inventory valuation reconcile to posting lines.' },
    { key: 'backup-drill', title: 'Backup/restore drill', status: 'watch', owner: 'System admin', evidence: 'Backup/Restore page exists for local state and backend archive evidence.', exitCriteria: 'Export backup, restore on clean environment, compare counts.' },
    { key: 'uat', title: 'UAT sign-off', status: 'watch', owner: 'Operations owners', evidence: 'Pilot Center provides final checklist.', exitCriteria: 'Purchasing, inventory, POS, production, finance and HR scenario signed off.' },
  ];

  const readyWorkflows = workflows.filter((row) => row.status === 'ready').length;
  const blockedWorkflows = blocked.length;
  const criticalFindings = findings.filter((finding) => finding.severity === 'critical').length;
  const score = Math.max(0, Math.min(100, Math.round((readyWorkflows / Math.max(1, workflows.length)) * 65 + (criticalFindings ? 0 : 15) + 20)));
  const status: V407PilotStatus = criticalFindings ? 'blocked' : score >= 85 ? 'ready' : 'watch';

  return {
    version: 'v407-v420 Production Pilot Completion',
    score,
    status,
    actions: V407_POSTING_ACTIONS,
    workflows,
    targets,
    findings,
    checklist,
    counts: {
      backendPostingActions: V407_POSTING_ACTIONS.length,
      readyWorkflows,
      blockedWorkflows,
      criticalFindings,
      localCandidateDocuments: targets.length,
    },
    nextAction: criticalFindings
      ? 'Create approved local documents or seed a Supabase test scenario, then run backend posting proof.'
      : 'Run each backend RPC once in local Supabase and export the pilot evidence report.',
  };
}

export function v407PilotRowsToCsv(snapshot: V407PilotSnapshot): string {
  const rows = [
    ...snapshot.workflows.map((row) => ({ type: 'workflow', ...row })),
    ...snapshot.findings.map((row) => ({ type: 'finding', ...row })),
    ...snapshot.checklist.map((row) => ({ type: 'checklist', ...row })),
    ...snapshot.actions.map((row) => ({ type: 'rpc', ...row })),
  ];
  if (!rows.length) return '';
  const headers = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));
  const esc = (value: unknown) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(','), ...rows.map((row: any) => headers.map((header) => esc(row[header])).join(','))].join('\n');
}
