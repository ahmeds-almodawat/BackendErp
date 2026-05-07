export type V200Score = {
  label: string;
  score: number;
  target: number;
  note: string;
};

export type V200ControlRow = {
  area: string;
  status: 'Ready' | 'Partial' | 'Missing' | 'Blocked';
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  owner: string;
  nextAction: string;
};

const list = (value: unknown) => Array.isArray(value) ? value : [];
const amount = (value: unknown) => Number(value || 0);

export function calculateV200Scores(state: any, totals: any): V200Score[] {
  const branches = list(state?.branches).length;
  const stores = list(state?.stores).length;
  const items = list(state?.items).length;
  const suppliers = list(state?.suppliers).length;
  const accounts = list(state?.accounts).length;
  const journals = list(state?.journals);
  const stockMovements = list(state?.stockMovements);
  const foodicsBatches = list(state?.foodicsBatches).length + list(state?.foodicsImportBatches).length;
  const hasBackendEnv = Boolean(import.meta.env?.VITE_SUPABASE_URL && import.meta.env?.VITE_SUPABASE_ANON_KEY);
  const journalBalance = journals.flatMap((j: any) => list(j.lines)).reduce((sum: number, l: any) => sum + amount(l.debit) - amount(l.credit), 0);
  const setupScore = Math.min(100, Math.round(((branches ? 18 : 0) + (stores ? 18 : 0) + (items ? 18 : 0) + (suppliers ? 14 : 0) + (accounts ? 18 : 0) + (list(state?.costCenters).length ? 14 : 0))));
  const backendScore = hasBackendEnv ? 58 : 34;
  const postingScore = Math.min(100, 35 + (journals.length ? 20 : 0) + (stockMovements.length ? 15 : 0) + (foodicsBatches ? 10 : 0) + (Math.abs(journalBalance) < 0.01 ? 20 : 0));
  const inventoryScore = Math.min(100, 45 + (stockMovements.length ? 20 : 0) + (list(state?.inventoryApprovals).length ? 10 : 0) + (list(state?.inventoryLots).length ? 10 : 0) + (amount(totals?.inventoryValue) > 0 ? 15 : 0));
  const closeScore = Math.min(100, 38 + (list(state?.fiscalPeriods).length ? 16 : 0) + (journals.length ? 16 : 0) + (foodicsBatches ? 10 : 0) + (list(state?.auditEvents).length ? 20 : 0));
  return [
    { label: 'Setup Persistence', score: setupScore, target: 90, note: 'Branches, stores, suppliers, items, cost centers and COA readiness.' },
    { label: 'Backend Bridge', score: backendScore, target: 85, note: hasBackendEnv ? 'Supabase environment detected; pilot calls can be enabled.' : 'Local mode active; add Supabase env keys to pilot backend sync.' },
    { label: 'Posting Orchestrator', score: postingScore, target: 90, note: 'Single validate → permission → period → lifecycle → inventory → GL → audit flow.' },
    { label: 'Inventory Controls', score: inventoryScore, target: 90, note: 'Opening stock, counts, approvals, lots, costing and transfers readiness.' },
    { label: 'Monthly Close', score: closeScore, target: 90, note: 'Foodics, inventory, AP, VAT, journals, audit and fiscal-period close controls.' },
  ];
}

export function buildV200ControlRows(state: any, totals: any): V200ControlRow[] {
  const branches = list(state?.branches);
  const stores = list(state?.stores);
  const items = list(state?.items);
  const suppliers = list(state?.suppliers);
  const accounts = list(state?.accounts);
  const movements = list(state?.stockMovements);
  const journals = list(state?.journals);
  const periods = list(state?.fiscalPeriods);
  const inventoryValue = amount(totals?.inventoryValue);
  const journalBalance = journals.flatMap((j: any) => list(j.lines)).reduce((sum: number, l: any) => sum + amount(l.debit) - amount(l.credit), 0);
  const duplicateSkuCount = new Set(items.map((i: any) => String(i.sku || '').toLowerCase())).size !== items.length;
  const suppliersMissingBank = suppliers.filter((s: any) => !s.vatNo || !s.bankName || !s.bankAccount).length;
  return [
    { area: 'Setup master data', status: branches.length && stores.length && items.length && suppliers.length && accounts.length ? 'Ready' : 'Partial', priority: 'Critical', owner: 'ERP Admin', nextAction: 'Complete branches, stores, items, suppliers, cost centers and chart of accounts before backend sync.' },
    { area: 'Duplicate SKU prevention', status: duplicateSkuCount ? 'Blocked' : 'Ready', priority: 'High', owner: 'Inventory Controller', nextAction: duplicateSkuCount ? 'Resolve duplicate SKUs before Supabase persistence.' : 'Keep SKU as the primary matching key for Foodics and inventory.' },
    { area: 'Supplier compliance fields', status: suppliersMissingBank ? 'Partial' : 'Ready', priority: 'Medium', owner: 'Procurement / Finance', nextAction: suppliersMissingBank ? `Complete VAT/bank fields for ${suppliersMissingBank} supplier(s).` : 'Supplier VAT and bank profile is ready for payment controls.' },
    { area: 'Inventory valuation', status: inventoryValue > 0 ? 'Ready' : 'Partial', priority: 'Critical', owner: 'Storekeeper', nextAction: 'Upload opening stock or purchase invoices to create costed stock before full ERP posting.' },
    { area: 'Stock movement audit', status: movements.length ? 'Ready' : 'Partial', priority: 'High', owner: 'Inventory Controller', nextAction: 'Ensure opening stock, stock counts and Foodics COGS all create movements.' },
    { area: 'Journal balance', status: Math.abs(journalBalance) < 0.01 ? 'Ready' : 'Blocked', priority: 'Critical', owner: 'Finance Manager', nextAction: Math.abs(journalBalance) < 0.01 ? 'Journal balance is currently clean.' : 'Investigate unbalanced journals before any period close.' },
    { area: 'Fiscal period control', status: periods.length ? 'Ready' : 'Partial', priority: 'High', owner: 'Finance Manager', nextAction: 'Create monthly fiscal periods and enforce period lock on postings.' },
    { area: 'Backend environment', status: import.meta.env?.VITE_SUPABASE_URL ? 'Partial' : 'Missing', priority: 'Critical', owner: 'Technical Lead', nextAction: 'Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then run setup sync dry-run.' },
    { area: 'Foodics staging', status: list(state?.foodicsBatches).length || list(state?.foodicsImportBatches).length ? 'Partial' : 'Missing', priority: 'High', owner: 'Operations / Finance', nextAction: 'Persist Foodics batches in backend staging before production posting.' },
    { area: 'Approval workflow', status: list(state?.approvalWorkflows).length ? 'Partial' : 'Missing', priority: 'High', owner: 'Owner / Internal Audit', nextAction: 'Turn maker-checker policy into enforced approval workflows.' },
  ];
}

