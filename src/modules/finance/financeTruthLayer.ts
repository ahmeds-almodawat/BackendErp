export type PostingContractKey =
  | 'manual_journal'
  | 'purchase_invoice'
  | 'supplier_payment'
  | 'sales_pos_batch'
  | 'inventory_adjustment'
  | 'production_batch'
  | 'depreciation_run'
  | 'opening_balance'
  | 'bank_reconciliation';

export type PostingContract = {
  key: PostingContractKey;
  sourceModule: string;
  expectedDebits: string[];
  expectedCredits: string[];
  requiredControls: string[];
  csvTemplate: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
};

export type FinanceTruthFinding = {
  severity: 'ok' | 'warning' | 'critical';
  area: string;
  issue: string;
  action: string;
};

export type FinanceTruthLayerResult = {
  truthScore: number;
  totalBatches: number;
  postedJournals: number;
  balancedJournals: number;
  unbalancedJournals: number;
  sourceCoveragePct: number;
  findings: FinanceTruthFinding[];
};

export const FINANCE_POSTING_CONTRACTS: PostingContract[] = [
  { key: 'manual_journal', sourceModule: 'Finance', expectedDebits: ['Any configured debit account'], expectedCredits: ['Any configured credit account'], requiredControls: ['balanced_lines', 'period_open', 'approval_required'], csvTemplate: 'templates/finance_posting_contracts_v309_template.csv', riskLevel: 'high' },
  { key: 'purchase_invoice', sourceModule: 'Purchasing', expectedDebits: ['Inventory / Expense', 'VAT Input'], expectedCredits: ['Accounts Payable / Cash'], requiredControls: ['supplier_required', 'invoice_no_unique', 'po_grn_match'], csvTemplate: 'templates/finance_import_mapping_v309_template.csv', riskLevel: 'critical' },
  { key: 'supplier_payment', sourceModule: 'Purchasing/AP', expectedDebits: ['Accounts Payable'], expectedCredits: ['Cash / Bank'], requiredControls: ['invoice_open_balance', 'payment_method_valid', 'bank_required'], csvTemplate: 'templates/ledger_reconciliation_v309_template.csv', riskLevel: 'high' },
  { key: 'sales_pos_batch', sourceModule: 'Sales/POS', expectedDebits: ['Cash / Bank / AR'], expectedCredits: ['Sales Revenue', 'VAT Output'], requiredControls: ['batch_closed', 'payment_split_balanced', 'recipe_deduction_linked'], csvTemplate: 'templates/finance_posting_contracts_v309_template.csv', riskLevel: 'critical' },
  { key: 'inventory_adjustment', sourceModule: 'Inventory', expectedDebits: ['Inventory Gain / Variance'], expectedCredits: ['Inventory / Variance'], requiredControls: ['approval_required', 'reason_required', 'cost_locked'], csvTemplate: 'templates/finance_import_mapping_v309_template.csv', riskLevel: 'high' },
  { key: 'production_batch', sourceModule: 'Production', expectedDebits: ['Semi-finished / Finished Inventory'], expectedCredits: ['Raw Material Inventory'], requiredControls: ['recipe_version_locked', 'wastage_captured', 'output_qty_required'], csvTemplate: 'templates/finance_posting_contracts_v309_template.csv', riskLevel: 'high' },
  { key: 'depreciation_run', sourceModule: 'Fixed Assets', expectedDebits: ['Depreciation Expense'], expectedCredits: ['Accumulated Depreciation'], requiredControls: ['asset_active', 'period_not_closed', 'no_duplicate_run'], csvTemplate: 'templates/ledger_reconciliation_v309_template.csv', riskLevel: 'medium' },
  { key: 'opening_balance', sourceModule: 'Finance', expectedDebits: ['Opening assets/expenses'], expectedCredits: ['Opening liabilities/equity/revenue'], requiredControls: ['single_opening_batch', 'balanced_lines', 'locked_after_post'], csvTemplate: 'templates/finance_posting_contracts_v309_template.csv', riskLevel: 'critical' },
  { key: 'bank_reconciliation', sourceModule: 'Banking', expectedDebits: ['Bank / Clearing'], expectedCredits: ['Bank / Clearing'], requiredControls: ['statement_line_matched', 'difference_explained', 'approval_required'], csvTemplate: 'templates/ledger_reconciliation_v309_template.csv', riskLevel: 'high' },
];

function safeArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function journalBalance(journal: any) {
  const lines = safeArray<any>(journal?.lines);
  const debit = lines.reduce((sum, line) => sum + Number(line?.debit || 0), 0);
  const credit = lines.reduce((sum, line) => sum + Number(line?.credit || 0), 0);
  return { debit, credit, diff: debit - credit, balanced: Math.abs(debit - credit) < 0.01 };
}

export function evaluateFinanceTruthLayer(state: any): FinanceTruthLayerResult {
  const journals = safeArray<any>(state?.journals).filter((j) => j?.status === 'posted');
  const balancedJournals = journals.filter((journal) => journalBalance(journal).balanced).length;
  const unbalancedJournals = journals.length - balancedJournals;
  const sourceSet = new Set(journals.map((j) => String(j?.source || '').toLowerCase()).filter(Boolean));
  const expectedSources = ['manual', 'purchase', 'payment', 'sale', 'inventory', 'production', 'depreciation', 'opening', 'bank'];
  const coveredSources = expectedSources.filter((source) => Array.from(sourceSet).some((actual) => actual.includes(source))).length;
  const coveragePct = Math.round((coveredSources / expectedSources.length) * 100);
  const findings: FinanceTruthFinding[] = [];

  if (!journals.length) findings.push({ severity: 'critical', area: 'Posting batches', issue: 'No posted journals found in local truth layer.', action: 'Post at least one controlled batch from Finance, Sales, Purchasing, Inventory, or Production.' });
  if (unbalancedJournals > 0) findings.push({ severity: 'critical', area: 'Ledger integrity', issue: `${unbalancedJournals} posted journal(s) are not balanced.`, action: 'Run finance_validate_posting_batch(uuid) and block posting until debits equal credits.' });
  if (coveragePct < 50) findings.push({ severity: 'warning', area: 'Source coverage', issue: `Only ${coveragePct}% of expected posting sources are represented.`, action: 'Wire source modules to finance_posting_batches before production cutover.' });
  if (!safeArray(state?.bankReconLines).length) findings.push({ severity: 'warning', area: 'Bank reconciliation', issue: 'No reconciliation lines are registered.', action: 'Import statement lines and complete reconciliation checks.' });
  if (!findings.length) findings.push({ severity: 'ok', area: 'Truth layer', issue: 'Core ledger checks are clean.', action: 'Continue backend cutover and add database-side validations.' });

  const lost = findings.reduce((sum, finding) => sum + (finding.severity === 'critical' ? 25 : finding.severity === 'warning' ? 10 : 0), 0);
  const base = journals.length ? 100 : 72;
  return {
    truthScore: Math.max(0, Math.min(100, base - lost + Math.round(coveragePct / 10))),
    totalBatches: journals.length,
    postedJournals: journals.length,
    balancedJournals,
    unbalancedJournals,
    sourceCoveragePct: coveragePct,
    findings,
  };
}
