export type V385Severity = 'critical' | 'warning' | 'info' | 'good';
export type V385StageStatus = 'ready' | 'watch' | 'blocked';

export interface V385PurchasingFinding {
  severity: V385Severity;
  area: string;
  finding: string;
  action: string;
}

export interface V385PurchasingStageRow {
  stage: string;
  records: number;
  ready: number;
  blocked: number;
  status: V385StageStatus;
  evidence: string;
  nextAction: string;
}

export interface V385PurchasingDocumentLink {
  source: string;
  ref: string;
  status: string;
  linkedTo: string;
  linkStatus: V385StageStatus;
  evidence: string;
}

export interface V385PurchasingWorkflowSnapshot {
  version: string;
  generatedAt: string;
  workflowScore: number;
  counts: {
    suppliers: number;
    materialRequests: number;
    purchaseOrders: number;
    goodsReceipts: number;
    purchaseInvoices: number;
    supplierPayments: number;
    openDocuments: number;
    blockedDocuments: number;
  };
  stageRows: V385PurchasingStageRow[];
  documentLinks: V385PurchasingDocumentLink[];
  findings: V385PurchasingFinding[];
  productionGate: V385StageStatus;
  nextAction: string;
}

function arr<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function money(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function lineTotal(line: any) {
  const qty = money(line?.qty);
  const unitCost = money(line?.unitCost);
  const discount = money(line?.discount);
  const vatRate = money(line?.vatRate);
  const net = Math.max(0, qty * unitCost - discount);
  return net + net * vatRate / 100;
}

function invoiceTotal(invoice: any) {
  return arr(invoice?.lines).reduce((sum, line) => sum + lineTotal(line), 0);
}

function statusIsOpen(status: string | undefined) {
  return ['draft', 'submitted', 'approved', 'partially_received', 'open'].includes(String(status || '').toLowerCase());
}

function statusIsBlocked(status: string | undefined) {
  return ['rejected', 'cancelled', 'error', 'blocked'].includes(String(status || '').toLowerCase());
}

function stageStatus(records: number, blocked: number, required = false): V385StageStatus {
  if (blocked > 0) return 'blocked';
  if (required && records === 0) return 'watch';
  return 'ready';
}

function pushFinding(findings: V385PurchasingFinding[], severity: V385Severity, area: string, finding: string, action: string) {
  findings.push({ severity, area, finding, action });
}

export function buildV385PurchasingWorkflowSnapshot(state: any): V385PurchasingWorkflowSnapshot {
  const suppliers = arr(state?.suppliers).filter((supplier: any) => supplier?.active !== false);
  const materialRequests = arr(state?.materialRequests);
  const purchaseOrders = arr(state?.purchaseOrders);
  const goodsReceipts = arr(state?.goodsReceipts);
  const purchaseInvoices = arr(state?.purchaseInvoices);
  const supplierPayments = arr(state?.supplierPayments);
  const findings: V385PurchasingFinding[] = [];

  const openDocuments = [materialRequests, purchaseOrders, goodsReceipts, purchaseInvoices, supplierPayments]
    .flat()
    .filter((doc: any) => statusIsOpen(doc?.status)).length;
  const blockedDocuments = [materialRequests, purchaseOrders, goodsReceipts, purchaseInvoices, supplierPayments]
    .flat()
    .filter((doc: any) => statusIsBlocked(doc?.status)).length;

  const approvedRequests = materialRequests.filter((request: any) => ['approved', 'converted', 'posted', 'closed'].includes(String(request?.status || '').toLowerCase())).length;
  const approvedOrders = purchaseOrders.filter((po: any) => ['approved', 'partially_received', 'received', 'closed'].includes(String(po?.status || '').toLowerCase())).length;
  const postedReceipts = goodsReceipts.filter((grn: any) => String(grn?.status || '').toLowerCase() === 'posted').length;
  const postedInvoices = purchaseInvoices.filter((invoice: any) => String(invoice?.status || '').toLowerCase() === 'posted').length;
  const postedPayments = supplierPayments.filter((payment: any) => String(payment?.status || '').toLowerCase() === 'posted').length;

  const invoiceTotals = purchaseInvoices.map((invoice: any) => ({ invoice, total: invoiceTotal(invoice), paid: money(invoice?.paidAmount) }));
  const unpaidInvoices = invoiceTotals.filter((row) => String(row.invoice?.status || '').toLowerCase() === 'posted' && row.total - row.paid > 0.01);
  const overpaidInvoices = invoiceTotals.filter((row) => row.paid - row.total > 0.01);
  const invoiceMissingSupplier = purchaseInvoices.filter((invoice: any) => invoice?.supplierId && !suppliers.some((supplier: any) => supplier?.id === invoice.supplierId)).length;
  const poMissingSupplier = purchaseOrders.filter((po: any) => po?.supplierId && !suppliers.some((supplier: any) => supplier?.id === po.supplierId)).length;
  const grnWithoutPo = goodsReceipts.filter((grn: any) => grn?.poId && !purchaseOrders.some((po: any) => po?.id === grn.poId || po?.ref === grn.poId)).length;
  const paymentsWithoutSupplier = supplierPayments.filter((payment: any) => payment?.supplierId && !suppliers.some((supplier: any) => supplier?.id === payment.supplierId)).length;
  const paymentWithoutInvoiceRef = supplierPayments.filter((payment: any) => String(payment?.status || '').toLowerCase() === 'posted' && !payment?.invoiceRef).length;

  if (!suppliers.length) pushFinding(findings, 'critical', 'Master data', 'No active suppliers are available for purchasing workflows.', 'Create suppliers before production purchasing cutover.');
  if (!purchaseOrders.length) pushFinding(findings, 'warning', 'Purchasing lifecycle', 'No purchase orders exist yet.', 'Run a purchase request to PO to GRN to invoice scenario before pilot.');
  if (!goodsReceipts.length) pushFinding(findings, 'warning', 'Receiving', 'No goods receipts exist yet.', 'Create at least one GRN scenario and confirm stock impact before pilot.');
  if (!purchaseInvoices.length) pushFinding(findings, 'warning', 'Supplier invoices', 'No supplier invoice evidence exists yet.', 'Run one supplier invoice through validation and posting evidence.');
  if (invoiceMissingSupplier || poMissingSupplier || paymentsWithoutSupplier) pushFinding(findings, 'critical', 'Supplier integrity', `${invoiceMissingSupplier + poMissingSupplier + paymentsWithoutSupplier} purchasing document(s) reference missing suppliers.`, 'Repair supplier references before backend cutover.');
  if (grnWithoutPo) pushFinding(findings, 'warning', 'Document linking', `${grnWithoutPo} goods receipt(s) reference a missing purchase order.`, 'Link GRNs to purchase orders or mark them as direct receipts with approval evidence.');
  if (paymentWithoutInvoiceRef) pushFinding(findings, 'warning', 'AP settlement', `${paymentWithoutInvoiceRef} posted supplier payment(s) have no invoice reference.`, 'Require invoice allocation or supplier-statement allocation for production AP settlement.');
  if (overpaidInvoices.length) pushFinding(findings, 'critical', 'AP settlement', `${overpaidInvoices.length} invoice(s) appear overpaid in local state.`, 'Review payment allocation and block overpayment without credit memo approval.');
  if (blockedDocuments) pushFinding(findings, 'critical', 'Workflow status', `${blockedDocuments} purchasing document(s) are rejected/cancelled/blocked.`, 'Resolve or exclude blocked documents before pilot cutover.');
  if (!findings.length) pushFinding(findings, 'good', 'Purchasing workflow', 'No major local purchasing workflow blockers detected.', 'Proceed to backend posting and AP statement proof.');

  const stageRows: V385PurchasingStageRow[] = [
    {
      stage: 'Supplier master data',
      records: suppliers.length,
      ready: suppliers.length,
      blocked: suppliers.length ? 0 : 1,
      status: suppliers.length ? 'ready' : 'blocked',
      evidence: `${suppliers.length} active supplier(s).`,
      nextAction: suppliers.length ? 'Keep VAT, bank, contact, and payment terms complete.' : 'Create active suppliers first.',
    },
    {
      stage: 'Purchase requests',
      records: materialRequests.length,
      ready: approvedRequests,
      blocked: materialRequests.filter((request: any) => statusIsBlocked(request?.status)).length,
      status: stageStatus(materialRequests.length, materialRequests.filter((request: any) => statusIsBlocked(request?.status)).length),
      evidence: `${approvedRequests}/${materialRequests.length} approved/converted/posted.`,
      nextAction: 'Use requests for controlled purchasing demand before PO conversion.',
    },
    {
      stage: 'Purchase orders',
      records: purchaseOrders.length,
      ready: approvedOrders,
      blocked: poMissingSupplier,
      status: stageStatus(purchaseOrders.length, poMissingSupplier, true),
      evidence: `${approvedOrders}/${purchaseOrders.length} approved/received/closed; ${poMissingSupplier} supplier gap(s).`,
      nextAction: 'Require supplier, branch, store, item lines, approval evidence, and expected delivery date.',
    },
    {
      stage: 'Goods receipts',
      records: goodsReceipts.length,
      ready: postedReceipts,
      blocked: grnWithoutPo,
      status: stageStatus(goodsReceipts.length, grnWithoutPo, true),
      evidence: `${postedReceipts}/${goodsReceipts.length} posted; ${grnWithoutPo} PO link gap(s).`,
      nextAction: 'Post GRN through backend stock ledger before supplier invoice matching.',
    },
    {
      stage: 'Supplier invoices',
      records: purchaseInvoices.length,
      ready: postedInvoices,
      blocked: invoiceMissingSupplier + overpaidInvoices.length,
      status: stageStatus(purchaseInvoices.length, invoiceMissingSupplier + overpaidInvoices.length, true),
      evidence: `${postedInvoices}/${purchaseInvoices.length} posted; ${unpaidInvoices.length} unpaid/open invoice(s).`,
      nextAction: 'Match invoice to GRN/PO and post AP/VAT/inventory through backend authority.',
    },
    {
      stage: 'Supplier payments',
      records: supplierPayments.length,
      ready: postedPayments,
      blocked: paymentsWithoutSupplier,
      status: stageStatus(supplierPayments.length, paymentsWithoutSupplier),
      evidence: `${postedPayments}/${supplierPayments.length} posted; ${paymentWithoutInvoiceRef} without invoice allocation.`,
      nextAction: 'Require invoice allocation, bank/cash account, approval, and AP settlement evidence.',
    },
  ];

  const poByIdOrRef = new Map<string, any>();
  purchaseOrders.forEach((po: any) => { if (po?.id) poByIdOrRef.set(po.id, po); if (po?.ref) poByIdOrRef.set(po.ref, po); });

  const documentLinks: V385PurchasingDocumentLink[] = [
    ...purchaseOrders.slice(0, 20).map((po: any) => ({
      source: 'PO',
      ref: po?.ref || po?.id || '—',
      status: po?.status || 'unknown',
      linkedTo: po?.requestRef ? `Request ${po.requestRef}` : 'No request link',
      linkStatus: po?.requestRef ? 'ready' as V385StageStatus : 'watch' as V385StageStatus,
      evidence: po?.requestRef ? 'PO is linked to a request reference.' : 'Direct PO needs approval reason in production.',
    })),
    ...goodsReceipts.slice(0, 20).map((grn: any) => ({
      source: 'GRN',
      ref: grn?.ref || grn?.id || '—',
      status: grn?.status || 'unknown',
      linkedTo: grn?.poId ? `PO ${grn.poId}` : 'No PO link',
      linkStatus: grn?.poId && poByIdOrRef.has(grn.poId) ? 'ready' as V385StageStatus : grn?.poId ? 'blocked' as V385StageStatus : 'watch' as V385StageStatus,
      evidence: grn?.poId && poByIdOrRef.has(grn.poId) ? 'GRN resolves to an existing PO.' : 'GRN needs PO/direct-receipt approval evidence.',
    })),
    ...supplierPayments.slice(0, 20).map((payment: any) => ({
      source: 'Payment',
      ref: payment?.ref || payment?.id || '—',
      status: payment?.status || 'unknown',
      linkedTo: payment?.invoiceRef ? `Invoice ${payment.invoiceRef}` : 'No invoice allocation',
      linkStatus: payment?.invoiceRef ? 'ready' as V385StageStatus : 'watch' as V385StageStatus,
      evidence: payment?.invoiceRef ? 'Payment has invoice reference.' : 'Payment must allocate to invoice or supplier statement in production.',
    })),
  ];

  const critical = findings.filter((finding) => finding.severity === 'critical').length;
  const warnings = findings.filter((finding) => finding.severity === 'warning').length;
  const missingStagePenalty = stageRows.filter((row) => row.status !== 'ready').length * 6;
  const workflowScore = Math.max(0, Math.min(100, Math.round(100 - critical * 22 - warnings * 8 - missingStagePenalty + (purchaseInvoices.length && goodsReceipts.length ? 5 : 0))));
  const productionGate: V385StageStatus = critical ? 'blocked' : warnings ? 'watch' : 'ready';

  return {
    version: 'v385 Purchasing Workflow Gate',
    generatedAt: new Date().toISOString(),
    workflowScore,
    counts: {
      suppliers: suppliers.length,
      materialRequests: materialRequests.length,
      purchaseOrders: purchaseOrders.length,
      goodsReceipts: goodsReceipts.length,
      purchaseInvoices: purchaseInvoices.length,
      supplierPayments: supplierPayments.length,
      openDocuments,
      blockedDocuments,
    },
    stageRows,
    documentLinks,
    findings,
    productionGate,
    nextAction: productionGate === 'blocked'
      ? 'Resolve critical supplier/document-linking blockers before pilot.'
      : productionGate === 'watch'
        ? 'Run a complete request → PO → GRN → invoice → payment proof scenario and connect backend posting evidence.'
        : 'Proceed to backend AP posting, supplier statement, and VAT/input reconciliation proof.',
  };
}

export function v385PurchasingRowsToCsv(snapshot: V385PurchasingWorkflowSnapshot): string {
  const rows = [
    ['section', 'name', 'status', 'records', 'ready', 'blocked', 'evidence', 'next_action'],
    ...snapshot.stageRows.map((row) => ['stage', row.stage, row.status, row.records, row.ready, row.blocked, row.evidence, row.nextAction]),
    ...snapshot.findings.map((finding) => ['finding', finding.area, finding.severity, '', '', '', finding.finding, finding.action]),
  ];
  return rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}
