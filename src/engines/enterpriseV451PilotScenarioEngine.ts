export type V451Locale = 'en' | 'ar';

export type V451ScenarioSeverity = 'info' | 'warning' | 'critical';

export interface V451PilotEntity {
  category: string;
  count: number;
  examples: string[];
  purpose: string;
}

export interface V451PilotStep {
  id: string;
  module: string;
  title: string;
  actor: string;
  input: string;
  expectedBackendProof: string[];
  expectedReports: string[];
  passCriteria: string[];
  riskIfFailed: string;
  sequence: number;
}

export interface V451ReconciliationCheck {
  id: string;
  area: string;
  check: string;
  expectedResult: string;
  evidenceSource: string;
  severity: V451ScenarioSeverity;
}

export interface V451PilotScenarioPack {
  version: string;
  title: string;
  subtitle: string;
  readinessScore: number;
  entities: V451PilotEntity[];
  steps: V451PilotStep[];
  reconciliationChecks: V451ReconciliationCheck[];
  operatorChecklist: string[];
  goNoGoRules: string[];
  nextActions: string[];
}

const t = (locale: V451Locale, en: string, ar: string): string => (locale === 'ar' ? ar : en);

export function buildV451PilotScenarioPack(locale: V451Locale = 'en'): V451PilotScenarioPack {
  const entities: V451PilotEntity[] = [
    {
      category: t(locale, 'Company / Branches', 'الشركة والفروع'),
      count: 4,
      examples: ['Holding company', 'Main branch', 'Restaurant branch 01', 'Restaurant branch 02'],
      purpose: t(locale, 'Prove branch scope, reporting filters, and operational separation.', 'إثبات نطاق الفروع وفلاتر التقارير وفصل العمليات.'),
    },
    {
      category: t(locale, 'Stores', 'المستودعات'),
      count: 5,
      examples: ['Central warehouse', 'Kitchen store', 'Dry store', 'Cold store', 'Branch mini-store'],
      purpose: t(locale, 'Prove stock location, production consumption, and branch/store inventory movement.', 'إثبات مواقع المخزون واستهلاك الإنتاج وحركة المخزون حسب الفرع والمستودع.'),
    },
    {
      category: t(locale, 'Suppliers', 'الموردون'),
      count: 10,
      examples: ['Meat supplier', 'Vegetable supplier', 'Packaging supplier', 'Beverage supplier'],
      purpose: t(locale, 'Prove purchasing, AP aging, supplier statements, and payment allocation.', 'إثبات المشتريات وأعمار الذمم وكشوف الموردين وتخصيص المدفوعات.'),
    },
    {
      category: t(locale, 'Items / SKUs', 'الأصناف'),
      count: 100,
      examples: ['Beef KG', 'Chicken KG', 'Flour KG', 'Sauce batch', 'Packaging unit'],
      purpose: t(locale, 'Prove master-data quality, costing, inventory movements, and stock valuation.', 'إثبات جودة البيانات الرئيسية والتكلفة وحركات المخزون والتقييم.'),
    },
    {
      category: t(locale, 'Recipes / Menu Mapping', 'الوصفات وربط المنيو'),
      count: 20,
      examples: ['Pizza dough', 'BBQ platter', 'Burger sauce', 'Breakfast buffet item'],
      purpose: t(locale, 'Prove production consumption, output, variance, and future POS-to-COGS mapping.', 'إثبات استهلاك الإنتاج والمخرجات والفروقات وربط المبيعات بالتكلفة لاحقًا.'),
    },
    {
      category: t(locale, 'Users / Roles', 'المستخدمون والصلاحيات'),
      count: 7,
      examples: ['Owner', 'Finance manager', 'Inventory manager', 'Branch manager', 'Storekeeper', 'Cashier', 'Auditor'],
      purpose: t(locale, 'Prove RBAC, branch scope, approval authority, and segregation of duties.', 'إثبات الصلاحيات ونطاق الفروع واعتماد العمليات وفصل المهام.'),
    },
  ];

  const steps: V451PilotStep[] = [
    {
      id: 'opening-balances',
      module: t(locale, 'Inventory / Finance', 'المخزون والمالية'),
      title: t(locale, 'Load opening stock and opening financial balances', 'تحميل أرصدة الافتتاح للمخزون والمالية'),
      actor: t(locale, 'Finance + Inventory manager', 'مدير المالية ومدير المخزون'),
      input: t(locale, 'Opening stock count file and opening trial balance.', 'ملف رصيد افتتاحي للمخزون وميزان مراجعة افتتاحي.'),
      expectedBackendProof: ['import_cutover_runs', 'inventory_rebuild_runs', 'posting_batches'],
      expectedReports: ['Opening stock valuation', 'Opening trial balance'],
      passCriteria: ['Import is approved', 'Duplicate import is blocked', 'Stock valuation matches opening ledger'],
      riskIfFailed: t(locale, 'All later reports will start from unreliable balances.', 'كل التقارير اللاحقة ستبدأ من أرصدة غير موثوقة.'),
      sequence: 1,
    },
    {
      id: 'purchase-invoice',
      module: t(locale, 'Purchasing', 'المشتريات'),
      title: t(locale, 'Post approved purchase invoice', 'ترحيل فاتورة مشتريات معتمدة'),
      actor: t(locale, 'Purchasing + Finance', 'المشتريات والمالية'),
      input: t(locale, 'Supplier invoice with inventory lines and VAT.', 'فاتورة مورد تحتوي أصناف مخزون وضريبة.'),
      expectedBackendProof: ['purchase_invoice_server_posting_events', 'posting_batches', 'inventory_stock_movements', 'ap_subledger_transactions', 'vat_transactions'],
      expectedReports: ['AP aging', 'Inventory valuation', 'VAT input report', 'Trial balance'],
      passCriteria: ['Journal is balanced', 'Inventory increased', 'AP increased', 'VAT input recorded', 'Duplicate posting blocked'],
      riskIfFailed: t(locale, 'Purchasing may not reconcile to inventory, AP, VAT, or GL.', 'قد لا تتطابق المشتريات مع المخزون والذمم والضريبة والأستاذ العام.'),
      sequence: 2,
    },
    {
      id: 'supplier-payment',
      module: t(locale, 'Payments', 'المدفوعات'),
      title: t(locale, 'Post supplier payment and allocate AP', 'ترحيل دفعة مورد وتخصيصها على الذمم'),
      actor: t(locale, 'Finance manager', 'مدير المالية'),
      input: t(locale, 'Approved supplier payment against posted invoices.', 'دفعة مورد معتمدة مقابل فواتير مرحلة.'),
      expectedBackendProof: ['supplier_payment_server_posting_events', 'supplier_payment_applications', 'ap_subledger_transactions', 'posting_batches'],
      expectedReports: ['Supplier statement', 'AP aging', 'Cash/bank ledger', 'Trial balance'],
      passCriteria: ['AP decreases', 'Bank/cash decreases', 'Oldest invoices allocated', 'Overpayment blocked unless allowed'],
      riskIfFailed: t(locale, 'Supplier balances and bank balances will be unreliable.', 'ستكون أرصدة الموردين والبنك غير موثوقة.'),
      sequence: 3,
    },
    {
      id: 'pos-day',
      module: t(locale, 'Sales / POS', 'المبيعات ونقاط البيع'),
      title: t(locale, 'Post reconciled POS day settlement', 'ترحيل تسوية يوم نقاط البيع'),
      actor: t(locale, 'Branch manager + Finance', 'مدير الفرع والمالية'),
      input: t(locale, 'POS/Foodics day batch with payment split and VAT.', 'دفعة يومية من نقاط البيع/فودكس مع طرق الدفع والضريبة.'),
      expectedBackendProof: ['pos_day_server_posting_events', 'posting_batches', 'finance_journal_lines_backend', 'vat_transactions'],
      expectedReports: ['Sales report', 'VAT output report', 'Payment settlement report', 'Trial balance'],
      passCriteria: ['Payments equal sales + VAT', 'Revenue posted', 'VAT output posted', 'Duplicate posting blocked'],
      riskIfFailed: t(locale, 'Sales, VAT, and payment settlement will not reconcile.', 'لن تتطابق المبيعات والضريبة وتسوية المدفوعات.'),
      sequence: 4,
    },
    {
      id: 'production-batch',
      module: t(locale, 'Production', 'الإنتاج'),
      title: t(locale, 'Post production batch consumption and output', 'ترحيل استهلاك ومخرجات أمر إنتاج'),
      actor: t(locale, 'Kitchen / Production manager', 'مدير المطبخ أو الإنتاج'),
      input: t(locale, 'Approved production batch with inputs, outputs, wastage, and yield.', 'أمر إنتاج معتمد بمدخلات ومخرجات وهالك ونسبة إنتاج.'),
      expectedBackendProof: ['production_batch_server_posting_events', 'inventory_stock_movements', 'posting_batches'],
      expectedReports: ['Production variance', 'Inventory valuation', 'COGS readiness'],
      passCriteria: ['Raw materials decrease', 'Outputs increase', 'Variance calculated', 'Journal balanced'],
      riskIfFailed: t(locale, 'Recipe cost, wastage, and stock valuation will be unreliable.', 'ستكون تكلفة الوصفات والهالك وتقييم المخزون غير موثوقة.'),
      sequence: 5,
    },
    {
      id: 'stock-count',
      module: t(locale, 'Inventory', 'المخزون'),
      title: t(locale, 'Post stock count / adjustment', 'ترحيل الجرد أو تسوية المخزون'),
      actor: t(locale, 'Inventory manager', 'مدير المخزون'),
      input: t(locale, 'Approved stock count variance or stock adjustment.', 'فرق جرد أو تسوية مخزون معتمدة.'),
      expectedBackendProof: ['stock_adjustment_server_posting_events', 'inventory_stock_movements', 'posting_batches'],
      expectedReports: ['Stock movement report', 'Inventory valuation', 'Stock variance account'],
      passCriteria: ['Stock variance posted', 'Balance updated', 'Negative stock blocked unless allowed'],
      riskIfFailed: t(locale, 'Inventory quantities and valuation cannot be trusted.', 'لا يمكن الوثوق بكميات وقيمة المخزون.'),
      sequence: 6,
    },
    {
      id: 'vat-close',
      module: t(locale, 'Finance', 'المالية'),
      title: t(locale, 'Post VAT settlement and close fiscal period', 'ترحيل تسوية الضريبة وإقفال الفترة'),
      actor: t(locale, 'Finance manager + Owner approval', 'مدير المالية مع اعتماد المالك'),
      input: t(locale, 'Month-end VAT input/output and closing checklist.', 'ضريبة المدخلات والمخرجات وقائمة إقفال الشهر.'),
      expectedBackendProof: ['vat_settlement_runs', 'finance_close_events', 'fiscal_periods'],
      expectedReports: ['VAT settlement', 'Trial balance', 'P&L', 'Balance sheet'],
      passCriteria: ['VAT payable/recoverable calculated', 'Unposted blockers checked', 'Period locked/closed', 'Reports frozen'],
      riskIfFailed: t(locale, 'Month-end reports cannot be signed off.', 'لا يمكن اعتماد تقارير نهاية الشهر.'),
      sequence: 7,
    },
    {
      id: 'backup-restore',
      module: t(locale, 'Administration', 'الإدارة'),
      title: t(locale, 'Backup and restore drill', 'اختبار النسخ الاحتياطي والاستعادة'),
      actor: t(locale, 'System admin', 'مدير النظام'),
      input: t(locale, 'Full platform ZIP backup and restore to staging/local.', 'نسخة احتياطية ZIP كاملة واستعادتها في بيئة اختبار.'),
      expectedBackendProof: ['backup_archive_runs', 'backup_restore_runs', 'backup_archive_events'],
      expectedReports: ['Restore verification summary', 'Data counts evidence'],
      passCriteria: ['Backup created', 'Restore preview verified', 'Counts match', 'Reports still reconcile'],
      riskIfFailed: t(locale, 'No recovery proof if production data is lost or corrupted.', 'لا يوجد دليل تعافٍ إذا فُقدت أو تلفت بيانات الإنتاج.'),
      sequence: 8,
    },
  ];

  const reconciliationChecks: V451ReconciliationCheck[] = [
    { id: 'tb-balanced', area: 'Finance', check: 'Trial balance debit equals credit', expectedResult: 'Difference = 0.00', evidenceSource: 'finance_reconciliation_runs / finance_journal_lines_backend', severity: 'critical' },
    { id: 'ap-aging', area: 'AP', check: 'AP aging equals posted supplier invoices minus payments', expectedResult: 'AP ledger agrees with supplier statements', evidenceSource: 'ap_subledger_transactions / supplier_payment_applications', severity: 'critical' },
    { id: 'inventory-value', area: 'Inventory', check: 'Inventory valuation equals stock movement ledger', expectedResult: 'No unexplained item/store variance', evidenceSource: 'inventory_stock_movements / inventory_rebuild_balances', severity: 'critical' },
    { id: 'vat', area: 'VAT', check: 'VAT report equals VAT input/output transactions', expectedResult: 'Settlement amount agrees with posted VAT records', evidenceSource: 'vat_transactions / vat_settlement_runs', severity: 'critical' },
    { id: 'pos-payments', area: 'Sales', check: 'POS payments equal sales + VAT', expectedResult: 'No payment-method mismatch', evidenceSource: 'pos_replay_applied_rows / pos_day_server_posting_events', severity: 'warning' },
    { id: 'backup-proof', area: 'Recovery', check: 'Backup restore drill was completed after posting scenario', expectedResult: 'Restored data counts and reports match baseline', evidenceSource: 'backup_restore_runs / backup_archive_events', severity: 'warning' },
  ];

  const operatorChecklist = [
    t(locale, 'Create users and assign roles/scopes before scenario execution.', 'إنشاء المستخدمين وتعيين الأدوار والنطاقات قبل تنفيذ السيناريو.'),
    t(locale, 'Load opening balances before operational postings.', 'تحميل الأرصدة الافتتاحية قبل الترحيلات التشغيلية.'),
    t(locale, 'Run each posting once, then attempt duplicate posting to confirm blocking.', 'تشغيل كل ترحيل مرة واحدة ثم محاولة التكرار للتأكد من المنع.'),
    t(locale, 'Export evidence after every major posting step.', 'تصدير الأدلة بعد كل خطوة ترحيل رئيسية.'),
    t(locale, 'Run report snapshot and finance reconciliation after scenario completion.', 'تشغيل لقطة التقارير والمطابقة المالية بعد انتهاء السيناريو.'),
    t(locale, 'Perform backup/restore drill before declaring pilot ready.', 'تنفيذ اختبار النسخ والاستعادة قبل إعلان جاهزية التشغيل التجريبي.'),
  ];

  const goNoGoRules = [
    t(locale, 'No go-live if trial balance is not balanced.', 'لا إطلاق إذا كان ميزان المراجعة غير متوازن.'),
    t(locale, 'No go-live if duplicate posting is not blocked.', 'لا إطلاق إذا لم يتم منع الترحيل المكرر.'),
    t(locale, 'No go-live if branch/RBAC scope is not proven.', 'لا إطلاق إذا لم يتم إثبات صلاحيات ونطاق الفروع.'),
    t(locale, 'No go-live if backup restore has not been tested.', 'لا إطلاق إذا لم يتم اختبار الاستعادة من النسخة الاحتياطية.'),
    t(locale, 'No go-live if reports cannot drill down to posted evidence.', 'لا إطلاق إذا لم تستطع التقارير الوصول إلى أدلة الترحيل.'),
  ];

  return {
    version: 'v451',
    title: t(locale, 'Real Pilot Scenario Pack', 'حزمة سيناريو التشغيل التجريبي الواقعي'),
    subtitle: t(locale, 'One-month operational proof for mid-range restaurant ERP readiness.', 'إثبات تشغيلي لشهر كامل لجاهزية نظام مطاعم متوسط الحجم.'),
    readinessScore: 78,
    entities,
    steps,
    reconciliationChecks,
    operatorChecklist,
    goNoGoRules,
    nextActions: [
      t(locale, 'Run this scenario locally after every major backend posting change.', 'تشغيل هذا السيناريو محليًا بعد كل تعديل كبير في الترحيل الخلفي.'),
      t(locale, 'Then repeat the same scenario in Supabase staging with real Auth users.', 'ثم تكرار نفس السيناريو في بيئة Supabase Staging بمستخدمين حقيقيين.'),
      t(locale, 'Only promote to production after all critical checks pass twice.', 'عدم الانتقال للإنتاج إلا بعد نجاح كل الفحوصات الحرجة مرتين.'),
    ],
  };
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

export function exportV451ScenarioCsv(pack: V451PilotScenarioPack): string {
  const rows = [
    ['Sequence', 'Step ID', 'Module', 'Title', 'Actor', 'Input', 'Backend Proof', 'Reports', 'Pass Criteria', 'Risk If Failed'],
    ...pack.steps.map((step) => [
      step.sequence,
      step.id,
      step.module,
      step.title,
      step.actor,
      step.input,
      step.expectedBackendProof.join('; '),
      step.expectedReports.join('; '),
      step.passCriteria.join('; '),
      step.riskIfFailed,
    ]),
  ];
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}

export function exportV451ReconciliationCsv(pack: V451PilotScenarioPack): string {
  const rows = [
    ['ID', 'Area', 'Severity', 'Check', 'Expected Result', 'Evidence Source'],
    ...pack.reconciliationChecks.map((check) => [
      check.id,
      check.area,
      check.severity,
      check.check,
      check.expectedResult,
      check.evidenceSource,
    ]),
  ];
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}

export function exportV451PackJson(pack: V451PilotScenarioPack): string {
  return JSON.stringify(pack, null, 2);
}
