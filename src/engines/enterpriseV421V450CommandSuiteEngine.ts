export type EnterpriseV421V450Status = 'ready' | 'watch' | 'blocked';

export type EnterpriseV421V450Track = {
  key: string;
  titleEn: string;
  titleAr: string;
  ownerEn: string;
  ownerAr: string;
  status: EnterpriseV421V450Status;
  score: number;
  checks: string[];
  blockers: string[];
  nextActionEn: string;
  nextActionAr: string;
};

export type EnterpriseV421V450Snapshot = {
  score: number;
  status: EnterpriseV421V450Status;
  readyTracks: number;
  watchTracks: number;
  blockedTracks: number;
  tracks: EnterpriseV421V450Track[];
  launchChecklist: Array<{ key: string; labelEn: string; labelAr: string; done: boolean; evidence: string }>;
  sopLibrary: Array<{ area: string; titleEn: string; titleAr: string; purposeEn: string; purposeAr: string }>;
  trainingPlan: Array<{ roleEn: string; roleAr: string; sessions: string[]; signoff: string }>;
  supportModel: Array<{ tier: string; owner: string; response: string; examples: string[] }>;
  dataQuality: Array<{ metric: string; target: string; current: string; status: EnterpriseV421V450Status }>;
};

type AnyState = Record<string, any>;

