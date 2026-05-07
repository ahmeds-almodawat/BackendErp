export type ModuleRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type ModuleRegistryEntry = {
  key: 'analytics' | 'finance' | 'inventory' | 'purchasing' | 'production' | 'sales' | 'hr' | 'setup' | 'access';
  routeOwner: string;
  backendTables: string[];
  permissionKeys: string[];
  engineDependencies: string[];
  importExportResponsibilities: string[];
  riskLevel: ModuleRiskLevel;
  backendCutoverTasks: string[];
};

export const moduleRegistry: ModuleRegistryEntry[] = [
  {
    key: 'analytics',
    routeOwner: 'Smart Analysis / Reports',
    backendTables: ['report_import_registrations', 'smart_analysis_views', 'custom_kpi_definitions', 'analytics_data_quality_checks'],
    permissionKeys: ['dashboard.view', 'reports.view', 'reports.export', 'analytics.manage'],
    engineDependencies: ['comparisonEngine', 'reportStudioEngine', 'dataQualityEngine'],
    importExportResponsibilities: ['CSV drilldowns', 'comparison exports', 'report pack registration', 'PDF report source registry'],
    riskLevel: 'high',
    backendCutoverTasks: ['Persist saved views', 'Store custom KPI formulas with validation', 'Schedule report pack generation', 'Protect management exports with RLS'],
  },
  {
    key: 'finance',
    routeOwner: 'Finance',
    backendTables: ['journals', 'journal_lines', 'finance_posting_batches', 'finance_posting_batch_lines', 'finance_reconciliation_checks', 'finance_posting_contracts'],
    permissionKeys: ['finance.view', 'finance.journal.create', 'finance.journal.post', 'finance.statements.view', 'finance.bank.reconcile', 'finance.period.lock'],
    engineDependencies: ['financeTruthLayer', 'postingGuardEngine', 'accountingEngine'],
    importExportResponsibilities: ['Posting contracts', 'ledger reconciliation templates', 'import mapping templates'],
    riskLevel: 'critical',
    backendCutoverTasks: ['Enforce finance_validate_posting_batch(uuid)', 'Block unbalanced postings', 'Reconcile subledgers to GL', 'Lock fiscal periods'],
  },
  {
    key: 'inventory',
    routeOwner: 'Inventory',
    backendTables: ['items', 'stock_movements', 'inventory_lots', 'inventory_approvals', 'stores'],
    permissionKeys: ['inventory.view', 'inventory.transfer.post', 'inventory.adjustment.request', 'inventory.adjustment.approve'],
    engineDependencies: ['inventoryCostingEngine', 'dataQualityEngine'],
    importExportResponsibilities: ['Items', 'opening stock', 'stock count', 'inventory valuation imports'],
    riskLevel: 'critical',
    backendCutoverTasks: ['Lock average cost', 'Validate negative balances', 'Attach lot/expiry controls', 'Post approved variances to finance truth layer'],
  },
  {
    key: 'purchasing',
    routeOwner: 'Purchasing',
    backendTables: ['suppliers', 'material_requests', 'purchase_orders', 'goods_receipts', 'purchase_invoices', 'supplier_payments'],
    permissionKeys: ['purchasing.invoice.create', 'purchasing.invoice.post', 'purchasing.po.approve', 'purchasing.grn.post', 'purchasing.payment.post'],
    engineDependencies: ['postingGuardEngine', 'documentLifecycleEngine'],
    importExportResponsibilities: ['Supplier master', 'invoice imports', 'AP payment run exports'],
    riskLevel: 'high',
    backendCutoverTasks: ['Implement PO/GRN/invoice three-way match', 'Control supplier payment approval', 'Post AP to finance batches'],
  },
  {
    key: 'production',
    routeOwner: 'Production / Prep',
    backendTables: ['production_recipes', 'production_batches', 'recipe_lines', 'stock_movements'],
    permissionKeys: ['production.recipe.manage', 'production.batch.create', 'production.batch.post', 'production.variance.view'],
    engineDependencies: ['inventoryCostingEngine', 'postingGuardEngine'],
    importExportResponsibilities: ['Recipe templates', 'batch posting exports', 'variance analysis'],
    riskLevel: 'high',
    backendCutoverTasks: ['Version recipes', 'Post WIP/final output', 'Capture wastage and finance variances'],
  },
  {
    key: 'sales',
    routeOwner: 'Sales / POS',
    backendTables: ['sales_batches', 'sales_lines', 'payments', 'menu_items', 'recipe_consumption'],
    permissionKeys: ['sales.post', 'pos.shift.open'],
    engineDependencies: ['reportImportCenterService', 'postingGuardEngine'],
    importExportResponsibilities: ['Foodics Today', 'Payments', 'Products', 'Categories'],
    riskLevel: 'critical',
    backendCutoverTasks: ['Import closed POS batches', 'Match payments to sales', 'Deduct recipes', 'Post COGS and VAT'],
  },
  {
    key: 'hr',
    routeOwner: 'HR & Attendance',
    backendTables: ['employees', 'attendance_logs', 'shift_schedules'],
    permissionKeys: ['hr.employee.manage', 'hr.attendance.punch_own'],
    engineDependencies: ['permissionEngine'],
    importExportResponsibilities: ['Employee import/export', 'attendance export'],
    riskLevel: 'medium',
    backendCutoverTasks: ['Link users to employees', 'Apply branch access scope', 'Protect salary fields'],
  },
  {
    key: 'setup',
    routeOwner: 'Setup',
    backendTables: ['branches', 'stores', 'items', 'menu_items', 'categories', 'cost_centers'],
    permissionKeys: ['settings.master.manage'],
    engineDependencies: ['dataQualityEngine'],
    importExportResponsibilities: ['Master data templates', 'category library import/export'],
    riskLevel: 'high',
    backendCutoverTasks: ['Enforce unique codes', 'Require categories', 'Keep active/inactive audit trail'],
  },
  {
    key: 'access',
    routeOwner: 'Access Control / Users',
    backendTables: ['roles', 'role_permissions', 'user_access', 'user_accounts', 'audit_logs'],
    permissionKeys: ['access.manage', 'access.user.create', 'access.user.manage'],
    engineDependencies: ['permissionEngine'],
    importExportResponsibilities: ['Authority matrix export', 'user access audit'],
    riskLevel: 'critical',
    backendCutoverTasks: ['Harden RLS', 'Test custom roles', 'Prevent privilege escalation', 'Audit permission changes'],
  },
];