export function buildV200Program(): V200ControlRow[] {
  return [
    { area: 'v182 Setup Repository', status: 'Partial', priority: 'Critical', owner: 'Engineering', nextAction: 'Create local/Supabase repository adapter for setup pages.' },
    { area: 'v183 Auth Shell', status: 'Partial', priority: 'Critical', owner: 'Engineering', nextAction: 'Add auth client and safe local fallback login shell.' },
    { area: 'v184 Master Data Governance', status: 'Partial', priority: 'High', owner: 'ERP Admin', nextAction: 'Add duplicate prevention, inactive status and change audit rules.' },
    { area: 'v185 Foodics Backend Staging', status: 'Partial', priority: 'High', owner: 'Operations', nextAction: 'Stage headers, lines, payments, mappings and issues in backend tables.' },
    { area: 'v186 Posting Orchestrator', status: 'Partial', priority: 'Critical', owner: 'Finance / Engineering', nextAction: 'Route all postings through one guard and audit trail.' },
    { area: 'v187 Approval Workflow', status: 'Partial', priority: 'High', owner: 'Owner / Audit', nextAction: 'Activate maker-checker for journals, payments, stock variances and Foodics batches.' },
    { area: 'v188 Attachment Vault', status: 'Partial', priority: 'High', owner: 'Finance / Procurement', nextAction: 'Connect supplier, PO, GRN, invoice, payment and journal attachments.' },
    { area: 'v189 Inventory Transfer Lifecycle', status: 'Partial', priority: 'High', owner: 'Storekeeper', nextAction: 'Add request → dispatch → in-transit → receive → close flow.' },
    { area: 'v190 FEFO and Costing', status: 'Partial', priority: 'High', owner: 'Inventory Controller', nextAction: 'Enforce weighted average and FEFO expiry suggestion.' },
    { area: 'v191 Finance Vouchers', status: 'Partial', priority: 'High', owner: 'Finance Manager', nextAction: 'Add voucher registers, AP/AR aging and bank matching.' },
    { area: 'v192 Settlement Workbench', status: 'Partial', priority: 'High', owner: 'Finance / Cashier Supervisor', nextAction: 'Reconcile cash, MADA, delivery apps and internal hospitality.' },
    { area: 'v193 Board Reports', status: 'Partial', priority: 'Medium', owner: 'CFO', nextAction: 'Generate Excel/PDF style packs for close, Foodics, inventory, finance and procurement.' },
    { area: 'v194 QA Automation', status: 'Partial', priority: 'Medium', owner: 'QA', nextAction: 'Create regression checklist and seed data pack for every release.' },
    { area: 'v195 RLS Smoke Tests', status: 'Partial', priority: 'Critical', owner: 'Technical Lead', nextAction: 'Test company, branch, store and role isolation.' },
    { area: 'v196 Backup / Restore', status: 'Partial', priority: 'High', owner: 'Technical Lead', nextAction: 'Add scheduled backup and export plan.' },
    { area: 'v197 Period Close Enforcement', status: 'Partial', priority: 'High', owner: 'Finance Manager', nextAction: 'Block backdated postings after close unless reopened by authority.' },
    { area: 'v198 UI Design System', status: 'Partial', priority: 'Medium', owner: 'Product', nextAction: 'Normalize headers, tables, badges, empty states and Arabic spacing.' },
    { area: 'v199 Pilot Go-Live Pack', status: 'Partial', priority: 'High', owner: 'Owner / Operations', nextAction: 'Pilot one branch with sales-accounting mode and monthly count.' },
    { area: 'v200 Production Readiness Review', status: 'Partial', priority: 'Critical', owner: 'Steering Committee', nextAction: 'Approve scope for real backend cutover and first pilot branch.' },
  ];
}