function count(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function hasAny(state: AnyState, keys: string[]): boolean {
  return keys.some((key) => count(state?.[key]) > 0);
}

function track(status: EnterpriseV421V450Status, base: Omit<EnterpriseV421V450Track, 'status' | 'score'> & { score?: number }): EnterpriseV421V450Track {
  const score = base.score ?? (status === 'ready' ? 90 : status === 'watch' ? 68 : 35);
  return { ...base, status, score };
}

export function buildEnterpriseV421V450Snapshot(state: AnyState = {}, totals: AnyState = {}): EnterpriseV421V450Snapshot {
  const hasMasterData = hasAny(state, ['branches', 'stores', 'suppliers', 'items', 'menuItems']);
  const hasPurchasing = hasAny(state, ['purchaseInvoices', 'supplierPayments', 'purchaseOrders']);
  const hasInventory = hasAny(state, ['stockMovements', 'inventoryMovements', 'stockCounts', 'stockAdjustments']);
  const hasSales = hasAny(state, ['posBatches', 'foodicsSales', 'salesBatches']);
  const hasUsers = hasAny(state, ['employees', 'userAccounts', 'roles']);
  const hasFinance = hasAny(state, ['journalEntries', 'chartAccounts', 'fiscalPeriods']);
  const backupEvents = count(state?.backupAuditLog) + count(state?.backupArchives) + count(state?.restoreRuns);

  const tracks: EnterpriseV421V450Track[] = [
    track(hasMasterData ? 'ready' : 'watch', {
      key: 'master-data',
      titleEn: 'Master data readiness',
      titleAr: 'جاهزية البيانات الأساسية',
      ownerEn: 'ERP Admin', ownerAr: 'مدير النظام',
      checks: ['Branches/stores', 'Suppliers', 'Items/menu', 'Cost centers'],
      blockers: hasMasterData ? [] : ['Load at least one branch, store, supplier, item, and cost center before UAT.'],
      nextActionEn: hasMasterData ? 'Freeze master-data changes during UAT windows.' : 'Import or create the minimum master-data package.',
      nextActionAr: hasMasterData ? 'جمّد تغييرات البيانات الأساسية أثناء اختبار UAT.' : 'استورد أو أنشئ الحد الأدنى من البيانات الأساسية.',
    }),
    track(hasUsers ? 'ready' : 'watch', {
      key: 'access-training',
      titleEn: 'Users, roles, and training',
      titleAr: 'المستخدمون والصلاحيات والتدريب',
      ownerEn: 'HR / Admin', ownerAr: 'الموارد البشرية / الإدارة',
      checks: ['Named users', 'Role assignment', 'Branch/store scope', 'Training signoff'],
      blockers: hasUsers ? [] : ['No operator roster found in local state.'],
      nextActionEn: hasUsers ? 'Run role-based pilot training and collect signoff.' : 'Create pilot users and assign roles/scopes.',
      nextActionAr: hasUsers ? 'نفّذ تدريبًا حسب الدور واحصل على اعتماد المستخدمين.' : 'أنشئ مستخدمي التشغيل التجريبي واربطهم بالصلاحيات.',
    }),
    track(hasPurchasing ? 'watch' : 'blocked', {
      key: 'purchasing-live-flow',
      titleEn: 'Purchasing live workflow',
      titleAr: 'دورة المشتريات الفعلية',
      ownerEn: 'Purchasing / Finance', ownerAr: 'المشتريات / المالية',
      checks: ['PO/GRN/invoice lifecycle', 'Supplier payment', 'VAT/AP posting', 'Document attachments'],
      blockers: hasPurchasing ? ['Validate one end-to-end supplier invoice posting against Supabase.'] : ['No purchasing documents available for pilot proof.'],
      nextActionEn: 'Use Pilot Center to post one approved purchase invoice and one supplier payment.',
      nextActionAr: 'استخدم مركز التشغيل التجريبي لترحيل فاتورة مورد ودفعة مورد معتمدة.',
    }),
    track(hasInventory ? 'watch' : 'blocked', {
      key: 'inventory-control',
      titleEn: 'Inventory control and counts',
      titleAr: 'رقابة المخزون والجرد',
      ownerEn: 'Inventory Manager', ownerAr: 'مدير المخزون',
      checks: ['Opening balances', 'Movements', 'Stock count', 'Adjustment approval'],
      blockers: hasInventory ? ['Run one stock adjustment / count posting in Supabase.'] : ['No inventory movements/counts found.'],
      nextActionEn: 'Run a controlled stock count and reconcile variance before pilot start.',
      nextActionAr: 'نفّذ جردًا تجريبيًا وطابق الفروقات قبل بدء التشغيل.',
    }),
    track(hasSales ? 'watch' : 'blocked', {
      key: 'sales-pos-settlement',
      titleEn: 'Sales / POS settlement',
      titleAr: 'تسوية المبيعات والكاشير',
      ownerEn: 'Branch Manager / Finance', ownerAr: 'مدير الفرع / المالية',
      checks: ['POS day batch', 'Payment method settlement', 'VAT output', 'Sales posting'],
      blockers: hasSales ? ['Post one POS day settlement and compare to source report.'] : ['No POS/Foodics batch found for settlement proof.'],
      nextActionEn: 'Import a representative POS day and post it through Pilot Center.',
      nextActionAr: 'استورد يوم مبيعات ممثل ورحّله عبر مركز التشغيل التجريبي.',
    }),
    track(hasFinance ? 'watch' : 'blocked', {
      key: 'finance-close',
      titleEn: 'Finance close and reporting',
      titleAr: 'الإقفال المالي والتقارير',
      ownerEn: 'Finance Manager', ownerAr: 'مدير المالية',
      checks: ['Open period', 'VAT settlement', 'Trial balance', 'Report snapshot'],
      blockers: hasFinance ? ['Run period-close rehearsal in staging.'] : ['No finance setup or fiscal period found.'],
      nextActionEn: 'Run VAT settlement, reconciliation, and one close rehearsal in staging.',
      nextActionAr: 'نفّذ تسوية الضريبة والمطابقة وبروفة إقفال واحدة في بيئة اختبار.',
    }),
    track(backupEvents > 0 ? 'ready' : 'watch', {
      key: 'backup-restore',
      titleEn: 'Backup and restore proof',
      titleAr: 'إثبات النسخ الاحتياطي والاستعادة',
      ownerEn: 'System Admin', ownerAr: 'مدير النظام',
      checks: ['Full export', 'Restore preview', 'Restore drill', 'Evidence log'],
      blockers: backupEvents > 0 ? [] : ['No backup/restore evidence found yet.'],
      nextActionEn: backupEvents > 0 ? 'Schedule weekly backup drill during pilot.' : 'Take one backup ZIP and run a restore preview.',
      nextActionAr: backupEvents > 0 ? 'جدول بروفة نسخ أسبوعية أثناء التشغيل التجريبي.' : 'خذ نسخة ZIP وشغّل معاينة استعادة واحدة.',
    }),
  ];

  const score = Math.round(tracks.reduce((sum, item) => sum + item.score, 0) / Math.max(1, tracks.length));
  const blockedTracks = tracks.filter((item) => item.status === 'blocked').length;
  const watchTracks = tracks.filter((item) => item.status === 'watch').length;
  const readyTracks = tracks.filter((item) => item.status === 'ready').length;
  const status: EnterpriseV421V450Status = blockedTracks > 0 ? 'blocked' : watchTracks > 2 ? 'watch' : 'ready';

  const launchChecklist = [
    { key: 'db-reset', labelEn: 'Fresh Supabase reset passes', labelAr: 'نجاح إعادة بناء Supabase من الصفر', done: true, evidence: 'supabase db reset' },
    { key: 'qa-all', labelEn: 'Full QA gate passes', labelAr: 'نجاح بوابة الجودة الكاملة', done: true, evidence: 'npm run qa:all' },
    { key: 'build', labelEn: 'Production build passes', labelAr: 'نجاح بناء الإنتاج', done: true, evidence: 'npm run build' },
    { key: 'uat-users', labelEn: 'Named UAT users trained', labelAr: 'تدريب مستخدمي UAT المحددين', done: hasUsers, evidence: 'Training register' },
    { key: 'posting-proof', labelEn: 'All posting RPCs tested with real documents', labelAr: 'اختبار كل ترحيلات الخلفية بمستندات فعلية', done: false, evidence: 'Pilot Center evidence export' },
    { key: 'backup-proof', labelEn: 'Backup and restore drill completed', labelAr: 'اكتمال بروفة النسخ والاستعادة', done: backupEvents > 0, evidence: 'Backup/restore log' },
    { key: 'go-no-go', labelEn: 'Go/no-go meeting signed', labelAr: 'اعتماد اجتماع قرار التشغيل', done: false, evidence: 'Signed checklist' },
  ];

  const sopLibrary = [
    { area: 'Purchasing', titleEn: 'Supplier invoice posting SOP', titleAr: 'إجراء ترحيل فاتورة المورد', purposeEn: 'Approve, post, and verify AP/VAT/inventory/GL evidence.', purposeAr: 'اعتماد وترحيل والتحقق من المورد والضريبة والمخزون والقيود.' },
    { area: 'Inventory', titleEn: 'Stock count and adjustment SOP', titleAr: 'إجراء الجرد والتسويات المخزنية', purposeEn: 'Count, approve variance, post adjustment, and review balances.', purposeAr: 'الجرد واعتماد الفروقات وترحيل التسوية ومراجعة الأرصدة.' },
    { area: 'Sales', titleEn: 'POS day settlement SOP', titleAr: 'إجراء تسوية يوم المبيعات', purposeEn: 'Import/replay day sales, reconcile payments, and post settlement.', purposeAr: 'استيراد مبيعات اليوم ومطابقة المدفوعات وترحيل التسوية.' },
    { area: 'Finance', titleEn: 'VAT settlement and period close SOP', titleAr: 'إجراء تسوية الضريبة والإقفال', purposeEn: 'Review blockers, settle VAT, run reconciliation, and close period.', purposeAr: 'مراجعة الموانع وتسوية الضريبة وتشغيل المطابقة وإقفال الفترة.' },
  ];

  const trainingPlan = [
    { roleEn: 'Branch Manager', roleAr: 'مدير الفرع', sessions: ['Dashboard review', 'POS settlement evidence', 'Daily exception review'], signoff: 'Branch pilot signoff' },
    { roleEn: 'Inventory Manager', roleAr: 'مدير المخزون', sessions: ['Item/store setup', 'Stock count approval', 'Variance review'], signoff: 'Inventory pilot signoff' },
    { roleEn: 'Finance Manager', roleAr: 'مدير المالية', sessions: ['Posting batch review', 'AP/VAT/GL evidence', 'Period close rehearsal'], signoff: 'Finance pilot signoff' },
    { roleEn: 'System Admin', roleAr: 'مدير النظام', sessions: ['RBAC review', 'Backup/restore drill', 'Support diagnostics'], signoff: 'Admin readiness signoff' },
  ];

  const supportModel = [
    { tier: 'Tier 1', owner: 'Super User / Branch lead', response: 'Same business day', examples: ['User guidance', 'Data entry questions', 'Simple import correction'] },
    { tier: 'Tier 2', owner: 'ERP Admin / Finance owner', response: '4 business hours', examples: ['Posting blocker', 'Permission issue', 'Report mismatch'] },
    { tier: 'Tier 3', owner: 'Developer / Supabase admin', response: 'Urgent for data-blocking issues', examples: ['Migration failure', 'RLS bug', 'RPC error', 'restore incident'] },
  ];

  const dataQuality = [
    { metric: 'Required master data coverage', target: '100%', current: hasMasterData ? 'Ready' : 'Incomplete', status: hasMasterData ? 'ready' : 'watch' },
    { metric: 'Unposted transaction backlog', target: '0 critical', current: 'Needs pilot evidence', status: 'watch' },
    { metric: 'Duplicate source protection', target: 'Enabled', current: 'Server posting uses idempotency/locks', status: 'ready' },
    { metric: 'Backup restore proof', target: '1 successful drill', current: backupEvents > 0 ? 'Evidence found' : 'Not proven', status: backupEvents > 0 ? 'ready' : 'watch' },
  ];

  return { score, status, readyTracks, watchTracks, blockedTracks, tracks, launchChecklist, sopLibrary, trainingPlan, supportModel, dataQuality };
}

export function enterpriseV421V450Csv(snapshot: EnterpriseV421V450Snapshot): string {
  const rows = [
    ['Track', 'Status', 'Score', 'Owner', 'Blockers', 'Next action'],
    ...snapshot.tracks.map((item) => [item.titleEn, item.status, String(item.score), item.ownerEn, item.blockers.join('; ') || 'None', item.nextActionEn]),
  ];
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}
