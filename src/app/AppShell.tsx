import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { safeLoad, safeSave } from '../utils/safeStorage';

import { financeTabDefinitions, type FinanceTab } from '../modules/finance/financeTabs';
import { evaluateFinanceTruthLayer, FINANCE_POSTING_CONTRACTS } from '../modules/finance/financeTruthLayer';
import { normalizeImportKey, numberValue, parseCsvText } from '../modules/imports/importCsvUtils';

const FoodicsSalesPage = lazy(() => import('../modules/FoodicsSalesPage'));
const EnterpriseV367UpgradePage = lazy(() => import('../modules/EnterpriseV367UpgradePage'));
const EnterpriseV371WorkloadPage = lazy(() => import('../modules/EnterpriseV371WorkloadPage'));
const EnterpriseV381BackupPage = lazy(() => import('../modules/EnterpriseV381BackupPage'));
const EnterpriseV382BackendModePage = lazy(() => import('../modules/EnterpriseV382BackendModePage'));
const EnterpriseV383RBACPage = lazy(() => import('../modules/EnterpriseV383RBACPage'));
const EnterpriseV384SourceOfTruthPage = lazy(() => import('../modules/EnterpriseV384SourceOfTruthPage'));
const EnterpriseV385PurchasingGatePage = lazy(() => import('../modules/EnterpriseV385PurchasingGatePage'));
const EnterpriseV386InventoryGatePage = lazy(() => import('../modules/EnterpriseV386InventoryGatePage'));
const EnterpriseV387SalesGatePage = lazy(() => import('../modules/EnterpriseV387SalesGatePage'));
const EnterpriseV388ProductionGatePage = lazy(() => import('../modules/EnterpriseV388ProductionGatePage'));
const EnterpriseV389FinanceCloseGatePage = lazy(() => import('../modules/EnterpriseV389FinanceCloseGatePage'));
const EnterpriseV390HRGatePage = lazy(() => import('../modules/EnterpriseV390HRGatePage'));
const EnterpriseV391V394OperationalConfidencePage = lazy(() => import('../modules/EnterpriseV391V394OperationalConfidencePage'));
const EnterpriseV395V400ProductionReadinessPage = lazy(() => import('../modules/EnterpriseV395V400ProductionReadinessPage'));
const EnterpriseV456V470RestaurantOpsPage = lazy(() => import('../modules/EnterpriseV456V470RestaurantOpsPage'));
const SmartAnalysisRoutePage = lazy(() => import('../modules/analytics/SmartAnalysisPage'));
const ReportsRoutePage = lazy(() => import('../modules/reports/ReportsPage'));
const ImportExportRoutePage = lazy(() => import('../modules/imports/ImportExportPage'));

import {
  Activity,
  Archive,
  BadgeDollarSign,
  Banknote,
  BarChart3,
  BookOpen,
  BrainCircuit,
  Building2,
  Calculator,
  ChefHat,
  ClipboardCheck,
  Coins,
  CreditCard,
  Database,
  Download,
  Edit3,
  Factory,
  FileSpreadsheet,
  FileText,
  Landmark,
  Layers,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  PackageCheck,
  PieChart,
  Plus,
  ReceiptText,
  RefreshCw,
  Rocket,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  ShoppingCart,
  Store,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';

type Locale = 'en' | 'ar';
type Direction = 'in' | 'out';
type RoleScope = 'all' | 'branch' | 'store' | 'cost_center';
type PaymentType = 'credit' | 'cash' | 'bank' | 'partial';
type RouteKey = 'dashboard' | 'smartAnalysis' | 'setup' | 'access' | 'users' | 'inventory' | 'inventoryGate' | 'purchasing' | 'purchasingGate' | 'production' | 'productionGate' | 'sales' | 'salesGate' | 'finance' | 'financeCloseGate' | 'hr' | 'hrGate' | 'imports' | 'controls' | 'enterprise' | 'workload' | 'backup' | 'backend' | 'rbac' | 'truth' | 'reports' | 'reportPackGate' | 'alertsGate' | 'supportGate' | 'performanceGate' | 'tabletGate' | 'deploymentGate' | 'uatGate' | 'securityGate' | 'rehearsalGate' | 'releaseGate' | 'restaurantOps';
type SetupTab = 'branches' | 'stores' | 'suppliers' | 'categories' | 'items' | 'menu' | 'recipes' | 'costCenters';
type InventoryTab = 'command' | 'availability' | 'balances' | 'items' | 'locations' | 'lots' | 'transfers' | 'openingStock' | 'stockCount' | 'adjustments' | 'approvals' | 'quarantine' | 'returns' | 'reconciliation' | 'ledger';
type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'cogs' | 'expense' | 'other_income' | 'other_expense';
type JournalStatus = 'draft' | 'posted' | 'reversed';
type PurchasingTab = 'control' | 'requests' | 'orders' | 'receiving' | 'invoices' | 'payments' | 'register' | 'documents';
type WorkflowStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'converted' | 'posted' | 'closed' | 'cancelled';

type Branch = { id: string; code: string; nameEn: string; nameAr: string; location: string; active: boolean };
type StoreLocation = { id: string; code: string; nameEn: string; nameAr: string; branchId: string | 'main'; type: string; active: boolean };
type Supplier = { id: string; code: string; name: string; vatNo: string; paymentTerms: string; contactName: string; phone: string; email: string; bankName: string; bankAccount: string; representativeName: string; representativePhone: string; active: boolean };
type Item = { id: string; sku: string; nameEn: string; nameAr: string; category: string; purchaseUnit: string; consumptionUnit: string; conversionFactor: number; standardCost?: number; minStock: number; maxStock: number; reorderPoint: number; isSemiFinished: boolean; active: boolean };
type MenuItem = { id: string; code: string; nameEn: string; nameAr: string; category: string; sellingPrice: number; vatRate: number; priceIncludesVat: boolean; active: boolean };
type CategoryKind = 'item' | 'menu';
type MasterCategory = { id: string; kind: CategoryKind; nameEn: string; nameAr: string; active: boolean };
type RecipeLine = { id: string; menuItemId: string; itemId: string; qty: number; unit: string; wastagePct: number; note?: string };
type CostCenter = { id: string; code: string; nameEn: string; nameAr: string; branchId: string | 'company'; budget: number; active: boolean };
type Employee = { id: string; code: string; name: string; branchId: string | 'company'; department: string; jobTitle: string; salary: number; active: boolean };
type AppUser = { id: string; employeeId: string; email: string; displayName: string; status: 'invited' | 'active' | 'disabled'; authProvider: 'local' | 'supabase'; mustChangePassword: boolean; createdAt: string; lastLoginAt?: string; active: boolean };
type Role = { id: string; nameEn: string; nameAr: string; description: string; permissions: string[] };
type UserAccess = { id: string; employeeId: string; roleId: string; scopeType: RoleScope; scopeId: string | 'all' };
type StockMovement = { id: string; date: string; type: string; storeId: string; itemId: string; direction: Direction; qty: number; unitCost: number; ref: string; note: string; lotNo?: string; binCode?: string; expiryDate?: string; supplierId?: string };
type ChartAccount = { id: string; code: string; nameEn: string; nameAr: string; type: AccountType; parentCode?: string; active: boolean; requireCostCenter?: boolean };
type JournalLine = { id: string; accountCode: string; debit: number; credit: number; branchId?: string | 'company'; costCenterId?: string | 'company'; memo: string };
type JournalEntry = { id: string; date: string; ref: string; source: string; description: string; status: JournalStatus; lines: JournalLine[] };
type PurchaseInvoiceLine = { id: string; itemId: string; qty: number; unitCost: number; vatRate: number; discount: number; lotNo?: string; batchNo?: string; binCode?: string; expiryDate?: string };
type PurchaseInvoice = { id: string; ref: string; invoiceNo: string; supplierId: string; branchId: string; storeId: string; costCenterId?: string | 'company'; invoiceDate: string; deliveryDate: string; paymentType: PaymentType; paidAmount: number; status: 'draft' | 'posted' | 'cancelled'; lines: PurchaseInvoiceLine[] };
type MaterialRequestLine = { id: string; itemId: string; qty: number; note: string };
type MaterialRequest = { id: string; ref: string; date: string; branchId: string; storeId: string; requestedBy: string; neededBy: string; status: WorkflowStatus; lines: MaterialRequestLine[]; note: string };
type PurchaseOrderLine = { id: string; itemId: string; qty: number; unitCost: number; vatRate: number; receivedQty: number; invoicedQty: number };
type PurchaseOrder = { id: string; ref: string; date: string; supplierId: string; branchId: string; storeId: string; requestRef?: string; eta: string; status: 'draft' | 'approved' | 'partially_received' | 'received' | 'closed' | 'cancelled'; lines: PurchaseOrderLine[]; note: string };
type GoodsReceiptLine = { id: string; itemId: string; qty: number; unitCost: number; lotNo: string; batchNo: string; binCode: string; expiryDate: string };
type GoodsReceipt = { id: string; ref: string; date: string; poId: string; supplierId: string; storeId: string; status: 'draft' | 'posted' | 'cancelled'; lines: GoodsReceiptLine[] };
type SupplierPayment = { id: string; ref: string; date: string; supplierId: string; amount: number; method: 'cash' | 'bank'; accountCode: '1010' | '1020'; status: 'draft' | 'posted' | 'cancelled'; note: string; invoiceRef?: string };
type ProductionLine = { id: string; itemId: string; plannedQty: number; actualQty: number; unit: string; wastagePct: number };
type ProductionRecipeLine = { id: string; itemId: string; qty: number; unit: string; wastagePct: number };
type ProductionRecipe = { id: string; code: string; nameEn: string; nameAr: string; outputItemId: string; baseOutputQty: number; outputUnit: string; defaultExpiryDays: number; active: boolean; lines: ProductionRecipeLine[] };
type ProductionDoc = { id: string; date: string; ref: string; recipeId?: string; sourceStoreId: string; destinationStoreId: string; outputItemId: string; plannedOutputQty: number; actualOutputQty: number; expiryDate?: string; status: 'draft' | 'posted'; lines: ProductionLine[] };
type SaleDoc = { id: string; date: string; ref: string; branchId: string; storeId: string; menuItemId: string; qty: number; paymentMethod: string; posted: boolean };
type TransferDoc = { id: string; date: string; ref: string; fromStoreId: string; toStoreId: string; itemId: string; qty: number; posted: boolean };
type AttendanceLog = { id: string; employeeId: string; date: string; type: 'punch_in' | 'punch_out'; time: string; source: 'manual' | 'pos_shift' };
type ShiftSchedule = { id: string; employeeId: string; date: string; start: string; end: string; branchId: string };
type FixedAsset = { id: string; code: string; name: string; category: string; branchId: string | 'company'; costCenterId: string | 'company'; purchaseDate: string; cost: number; usefulLifeMonths: number; salvageValue: number; accumulatedDepreciation: number; active: boolean };
type ARInvoice = { id: string; ref: string; customer: string; date: string; branchId: string; amount: number; vatRate: number; paidAmount: number; status: 'open' | 'paid' };
type AuditLog = { id: string; at: string; action: string; entity: string; ref: string; user: string; note: string };
type BinLocation = { id: string; storeId: string; code: string; zone: string; type: string; active: boolean };
type InventoryLotStatus = 'available' | 'quarantine' | 'expired' | 'returned' | 'consumed';
type InventoryLot = { id: string; storeId: string; itemId: string; lotNo: string; batchNo: string; binCode: string; receivedDate: string; expiryDate: string; qty: number; unitCost: number; status: InventoryLotStatus; sourceRef: string; supplierId?: string; note?: string };
type InventoryApprovalStatus = 'pending' | 'approved' | 'rejected' | 'posted';
type InventoryApproval = { id: string; ref: string; date: string; requestType: 'adjustment' | 'count_variance'; status: InventoryApprovalStatus; storeId: string; itemId: string; direction: Direction; qty: number; countedQty?: number; systemQty?: number; unitCost: number; costCenterId: string | 'company'; reason: string; note: string; requestedBy: string; approvedBy?: string; postedRef?: string };
type InventoryReservationStatus = 'reserved' | 'issued' | 'released' | 'cancelled';
type InventoryReservation = { id: string; ref: string; date: string; requestId: string; requestRef: string; requestLineId: string; storeId: string; itemId: string; qty: number; status: InventoryReservationStatus; reservedBy: string; issuedAt?: string; note: string };
type FulfillmentMode = 'store_transfer' | 'internal_issue' | 'production_issue';
type InternalStockIssue = { id: string; ref: string; date: string; requestId: string; requestRef: string; fromStoreId: string; toStoreId: string; itemId: string; qty: number; status: 'posted' | 'cancelled'; fulfillmentMode?: FulfillmentMode; transferId?: string; movementOutId?: string; movementInId?: string; note: string };
type SupplierReturnDoc = { id: string; ref: string; date: string; supplierId: string; storeId: string; itemId: string; qty: number; unitCost: number; reason: string; status: 'draft' | 'posted'; sourceLotId?: string; creditType: 'ap_credit' | 'cash_refund' | 'replacement' };
type FiscalPeriod = { id: string; code: string; nameEn: string; nameAr: string; startDate: string; endDate: string; status: 'open' | 'locked' | 'closed'; lockedBy?: string; lockedAt?: string };
type BankReconLine = { id: string; date: string; bankAccountCode: string; description: string; statementAmount: number; matchedJournalRef?: string; status: 'unmatched' | 'matched' | 'adjustment_needed' };
type ImportProfile = { id: string; name: string; importType: string; fileType: 'csv' | 'xlsx'; mappings: Record<string, string>; duplicateKey: string; requiresApproval: boolean };


type ERPState = {
  branches: Branch[];
  stores: StoreLocation[];
  suppliers: Supplier[];
  items: Item[];
  menuItems: MenuItem[];
  itemCategories: MasterCategory[];
  menuCategories: MasterCategory[];
  recipeLines: RecipeLine[];
  costCenters: CostCenter[];
  employees: Employee[];
  userAccounts: AppUser[];
  roles: Role[];
  userAccess: UserAccess[];
  stockMovements: StockMovement[];
  chartAccounts: ChartAccount[];
  journals: JournalEntry[];
  purchaseInvoices: PurchaseInvoice[];
  materialRequests: MaterialRequest[];
  purchaseOrders: PurchaseOrder[];
  goodsReceipts: GoodsReceipt[];
  supplierPayments: SupplierPayment[];
  productionRecipes: ProductionRecipe[];
  productions: ProductionDoc[];
  sales: SaleDoc[];
  transfers: TransferDoc[];
  attendance: AttendanceLog[];
  schedules: ShiftSchedule[];
  fixedAssets: FixedAsset[];
  arInvoices: ARInvoice[];
  audits: AuditLog[];
  binLocations: BinLocation[];
  inventoryLots: InventoryLot[];
  inventoryApprovals: InventoryApproval[];
  inventoryReservations: InventoryReservation[];
  internalStockIssues: InternalStockIssue[];
  supplierReturns: SupplierReturnDoc[];
  fiscalPeriods: FiscalPeriod[];
  bankReconLines: BankReconLine[];
  importProfiles: ImportProfile[];
  activeUserId?: string;
};

type Toast = { type: 'success' | 'warning' | 'error'; message: string } | null;

type Totals = {
  salesNet: number;
  salesGross: number;
  cogs: number;
  grossProfit: number;
  stockValue: number;
  ap: number;
  ar: number;
  cash: number;
  vatInput: number;
  vatOutput: number;
  vatPayable: number;
  assets: number;
  liabilities: number;
  equity: number;
  expenses: number;
  netIncome: number;
};

const emptyState: ERPState = {
  branches: [], stores: [], suppliers: [], items: [], menuItems: [], itemCategories: [], menuCategories: [], recipeLines: [], costCenters: [], employees: [], userAccounts: [], roles: [], userAccess: [],
  stockMovements: [], chartAccounts: [], journals: [], purchaseInvoices: [], materialRequests: [], purchaseOrders: [], goodsReceipts: [], supplierPayments: [], productionRecipes: [], productions: [], sales: [], transfers: [], attendance: [], schedules: [], fixedAssets: [], arInvoices: [], audits: [], binLocations: [], inventoryLots: [], inventoryApprovals: [], inventoryReservations: [], internalStockIssues: [], supplierReturns: [], fiscalPeriods: [], bankReconLines: [], importProfiles: [], activeUserId: undefined,
};

const STORAGE_KEY = 'restaurant-erp-v302-users-employee-link';
const ARRAY_STATE_KEYS = Object.keys(emptyState).filter((key) => Array.isArray((emptyState as any)[key]));

function normalizeERPState(value: unknown): ERPState {
  const candidate = value && typeof value === 'object' ? value as Partial<ERPState> : {};
  const normalized = { ...emptyState, ...candidate } as ERPState;
  ARRAY_STATE_KEYS.forEach((key) => {
    if (!Array.isArray((normalized as any)[key])) (normalized as any)[key] = [];
  });
  return normalized;
}

const permissionCatalog = [
  { key: 'dashboard.view', moduleEn: 'Dashboard', moduleAr: 'لوحة التحكم', labelEn: 'View dashboards', labelAr: 'عرض لوحات التحكم' },
  { key: 'settings.master.manage', moduleEn: 'Setup', moduleAr: 'الإعداد', labelEn: 'Manage master data', labelAr: 'إدارة البيانات الأساسية' },
  { key: 'inventory.view', moduleEn: 'Inventory', moduleAr: 'المخزون', labelEn: 'View inventory', labelAr: 'عرض المخزون' },
  { key: 'inventory.transfer.post', moduleEn: 'Inventory', moduleAr: 'المخزون', labelEn: 'Post stock transfers', labelAr: 'ترحيل تحويلات المخزون' },
  { key: 'inventory.reservation.manage', moduleEn: 'Inventory', moduleAr: 'المخزون', labelEn: 'Manage stock reservations and internal issues', labelAr: 'إدارة حجز المخزون والصرف الداخلي' },
  { key: 'inventory.adjustment.request', moduleEn: 'Inventory', moduleAr: 'المخزون', labelEn: 'Request adjustments/count variances', labelAr: 'طلب تسويات وفروقات جرد' },
  { key: 'inventory.adjustment.approve', moduleEn: 'Inventory', moduleAr: 'المخزون', labelEn: 'Approve inventory adjustments', labelAr: 'اعتماد تسويات المخزون' },
  { key: 'purchasing.invoice.create', moduleEn: 'Purchasing', moduleAr: 'المشتريات', labelEn: 'Create purchase invoices', labelAr: 'إنشاء فواتير شراء' },
  { key: 'purchasing.invoice.post', moduleEn: 'Purchasing', moduleAr: 'المشتريات', labelEn: 'Post purchase invoices', labelAr: 'ترحيل فواتير الشراء' },
  { key: 'purchasing.po.approve', moduleEn: 'Purchasing', moduleAr: 'المشتريات', labelEn: 'Approve purchase orders', labelAr: 'اعتماد أوامر الشراء' },
  { key: 'purchasing.grn.post', moduleEn: 'Purchasing', moduleAr: 'المشتريات', labelEn: 'Post goods receipts', labelAr: 'ترحيل سندات الاستلام' },
  { key: 'purchasing.payment.post', moduleEn: 'Purchasing', moduleAr: 'المشتريات', labelEn: 'Post supplier payments', labelAr: 'ترحيل مدفوعات الموردين' },
  { key: 'production.recipe.manage', moduleEn: 'Production', moduleAr: 'الإنتاج', labelEn: 'Manage production recipes', labelAr: 'إدارة وصفات الإنتاج' },
  { key: 'production.batch.create', moduleEn: 'Production', moduleAr: 'الإنتاج', labelEn: 'Create production batches', labelAr: 'إنشاء دفعات الإنتاج' },
  { key: 'production.batch.post', moduleEn: 'Production', moduleAr: 'الإنتاج', labelEn: 'Post production batches', labelAr: 'ترحيل دفعات الإنتاج' },
  { key: 'production.variance.view', moduleEn: 'Production', moduleAr: 'الإنتاج', labelEn: 'View production variance', labelAr: 'عرض انحرافات الإنتاج' },
  { key: 'sales.post', moduleEn: 'Sales / POS', moduleAr: 'المبيعات / الكاشير', labelEn: 'Post sales and deduct recipes', labelAr: 'ترحيل المبيعات وخصم الوصفات' },
  { key: 'pos.shift.open', moduleEn: 'Sales / POS', moduleAr: 'المبيعات / الكاشير', labelEn: 'Open cashier shift', labelAr: 'فتح وردية كاشير' },
  { key: 'finance.view', moduleEn: 'Finance', moduleAr: 'المالية', labelEn: 'View finance', labelAr: 'عرض المالية' },
  { key: 'finance.journal.create', moduleEn: 'Finance', moduleAr: 'المالية', labelEn: 'Create manual GL entries', labelAr: 'إنشاء قيود يومية يدوية' },
  { key: 'finance.journal.post', moduleEn: 'Finance', moduleAr: 'المالية', labelEn: 'Post journals', labelAr: 'ترحيل القيود' },
  { key: 'finance.statements.view', moduleEn: 'Finance', moduleAr: 'المالية', labelEn: 'View statements', labelAr: 'عرض القوائم المالية' },
  { key: 'finance.assets.manage', moduleEn: 'Finance', moduleAr: 'المالية', labelEn: 'Manage fixed assets', labelAr: 'إدارة الأصول الثابتة' },
  { key: 'finance.bank.reconcile', moduleEn: 'Finance', moduleAr: 'المالية', labelEn: 'Bank reconciliation', labelAr: 'مطابقة البنوك' },
  { key: 'finance.period.lock', moduleEn: 'Finance', moduleAr: 'المالية', labelEn: 'Lock fiscal periods', labelAr: 'قفل الفترات المالية' },
  { key: 'finance.opening.post', moduleEn: 'Finance', moduleAr: 'المالية', labelEn: 'Post opening balances', labelAr: 'ترحيل الأرصدة الافتتاحية' },
  { key: 'finance.payment_run.post', moduleEn: 'Finance', moduleAr: 'المالية', labelEn: 'Post AP payment runs', labelAr: 'ترحيل دفعات الموردين' },
  { key: 'access.user.create', moduleEn: 'Access Control', moduleAr: 'الصلاحيات', labelEn: 'Create users and linked employees', labelAr: 'إنشاء المستخدمين والموظفين المرتبطين' },
  { key: 'access.user.manage', moduleEn: 'Access Control', moduleAr: 'الصلاحيات', labelEn: 'Manage user accounts', labelAr: 'إدارة حسابات المستخدمين' },
  { key: 'hr.employee.manage', moduleEn: 'HR', moduleAr: 'الموارد البشرية', labelEn: 'Manage employees', labelAr: 'إدارة الموظفين' },
  { key: 'hr.attendance.punch_own', moduleEn: 'HR', moduleAr: 'الموارد البشرية', labelEn: 'Punch in/out', labelAr: 'تسجيل الحضور والانصراف' },
  { key: 'imports.manage', moduleEn: 'Import / Export', moduleAr: 'الاستيراد والتصدير', labelEn: 'Import and export data', labelAr: 'استيراد وتصدير البيانات' },
  { key: 'access.manage', moduleEn: 'Access Control', moduleAr: 'الصلاحيات', labelEn: 'Manage roles and access', labelAr: 'إدارة الأدوار والصلاحيات' },
];

const routeMeta: Record<RouteKey, { en: string; ar: string; icon: typeof LayoutDashboard }> = {
  dashboard: { en: 'Executive Dashboard', ar: 'لوحة القيادة التنفيذية', icon: LayoutDashboard },
  smartAnalysis: { en: 'Smart Analysis', ar: 'التحليل الذكي', icon: BrainCircuit },
  setup: { en: 'Setup', ar: 'الإعدادات الأساسية', icon: Building2 },
  access: { en: 'Access Control', ar: 'الصلاحيات', icon: ShieldCheck },
  users: { en: 'Users & Employees', ar: 'المستخدمون والموظفون', icon: UserPlus },
  inventory: { en: 'Inventory', ar: 'المخزون', icon: Archive },
  inventoryGate: { en: 'Inventory Gate', ar: 'بوابة المخزون', icon: PackageCheck },
  purchasing: { en: 'Purchasing', ar: 'المشتريات', icon: ShoppingCart },
  purchasingGate: { en: 'Purchasing Gate', ar: 'بوابة المشتريات', icon: PackageCheck },
  production: { en: 'Production / Prep', ar: 'الإنتاج والتحضير', icon: Factory },
  productionGate: { en: 'Production Gate', ar: 'بوابة الإنتاج', icon: Factory },
  sales: { en: 'Sales / POS Trial', ar: 'تجربة المبيعات والكاشير', icon: CreditCard },
  salesGate: { en: 'Sales Gate', ar: 'بوابة المبيعات', icon: ShoppingCart },
  finance: { en: 'Finance', ar: 'المالية', icon: Landmark },
  financeCloseGate: { en: 'Finance Close Gate', ar: 'بوابة الإغلاق المالي', icon: Landmark },
  hr: { en: 'HR & Attendance', ar: 'الموارد البشرية والحضور', icon: Users },
  hrGate: { en: 'HR Gate', ar: 'بوابة الموارد البشرية', icon: Users },
  imports: { en: 'Import / Export', ar: 'الاستيراد والتصدير', icon: FileSpreadsheet },
  controls: { en: 'Control Center', ar: 'مركز الرقابة', icon: ShieldCheck },
  enterprise: { en: 'Enterprise Upgrade', ar: 'Enterprise Upgrade', icon: Rocket },
  workload: { en: 'Workload Ops', ar: 'Workload Ops', icon: Activity },
  backup: { en: 'Backup / Restore', ar: 'النسخ الاحتياطي والاستعادة', icon: Database },
  backend: { en: 'Backend Mode', ar: 'نمط الخلفية', icon: Database },
  rbac: { en: 'RBAC Gate', ar: 'بوابة الصلاحيات', icon: ShieldCheck },
  truth: { en: 'Source of Truth', ar: 'مصدر الحقيقة', icon: Database },
  reports: { en: 'Reports', ar: 'التقارير', icon: BarChart3 },
  reportPackGate: { en: 'Report Pack Gate', ar: 'بوابة حزم التقارير', icon: BarChart3 },
  alertsGate: { en: 'Alerts Gate', ar: 'بوابة التنبيهات', icon: ShieldCheck },
  supportGate: { en: 'Support Gate', ar: 'بوابة الدعم', icon: Database },
  performanceGate: { en: 'Performance Gate', ar: 'بوابة الأداء', icon: Activity },
  tabletGate: { en: 'Tablet Gate', ar: 'بوابة الأجهزة اللوحية', icon: LayoutDashboard },
  deploymentGate: { en: 'Deployment Gate', ar: 'بوابة النشر', icon: Rocket },
  uatGate: { en: 'UAT Gate', ar: 'بوابة اختبار القبول', icon: ClipboardCheck },
  securityGate: { en: 'Security Gate', ar: 'بوابة الأمن', icon: ShieldCheck },
  rehearsalGate: { en: 'Rehearsal Gate', ar: 'بوابة تجربة الإطلاق', icon: Activity },
  releaseGate: { en: 'Release Gate', ar: 'بوابة الإطلاق التجريبي', icon: Rocket },
  restaurantOps: { en: 'Restaurant Flow', ar: 'دورة تشغيل المطعم', icon: Store },
};

const routeGroups: Array<{ en: string; ar: string; keys: RouteKey[] }> = [
  { en: 'Command', ar: 'القيادة', keys: ['dashboard', 'smartAnalysis', 'enterprise', 'workload', 'controls', 'reports', 'reportPackGate', 'alertsGate', 'performanceGate', 'uatGate', 'releaseGate'] },
  { en: 'Operations', ar: 'التشغيل', keys: ['sales', 'salesGate', 'inventory', 'inventoryGate', 'purchasing', 'restaurantOps', 'purchasingGate', 'production', 'productionGate'] },
  { en: 'Administration', ar: 'الإدارة', keys: ['finance', 'financeCloseGate', 'setup', 'users', 'access', 'rbac', 'truth', 'hr', 'hrGate', 'imports', 'backup', 'supportGate', 'backend', 'tabletGate', 'deploymentGate', 'securityGate', 'rehearsalGate'] },
];

const routes = routeGroups.flatMap((group) => group.keys);

function L(locale: Locale, en: string, ar: string) { return locale === 'ar' ? ar : en; }
function id(prefix: string) { const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10); return `${prefix}-${random}`; }
function today() { return new Date().toISOString().slice(0, 10); }
function dateInRange(dateValue: string | undefined, from?: string, to?: string) {
  if (!dateValue) return false;
  const d = String(dateValue).slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}
function startOfMonthIso(dateValue = today()) { const d = new Date(dateValue + "T00:00:00"); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }
function startOfQuarterIso(dateValue = today()) { const d = new Date(dateValue + "T00:00:00"); const q = Math.floor(d.getMonth() / 3) * 3; return new Date(d.getFullYear(), q, 1).toISOString().slice(0, 10); }
function startOfYearIso(dateValue = today()) { const d = new Date(dateValue + "T00:00:00"); return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10); }
function periodLabel(from: string, to: string, locale: Locale) { return !from && !to ? L(locale, "All periods", "كل الفترات") : (from || "…") + " → " + (to || "…"); }
function nowTime() { return new Date().toTimeString().slice(0, 5); }
function money(value: number, locale: Locale) { return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 2 }).format(value || 0); }
function qty(value: number, unit = '') { return `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ''}`; }
function saveFile(fileName: string, content: string, mime = 'text/plain;charset=utf-8') { const blob = new Blob([content], { type: mime }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = fileName; a.click(); URL.revokeObjectURL(url); }
function rowsToCsv(rows: Array<Record<string, string | number | boolean>>) { if (!rows.length) return ''; const headers = Object.keys(rows[0]); const esc = (value: unknown) => { const text = String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }; return [headers.join(','), ...rows.map((row) => headers.map((h) => esc(row[h])).join(','))].join('\n'); }
function useLocalState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    const normalizer = key === STORAGE_KEY ? (normalizeERPState as unknown as (value: unknown) => T) : undefined;
    return safeLoad<T>(key, fallback, normalizer);
  });
  useEffect(() => { safeSave(key, value); }, [key, value]);
  return [value, setValue] as const;
}
function addAudit(state: ERPState, action: string, entity: string, ref: string, note: string): ERPState { return { ...state, audits: [{ id: id('AUD'), at: new Date().toISOString(), action, entity, ref, user: 'local-admin', note }, ...state.audits] }; }
function itemName(state: ERPState, itemId: string, locale: Locale) { const item = state.items.find((i) => i.id === itemId); return item ? L(locale, item.nameEn, item.nameAr) : '—'; }
function menuName(state: ERPState, menuId: string, locale: Locale) { const item = state.menuItems.find((i) => i.id === menuId); return item ? L(locale, item.nameEn, item.nameAr) : '—'; }
function storeName(state: ERPState, storeId: string, locale: Locale) { const store = state.stores.find((s) => s.id === storeId); return store ? L(locale, store.nameEn, store.nameAr) : '—'; }
function branchName(state: ERPState, branchId: string | undefined, locale: Locale) { const branch = state.branches.find((b) => b.id === branchId); return branch ? L(locale, branch.nameEn, branch.nameAr) : branchId === 'company' ? L(locale, 'Company', 'الشركة') : branchId === 'main' ? L(locale, 'Main / HQ', 'الرئيسي') : '—'; }
function costCenterName(state: ERPState, ccId: string | undefined, locale: Locale) { const cc = state.costCenters.find((c) => c.id === ccId); return cc ? L(locale, cc.nameEn, cc.nameAr) : ccId === 'company' ? L(locale, 'Company', 'الشركة') : '—'; }
function supplierName(state: ERPState, supplierId: string) { return state.suppliers.find((s) => s.id === supplierId)?.name ?? '—'; }
function accountName(state: ERPState, code: string, locale: Locale) { const acc = state.chartAccounts.find((a) => a.code === code); return acc ? `${acc.code} - ${L(locale, acc.nameEn, acc.nameAr)}` : code; }
function getBalance(state: ERPState, storeId: string, itemId: string) { return state.stockMovements.filter((m) => m.storeId === storeId && m.itemId === itemId).reduce((sum, m) => sum + (m.direction === 'in' ? m.qty : -m.qty), 0); }

function getReservedQty(state: ERPState, storeId: string, itemId: string, excludeRequestId?: string) {
  return (state.inventoryReservations ?? [])
    .filter((r) => r.status === 'reserved' && r.storeId === storeId && r.itemId === itemId && (!excludeRequestId || r.requestId !== excludeRequestId))
    .reduce((sum, r) => sum + Number(r.qty || 0), 0);
}
function getFreeStock(state: ERPState, storeId: string, itemId: string, excludeRequestId?: string) {
  return Math.max(0, getBalance(state, storeId, itemId) - getReservedQty(state, storeId, itemId, excludeRequestId));
}
function requestReservedQty(state: ERPState, requestId: string, lineId: string) {
  return (state.inventoryReservations ?? [])
    .filter((r) => r.requestId === requestId && r.requestLineId === lineId && r.status === 'reserved')
    .reduce((sum, r) => sum + Number(r.qty || 0), 0);
}
function requestIssuedQty(state: ERPState, requestId: string, lineId: string) {
  return (state.inventoryReservations ?? [])
    .filter((r) => r.requestId === requestId && r.requestLineId === lineId && r.status === 'issued')
    .reduce((sum, r) => sum + Number(r.qty || 0), 0);
}

function getAveragePurchaseCost(state: ERPState, itemId: string) { const movements = state.stockMovements.filter((m) => m.itemId === itemId && m.direction === 'in' && m.unitCost > 0); if (movements.length) { const qtySum = movements.reduce((s, m) => s + m.qty, 0); const valueSum = movements.reduce((s, m) => s + m.qty * m.unitCost, 0); return qtySum ? valueSum / qtySum : 0; } return state.items.find((i) => i.id === itemId)?.standardCost ?? 0; }
function getStockValue(state: ERPState) { const pairs = new Map<string, { storeId: string; itemId: string }>(); state.stockMovements.forEach((m) => pairs.set(`${m.storeId}|${m.itemId}`, { storeId: m.storeId, itemId: m.itemId })); return Array.from(pairs.values()).reduce((sum, p) => sum + getBalance(state, p.storeId, p.itemId) * getAveragePurchaseCost(state, p.itemId), 0); }
function daysUntil(date: string) { if (!date) return 9999; const diff = new Date(date).getTime() - new Date(today()).getTime(); return Math.ceil(diff / 86400000); }
function lotTone(lot: InventoryLot): 'good' | 'warn' | 'bad' | 'info' | 'neutral' { if (lot.status === 'quarantine') return 'warn'; if (lot.status === 'expired' || daysUntil(lot.expiryDate) < 0) return 'bad'; if (lot.status === 'returned' || lot.status === 'consumed') return 'neutral'; if (daysUntil(lot.expiryDate) <= 7) return 'warn'; return 'good'; }
function makePurchaseLots(inv: PurchaseInvoice): InventoryLot[] { return inv.lines.map((ln, index) => ({ id: id('LOT'), storeId: inv.storeId, itemId: ln.itemId, lotNo: ln.lotNo || `${inv.ref}-L${index + 1}`, batchNo: ln.batchNo || ln.lotNo || `${inv.invoiceNo}-${index + 1}`, binCode: ln.binCode || 'RECEIVING', receivedDate: inv.deliveryDate || inv.invoiceDate, expiryDate: ln.expiryDate || '', qty: ln.qty, unitCost: ln.unitCost, status: 'available' as InventoryLotStatus, sourceRef: inv.ref, supplierId: inv.supplierId, note: `Received from ${inv.invoiceNo}` })); }
function calculateSalesAmounts(menu: MenuItem | undefined, qtyValue: number) { const unitPrice = menu?.sellingPrice ?? 0; const vatRate = menu?.vatRate ?? 0; const base = unitPrice * qtyValue; if (menu?.priceIncludesVat ?? true) { const netSales = vatRate ? base / (1 + vatRate / 100) : base; const vatAmount = base - netSales; return { netSales, vatAmount, grossSales: base }; } const netSales = base; const vatAmount = netSales * (vatRate / 100); return { netSales, vatAmount, grossSales: netSales + vatAmount }; }
function journalBalance(j: JournalEntry) { const debit = j.lines.reduce((sum, l) => sum + Number(l.debit || 0), 0); const credit = j.lines.reduce((sum, l) => sum + Number(l.credit || 0), 0); return { debit, credit, diff: debit - credit, balanced: Math.abs(debit - credit) < 0.01 }; }
function invoiceLineTotals(line: PurchaseInvoiceLine) { const gross = line.qty * line.unitCost; const net = Math.max(0, gross - (line.discount || 0)); const vat = net * (line.vatRate / 100); return { gross, net, vat, total: net + vat }; }
function invoiceTotals(inv: PurchaseInvoice) { return inv.lines.reduce((sum, l) => { const t = invoiceLineTotals(l); return { net: sum.net + t.net, vat: sum.vat + t.vat, total: sum.total + t.total }; }, { net: 0, vat: 0, total: 0 }); }
function supplierInvoicePaid(state: ERPState, invoiceRef: string) { return state.supplierPayments.filter((p) => p.status === 'posted' && p.invoiceRef === invoiceRef).reduce((sum, p) => sum + Number(p.amount || 0), 0); }
function supplierInvoiceBalance(state: ERPState, inv: PurchaseInvoice) { return Math.max(0, invoiceTotals(inv).total - supplierInvoicePaid(state, inv.ref)); }
function supplierOpenInvoices(state: ERPState, supplierId: string) { return state.purchaseInvoices.filter((inv) => inv.status === 'posted' && (!supplierId || inv.supplierId === supplierId) && supplierInvoiceBalance(state, inv) > 0.01); }
function assetMonthlyDep(asset: FixedAsset) { return Math.max(0, (asset.cost - asset.salvageValue) / Math.max(asset.usefulLifeMonths, 1)); }
function upsert<T extends { id: string }>(arr: T[], record: T) { return arr.some((x) => x.id === record.id) ? arr.map((x) => x.id === record.id ? record : x) : [...arr, record]; }
function removeById<T extends { id: string }>(arr: T[], idValue: string) { return arr.filter((x) => x.id !== idValue); }
function signedAmount(account: ChartAccount | undefined, debit: number, credit: number) { const naturalDebit = account?.type === 'asset' || account?.type === 'expense' || account?.type === 'cogs' || account?.type === 'other_expense'; return naturalDebit ? debit - credit : credit - debit; }
function accountBalances(state: ERPState) { const posted = state.journals.filter((j) => j.status === 'posted'); return state.chartAccounts.map((acc) => { const lines = posted.flatMap((j) => j.lines).filter((l) => l.accountCode === acc.code); const debit = lines.reduce((s, l) => s + Number(l.debit || 0), 0); const credit = lines.reduce((s, l) => s + Number(l.credit || 0), 0); return { acc, debit, credit, balance: signedAmount(acc, debit, credit) }; }); }
function accountTotal(state: ERPState, prefix: string, mode: 'natural' | 'debitMinusCredit' | 'creditMinusDebit' = 'natural') { const bals = accountBalances(state).filter((b) => b.acc.code.startsWith(prefix)); if (mode === 'debitMinusCredit') return bals.reduce((s, b) => s + b.debit - b.credit, 0); if (mode === 'creditMinusDebit') return bals.reduce((s, b) => s + b.credit - b.debit, 0); return bals.reduce((s, b) => s + b.balance, 0); }
function calculateTotalsFromState(state: ERPState): Totals {
  const balances = accountBalances(state);
  const salesNet = balances.filter((b) => b.acc.type === "revenue").reduce((s, b) => s + b.balance, 0);
  const cogs = balances.filter((b) => b.acc.type === "cogs").reduce((s, b) => s + b.balance, 0);
  const expenses = balances.filter((b) => b.acc.type === "expense" || b.acc.type === "other_expense").reduce((s, b) => s + b.balance, 0);
  const assets = balances.filter((b) => b.acc.type === "asset").reduce((s, b) => s + b.balance, 0);
  const liabilities = balances.filter((b) => b.acc.type === "liability").reduce((s, b) => s + b.balance, 0);
  const equity = balances.filter((b) => b.acc.type === "equity").reduce((s, b) => s + b.balance, 0);
  const vatInput = accountTotal(state, "1420", "debitMinusCredit");
  const vatOutput = accountTotal(state, "2150", "creditMinusDebit");
  return { salesNet, salesGross: state.sales.reduce((s, sale) => s + calculateSalesAmounts(state.menuItems.find((m) => m.id === sale.menuItemId), sale.qty).grossSales, 0), cogs, grossProfit: salesNet - cogs, stockValue: getStockValue(state), ap: accountTotal(state, "2100"), ar: accountTotal(state, "1200"), cash: accountTotal(state, "1010") + accountTotal(state, "1020") + accountTotal(state, "1100"), vatInput, vatOutput, vatPayable: vatOutput - vatInput, assets, liabilities, equity, expenses, netIncome: salesNet - cogs - expenses };
}
function recipeCost(state: ERPState, menuItemId: string) { return state.recipeLines.filter((line) => line.menuItemId === menuItemId).reduce((sum, line) => sum + line.qty * (1 + (line.wastagePct || 0) / 100) * getAveragePurchaseCost(state, line.itemId), 0); }
function makeJournalLine(accountCode = '', debit = 0, credit = 0, memo = ''): JournalLine { return { id: id('JL'), accountCode, debit, credit, branchId: 'company', costCenterId: 'company', memo }; }
function defaultFiscalPeriods(): FiscalPeriod[] {
  const year = new Date().getFullYear();
  return Array.from({ length: 12 }).map((_, i) => {
    const start = new Date(year, i, 1);
    const end = new Date(year, i + 1, 0);
    const code = `${year}-${String(i + 1).padStart(2, '0')}`;
    return { id: id('PER'), code, nameEn: code, nameAr: code, startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10), status: 'open' as const };
  });
}
function currentUser(state: ERPState) { return state.employees.find((e) => e.id === state.activeUserId) ?? state.employees[0]; }
function scopeMatches(access: UserAccess, scope?: { branchId?: string; storeId?: string; costCenterId?: string }) {
  if (access.scopeType === 'all' || access.scopeId === 'all') return true;
  if (access.scopeType === 'branch') return access.scopeId === scope?.branchId;
  if (access.scopeType === 'store') return access.scopeId === scope?.storeId;
  if (access.scopeType === 'cost_center') return access.scopeId === scope?.costCenterId;
  return false;
}
function canPerform(state: ERPState, permissionKey: string, scope?: { branchId?: string; storeId?: string; costCenterId?: string }) {
  if (!state.employees.length || !state.roles.length || !state.userAccess.length) return true;
  const user = currentUser(state);
  if (!user) return true;
  return state.userAccess.filter((ua) => ua.employeeId === user.id).some((ua) => {
    const role = state.roles.find((r) => r.id === ua.roleId);
    return Boolean(role?.permissions.includes(permissionKey) && scopeMatches(ua, scope));
  });
}
function requirePermission(state: ERPState, permissionKey: string, scope: { branchId?: string; storeId?: string; costCenterId?: string } | undefined, locale: Locale) {
  return canPerform(state, permissionKey, scope) ? '' : L(locale, `Blocked: current user is missing ${permissionKey} or location scope.`, `محجوب: المستخدم الحالي لا يملك ${permissionKey} أو نطاق الموقع.`);
}
function periodForDate(state: ERPState, date: string) { return (state.fiscalPeriods ?? []).find((p) => date >= p.startDate && date <= p.endDate); }
function isDateLocked(state: ERPState, date: string) { const p = periodForDate(state, date); return p?.status === 'locked' || p?.status === 'closed'; }
function availableRows(state: ERPState) {
  return state.stores.flatMap((store) => state.items.map((item) => {
    const onHand = getBalance(state, store.id, item.id);
    const quarantined = (state.inventoryLots ?? []).filter((l) => l.storeId === store.id && l.itemId === item.id && l.status === 'quarantine').reduce((sum, l) => sum + l.qty, 0);
    const expired = (state.inventoryLots ?? []).filter((l) => l.storeId === store.id && l.itemId === item.id && (l.status === 'expired' || daysUntil(l.expiryDate) < 0)).reduce((sum, l) => sum + l.qty, 0);
    const reserved = getReservedQty(state, store.id, item.id);
    const inTransitOut = (state.transfers ?? []).filter((t) => t.fromStoreId === store.id && t.itemId === item.id && !t.posted).reduce((sum, t) => sum + t.qty, 0);
    const inTransitIn = (state.transfers ?? []).filter((t) => t.toStoreId === store.id && t.itemId === item.id && !t.posted).reduce((sum, t) => sum + t.qty, 0);
    const available = onHand - reserved - quarantined - expired - inTransitOut + inTransitIn;
    return { store, item, onHand, reserved, quarantined, expired, inTransitOut, inTransitIn, available, cost: getAveragePurchaseCost(state, item.id) };
  })).filter((r) => Math.abs(r.onHand) > 0.0001 || Math.abs(r.available) > 0.0001 || r.reserved || r.quarantined || r.expired || r.inTransitIn || r.inTransitOut);
}

function defaultChartAccounts(): ChartAccount[] {
  const rows: Array<[string, string, string, AccountType, string?, boolean?]> = [
    ['1000', 'Assets', 'الأصول', 'asset'], ['1010', 'Cash on Hand', 'النقدية بالصندوق', 'asset'], ['1020', 'Bank Accounts', 'الحسابات البنكية', 'asset'], ['1100', 'POS Clearing / Cashier Control', 'حساب وسيط الكاشير', 'asset'], ['1200', 'Accounts Receivable', 'الذمم المدينة', 'asset'], ['1300', 'Raw Material Inventory', 'مخزون المواد الخام', 'asset'], ['1310', 'Semi-Finished Inventory', 'مخزون نصف مصنع', 'asset'], ['1400', 'Prepaid Expenses', 'مصروفات مدفوعة مقدماً', 'asset'], ['1420', 'VAT Input', 'ضريبة المدخلات', 'asset'], ['1500', 'Fixed Assets', 'الأصول الثابتة', 'asset'], ['1590', 'Accumulated Depreciation', 'مجمع الإهلاك', 'asset'],
    ['2000', 'Liabilities', 'الالتزامات', 'liability'], ['2100', 'Accounts Payable', 'الذمم الدائنة', 'liability'], ['2110', 'Goods Received Not Invoiced', 'بضائع مستلمة غير مفوترة', 'liability'], ['2150', 'VAT Output', 'ضريبة المخرجات', 'liability'], ['2160', 'VAT Payable', 'ضريبة مستحقة', 'liability'], ['2200', 'Accrued Expenses', 'مصروفات مستحقة', 'liability'], ['2300', 'Employee Payables', 'مستحقات الموظفين', 'liability'],
    ['3000', 'Equity', 'حقوق الملكية', 'equity'], ['3100', 'Capital', 'رأس المال', 'equity'], ['3200', 'Retained Earnings', 'الأرباح المبقاة', 'equity'],
    ['4000', 'Food Sales', 'مبيعات الأغذية', 'revenue'], ['4010', 'Beverage Sales', 'مبيعات المشروبات', 'revenue'], ['4090', 'Sales Discounts', 'خصومات المبيعات', 'revenue'],
    ['5000', 'Cost of Goods Sold', 'تكلفة المبيعات', 'cogs'], ['5100', 'Food Cost / COGS', 'تكلفة الغذاء', 'cogs', undefined, true], ['5200', 'Packaging Cost', 'تكلفة التغليف', 'cogs', undefined, true],
    ['6000', 'Operating Expenses', 'المصاريف التشغيلية', 'expense'], ['6100', 'Payroll Expense', 'مصروف الرواتب', 'expense', undefined, true], ['6200', 'Rent Expense', 'مصروف الإيجار', 'expense', undefined, true], ['6300', 'Utilities Expense', 'مصروف الخدمات', 'expense', undefined, true], ['6400', 'Maintenance Expense', 'مصروف الصيانة', 'expense', undefined, true], ['6500', 'Bank Charges', 'رسوم بنكية', 'expense'], ['6600', 'Depreciation Expense', 'مصروف الإهلاك', 'expense', undefined, true], ['6700', 'Inventory Variance / Wastage', 'فروقات وهالك المخزون', 'expense', undefined, true],
    ['7000', 'Other Income', 'إيرادات أخرى', 'other_income'], ['8000', 'Other Expense', 'مصروفات أخرى', 'other_expense'],
  ];
  return rows.map(([code, nameEn, nameAr, type, parentCode, requireCostCenter]) => ({ id: id('ACC'), code, nameEn, nameAr, type, parentCode, requireCostCenter: Boolean(requireCostCenter), active: true }));
}

function branchDefaultCostCenterId(state: ERPState, branchId: string | undefined) {
  return state.costCenters.find((c) => c.branchId === branchId)?.id ?? 'company';
}
function buildPurchaseJournal(state: ERPState, inv: PurchaseInvoice): JournalEntry {
  const totals = invoiceTotals(inv);
  const paid = inv.paymentType === 'cash' || inv.paymentType === 'bank' ? totals.total : inv.paymentType === 'partial' ? Math.min(inv.paidAmount, totals.total) : 0;
  const ap = totals.total - paid;
  const lines: JournalLine[] = [];
  inv.lines.forEach((line) => {
    const item = state.items.find((i) => i.id === line.itemId);
    const t = invoiceLineTotals(line);
    // Inventory purchase is a balance-sheet stock asset. Cost center is applied later on consumption, wastage, sales, or expense issue.
    lines.push({ id: id('JL'), accountCode: item?.isSemiFinished ? '1310' : '1300', debit: t.net, credit: 0, branchId: inv.branchId, costCenterId: 'company', memo: `${item?.nameEn ?? 'Inventory purchase'} — stock asset; cost center on consumption` });
  });
  if (totals.vat > 0) lines.push({ id: id('JL'), accountCode: '1420', debit: totals.vat, credit: 0, branchId: inv.branchId, costCenterId: 'company', memo: 'Input VAT' });
  if (ap > 0) lines.push({ id: id('JL'), accountCode: '2100', debit: 0, credit: ap, branchId: inv.branchId, costCenterId: 'company', memo: supplierName(state, inv.supplierId) });
  if (paid > 0) lines.push({ id: id('JL'), accountCode: inv.paymentType === 'cash' ? '1010' : '1020', debit: 0, credit: paid, branchId: inv.branchId, costCenterId: 'company', memo: 'Immediate supplier payment' });
  return { id: id('JE'), date: inv.invoiceDate, ref: inv.ref, source: 'purchase_invoice', description: `Purchase invoice ${inv.invoiceNo}`, status: 'posted', lines };
}



function productionRecipeCost(state: ERPState, recipe: ProductionRecipe | undefined, outputQty?: number) {
  if (!recipe) return { inputCost: 0, unitCost: 0, scaledLines: [] as Array<{ line: ProductionRecipeLine; actualQty: number; availableQty: number; unitCost: number; lineCost: number }> };
  const scale = outputQty && recipe.baseOutputQty ? outputQty / recipe.baseOutputQty : 1;
  const scaledLines = recipe.lines.map((line) => {
    const actualQty = line.qty * scale * (1 + (line.wastagePct || 0) / 100);
    const unitCost = getAveragePurchaseCost(state, line.itemId);
    return { line, actualQty, availableQty: 0, unitCost, lineCost: actualQty * unitCost };
  });
  const inputCost = scaledLines.reduce((sum, line) => sum + line.lineCost, 0);
  const unitCost = (outputQty || recipe.baseOutputQty) ? inputCost / (outputQty || recipe.baseOutputQty) : 0;
  return { inputCost, unitCost, scaledLines };
}
function expiryFromDays(date: string, days: number) {
  const d = new Date(date || today());
  d.setDate(d.getDate() + Math.max(days || 0, 0));
  return d.toISOString().slice(0, 10);
}
function productionRegisterRows(state: ERPState) {
  return state.productions.map((doc) => {
    const outputCost = doc.actualOutputQty ? doc.lines.reduce((s, l) => s + l.actualQty * getAveragePurchaseCost(state, l.itemId), 0) / doc.actualOutputQty : 0;
    const plannedVariance = doc.actualOutputQty - doc.plannedOutputQty;
    return { doc, outputCost, plannedVariance };
  });
}
function buildSalesJournal(state: ERPState, doc: SaleDoc, foodCost: number): JournalEntry {
  const menu = state.menuItems.find((m) => m.id === doc.menuItemId);
  const amounts = calculateSalesAmounts(menu, doc.qty);
  const usageCostCenter = branchDefaultCostCenterId(state, doc.branchId);
  return { id: id('JE'), date: doc.date, ref: doc.ref, source: 'sales', description: 'POS / sales batch posting', status: 'posted', lines: [
    { id: id('JL'), accountCode: '1100', debit: amounts.grossSales, credit: 0, branchId: doc.branchId, costCenterId: 'company', memo: doc.paymentMethod },
    { id: id('JL'), accountCode: '4000', debit: 0, credit: amounts.netSales, branchId: doc.branchId, costCenterId: usageCostCenter, memo: 'Sales revenue excluding VAT' },
    { id: id('JL'), accountCode: '2150', debit: 0, credit: amounts.vatAmount, branchId: doc.branchId, costCenterId: 'company', memo: 'Output VAT' },
    { id: id('JL'), accountCode: '5100', debit: foodCost, credit: 0, branchId: doc.branchId, costCenterId: usageCostCenter, memo: 'Recipe cost recognized on sale/usage' },
    { id: id('JL'), accountCode: '1300', debit: 0, credit: foodCost, branchId: doc.branchId, costCenterId: 'company', memo: 'Inventory asset reduction' },
  ] };
}

function makeDefaultRole(locale: Locale): Role { return { id: id('ROLE'), nameEn: 'Owner', nameAr: 'المالك', description: L(locale, 'Full local access', 'صلاحية كاملة محلية'), permissions: permissionCatalog.map((p) => p.key) }; }

function createProfessionalMasterData(locale: Locale): ERPState {
  const b1: Branch = { id: id('BR'), code: 'R01', nameEn: 'Restaurant 1', nameAr: 'مطعم ١', location: 'City Branch', active: true };
  const b2: Branch = { id: id('BR'), code: 'R02', nameEn: 'Restaurant 2', nameAr: 'مطعم ٢', location: 'Mall Branch', active: true };
  const mainStore: StoreLocation = { id: id('ST'), code: 'MAIN', nameEn: 'Main Stockroom', nameAr: 'المستودع الرئيسي', branchId: 'main', type: 'Main', active: true };
  const s1: StoreLocation = { id: id('ST'), code: 'R01-KIT', nameEn: 'Restaurant 1 Kitchen Store', nameAr: 'مخزن مطعم ١', branchId: b1.id, type: 'Kitchen', active: true };
  const s2: StoreLocation = { id: id('ST'), code: 'R01-COLD', nameEn: 'Restaurant 1 Cold Room', nameAr: 'ثلاجة مطعم ١', branchId: b1.id, type: 'Cold Room', active: true };
  const s3: StoreLocation = { id: id('ST'), code: 'R02-KIT', nameEn: 'Restaurant 2 Kitchen Store', nameAr: 'مخزن مطعم ٢', branchId: b2.id, type: 'Kitchen', active: true };
  const binLocations: BinLocation[] = [
    { id: id('BIN'), storeId: mainStore.id, code: 'A-01-DRY', zone: 'Dry Aisle', type: 'Dry Shelf', active: true },
    { id: id('BIN'), storeId: mainStore.id, code: 'C-01-COLD', zone: 'Cold Room', type: 'Chiller Rack', active: true },
    { id: id('BIN'), storeId: s1.id, code: 'K-01-PREP', zone: 'Kitchen Prep', type: 'Kitchen Shelf', active: true },
    { id: id('BIN'), storeId: s2.id, code: 'C-01-R01', zone: 'Restaurant 1 Cold Room', type: 'Chiller Rack', active: true },
  ];
  const suppliers: Supplier[] = [
    { id: id('SUP'), code: 'SUP-MEAT', name: 'Premium Meat Supplier', vatNo: '300000000000003', paymentTerms: '30 days', contactName: 'Sales Desk', phone: '0500000000', email: 'sales@supplier.test', bankName: 'SNB', bankAccount: 'SA0000000000000000000001', representativeName: 'Mohammed', representativePhone: '0501111111', active: true },
    { id: id('SUP'), code: 'SUP-DRY', name: 'Dry Goods Supplier', vatNo: '300000000000004', paymentTerms: 'Cash / 15 days', contactName: 'Accounts', phone: '0500000001', email: 'accounts@dry.test', bankName: 'Al Rajhi', bankAccount: 'SA0000000000000000000002', representativeName: 'Ahmed', representativePhone: '0502222222', active: true },
  ];
  const items: Item[] = [
    { id: id('ITM'), sku: 'FLOUR', nameEn: 'Flour', nameAr: 'دقيق', category: 'Dry Food', purchaseUnit: 'KG', consumptionUnit: 'KG', conversionFactor: 1, standardCost: 0, minStock: 20, maxStock: 500, reorderPoint: 50, isSemiFinished: false, active: true },
    { id: id('ITM'), sku: 'YEAST', nameEn: 'Yeast', nameAr: 'خميرة', category: 'Dry Food', purchaseUnit: 'KG', consumptionUnit: 'KG', conversionFactor: 1, standardCost: 0, minStock: 2, maxStock: 50, reorderPoint: 5, isSemiFinished: false, active: true },
    { id: id('ITM'), sku: 'CHEESE', nameEn: 'Mozzarella Cheese', nameAr: 'جبن موزاريلا', category: 'Dairy', purchaseUnit: 'KG', consumptionUnit: 'KG', conversionFactor: 1, standardCost: 0, minStock: 10, maxStock: 200, reorderPoint: 25, isSemiFinished: false, active: true },
    { id: id('ITM'), sku: 'SAUCE', nameEn: 'Tomato Sauce', nameAr: 'صلصة طماطم', category: 'Sauce', purchaseUnit: 'KG', consumptionUnit: 'KG', conversionFactor: 1, standardCost: 0, minStock: 10, maxStock: 150, reorderPoint: 25, isSemiFinished: false, active: true },
    { id: id('ITM'), sku: 'BEEF', nameEn: 'Beef', nameAr: 'لحم بقري', category: 'Meat', purchaseUnit: 'KG', consumptionUnit: 'KG', conversionFactor: 1, standardCost: 0, minStock: 10, maxStock: 250, reorderPoint: 35, isSemiFinished: false, active: true },
    { id: id('ITM'), sku: 'TOMATO', nameEn: 'Fresh Tomato', nameAr: 'طماطم طازجة', category: 'Vegetables', purchaseUnit: 'KG', consumptionUnit: 'KG', conversionFactor: 1, standardCost: 0, minStock: 15, maxStock: 200, reorderPoint: 30, isSemiFinished: false, active: true },
    { id: id('ITM'), sku: 'CHICKEN', nameEn: 'Chicken Breast', nameAr: 'صدر دجاج', category: 'Poultry', purchaseUnit: 'KG', consumptionUnit: 'KG', conversionFactor: 1, standardCost: 0, minStock: 20, maxStock: 250, reorderPoint: 40, isSemiFinished: false, active: true },
    { id: id('ITM'), sku: 'OIL', nameEn: 'Cooking Oil', nameAr: 'زيت طبخ', category: 'Dry Food', purchaseUnit: 'L', consumptionUnit: 'L', conversionFactor: 1, standardCost: 0, minStock: 20, maxStock: 200, reorderPoint: 30, isSemiFinished: false, active: true },
    { id: id('ITM'), sku: 'BOX', nameEn: 'Pizza Box', nameAr: 'علبة بيتزا', category: 'Packaging', purchaseUnit: 'PCS', consumptionUnit: 'PCS', conversionFactor: 1, standardCost: 0, minStock: 100, maxStock: 2000, reorderPoint: 300, isSemiFinished: false, active: true },
    { id: id('ITM'), sku: 'DOUGH', nameEn: 'Pizza Dough Batch', nameAr: 'عجينة بيتزا', category: 'Semi Finished', purchaseUnit: 'KG', consumptionUnit: 'KG', conversionFactor: 1, standardCost: 0, minStock: 5, maxStock: 100, reorderPoint: 15, isSemiFinished: true, active: true },
  ];
  const pizza: MenuItem = { id: id('MENU'), code: 'PIZZA-M', nameEn: 'Margherita Pizza', nameAr: 'بيتزا مارجريتا', category: 'Pizza', sellingPrice: 35, vatRate: 15, priceIncludesVat: true, active: true };
  const bbq: MenuItem = { id: id('MENU'), code: 'BBQ-BEEF', nameEn: 'Beef BBQ Plate', nameAr: 'طبق مشاوي لحم', category: 'BBQ', sellingPrice: 69, vatRate: 15, priceIncludesVat: true, active: true };
  const itemCategories: MasterCategory[] = Array.from(new Set(items.map((i) => i.category))).map((name) => ({ id: id('ICAT'), kind: 'item' as const, nameEn: name, nameAr: name, active: true }));
  const menuCategories: MasterCategory[] = Array.from(new Set([pizza.category, bbq.category])).map((name) => ({ id: id('MCAT'), kind: 'menu' as const, nameEn: name, nameAr: name, active: true }));
  const dough = items.find((i) => i.sku === 'DOUGH')!; const cheese = items.find((i) => i.sku === 'CHEESE')!; const sauce = items.find((i) => i.sku === 'SAUCE')!; const beef = items.find((i) => i.sku === 'BEEF')!;
  const recipeLines: RecipeLine[] = [
    { id: id('REC'), menuItemId: pizza.id, itemId: dough.id, qty: 0.22, unit: 'KG', wastagePct: 2, note: 'semi-finished dough' },
    { id: id('REC'), menuItemId: pizza.id, itemId: cheese.id, qty: 0.12, unit: 'KG', wastagePct: 1, note: 'cheese' },
    { id: id('REC'), menuItemId: pizza.id, itemId: sauce.id, qty: 0.06, unit: 'KG', wastagePct: 1, note: 'sauce' },
    { id: id('REC'), menuItemId: bbq.id, itemId: beef.id, qty: 0.32, unit: 'KG', wastagePct: 5, note: 'main protein' },
    { id: id('REC'), menuItemId: bbq.id, itemId: sauce.id, qty: 0.04, unit: 'KG', wastagePct: 1, note: 'sauce' },
  ];
  const productionRecipe: ProductionRecipe = {
    id: id('PREC'), code: 'PR-DGH-001', nameEn: 'Pizza Dough Standard Batch', nameAr: 'دفعة عجينة البيتزا القياسية', outputItemId: dough.id, baseOutputQty: 10, outputUnit: 'KG', defaultExpiryDays: 2, active: true,
    lines: [
      { id: id('PRL'), itemId: items.find((i) => i.sku === 'FLOUR')!.id, qty: 7.5, unit: 'KG', wastagePct: 1 },
      { id: id('PRL'), itemId: items.find((i) => i.sku === 'YEAST')!.id, qty: 0.18, unit: 'KG', wastagePct: 0 },
    ],
  };
  const cc1: CostCenter = { id: id('CC'), code: 'CC-R01-KIT', nameEn: 'Restaurant 1 Kitchen', nameAr: 'مطبخ مطعم ١', branchId: b1.id, budget: 0, active: true };
  const cc2: CostCenter = { id: id('CC'), code: 'CC-R02-KIT', nameEn: 'Restaurant 2 Kitchen', nameAr: 'مطبخ مطعم ٢', branchId: b2.id, budget: 0, active: true };
  const emp: Employee = { id: id('EMP'), code: 'EMP-001', name: 'Local Admin', branchId: 'company', department: 'Management', jobTitle: 'ERP Admin', salary: 0, active: true };
  const adminUser: AppUser = { id: id('USR'), employeeId: emp.id, email: 'admin@local.erp', displayName: emp.name, status: 'active', authProvider: 'local', mustChangePassword: false, createdAt: new Date().toISOString(), active: true };
  const role = makeDefaultRole(locale);
  return addAudit({ ...emptyState, branches: [b1, b2], stores: [mainStore, s1, s2, s3], suppliers, items, menuItems: [pizza, bbq], itemCategories, menuCategories, recipeLines, costCenters: [cc1, cc2], employees: [emp], userAccounts: [adminUser], roles: [role], userAccess: [{ id: id('ACC'), employeeId: emp.id, roleId: role.id, scopeType: 'all', scopeId: 'all' }], chartAccounts: defaultChartAccounts(), productionRecipes: [productionRecipe], binLocations, fiscalPeriods: defaultFiscalPeriods(), activeUserId: emp.id, importProfiles: [{ id: id('IMP'), name: 'Default POS Sales Mapping', importType: 'pos_sales', fileType: 'csv', duplicateKey: 'branchCode+date+posReceiptNo', requiresApproval: true, mappings: { Date: 'saleDate', Branch: 'branchCode', Item: 'posItemName', Quantity: 'qty', Gross: 'grossSales' } }] }, 'load_master_data', 'system', 'PRO-MASTER', 'Professional non-money master data loaded with zero-cost inventory items');
}

function createProfessionalTrialScenario(locale: Locale): ERPState {
  let state = createProfessionalMasterData(locale);
  const supplier = state.suppliers[0];
  const branch = state.branches[0];
  const mainStore = state.stores.find((s) => s.code === 'MAIN') ?? state.stores[0];
  const r1Store = state.stores.find((s) => s.code === 'R01-KIT') ?? state.stores[1] ?? mainStore;
  const itemBySku = (sku: string) => state.items.find((i) => i.sku === sku)!;
  const purchase: PurchaseInvoice = {
    id: id('PI'), ref: 'PINV-TRIAL-001', invoiceNo: 'SUP-A-1001', supplierId: supplier.id, branchId: branch.id, storeId: mainStore.id, costCenterId: 'company',
    invoiceDate: today(), deliveryDate: today(), paymentType: 'partial', paidAmount: 2500, status: 'posted',
    lines: [
      { id: id('PIL'), itemId: itemBySku('FLOUR').id, qty: 100, unitCost: 3.8, vatRate: 15, discount: 0 },
      { id: id('PIL'), itemId: itemBySku('YEAST').id, qty: 5, unitCost: 18, vatRate: 15, discount: 0 },
      { id: id('PIL'), itemId: itemBySku('CHEESE').id, qty: 40, unitCost: 28, vatRate: 15, discount: 0 },
      { id: id('PIL'), itemId: itemBySku('SAUCE').id, qty: 30, unitCost: 9, vatRate: 15, discount: 0 },
      { id: id('PIL'), itemId: itemBySku('BEEF').id, qty: 50, unitCost: 42, vatRate: 15, discount: 0 },
      { id: id('PIL'), itemId: itemBySku('TOMATO').id, qty: 40, unitCost: 4.5, vatRate: 15, discount: 0 },
      { id: id('PIL'), itemId: itemBySku('BOX').id, qty: 500, unitCost: 1.1, vatRate: 15, discount: 0 },
    ],
  };
  const purchaseMoves: StockMovement[] = purchase.lines.map((ln) => ({ id: id('MOV'), date: purchase.invoiceDate, type: 'purchase_invoice', storeId: purchase.storeId, itemId: ln.itemId, direction: 'in', qty: ln.qty, unitCost: ln.unitCost, ref: purchase.ref, note: purchase.invoiceNo }));
  state = addAudit({ ...state, purchaseInvoices: [purchase], stockMovements: purchaseMoves, journals: [
    { id: id('JE'), date: today(), ref: 'OPEN-CAP-001', source: 'opening', description: 'Trial opening capital and bank balance', status: 'posted', lines: [
      { id: id('JL'), accountCode: '1020', debit: 80000, credit: 0, branchId: 'company', costCenterId: 'company', memo: 'Opening bank balance' },
      { id: id('JL'), accountCode: '3100', debit: 0, credit: 80000, branchId: 'company', costCenterId: 'company', memo: 'Owner capital' },
    ] },
    buildPurchaseJournal(state, purchase),
  ] }, 'load_trial_scenario', 'system', 'TRIAL-PURCHASE', 'Trial purchase invoice posted; inventory average cost calculated from invoice lines');

  // Transfer purchased items from main stockroom to Restaurant 1 kitchen before production/sales.
  const transferSkus = ['FLOUR', 'YEAST', 'CHEESE', 'SAUCE', 'BEEF', 'BOX'];
  const transferMoves: StockMovement[] = transferSkus.flatMap((sku) => {
    const item = itemBySku(sku);
    const qtyBySku: Record<string, number> = { FLOUR: 40, YEAST: 2, CHEESE: 20, SAUCE: 15, BEEF: 20, BOX: 100 };
    const q = qtyBySku[sku] ?? 0;
    const cost = getAveragePurchaseCost(state, item.id);
    return [
      { id: id('MOV'), date: today(), type: 'transfer', storeId: mainStore.id, itemId: item.id, direction: 'out' as Direction, qty: q, unitCost: cost, ref: 'TRF-TRIAL-001', note: 'Transfer to Restaurant 1 Kitchen' },
      { id: id('MOV'), date: today(), type: 'transfer', storeId: r1Store.id, itemId: item.id, direction: 'in' as Direction, qty: q, unitCost: cost, ref: 'TRF-TRIAL-001', note: 'Received from Main Stockroom' },
    ];
  });
  state = addAudit({ ...state, stockMovements: [...state.stockMovements, ...transferMoves] }, 'post', 'transfer', 'TRF-TRIAL-001', 'Trial transfer from main stockroom to restaurant kitchen');

  const recipe = state.productionRecipes[0];
  const prodCost = productionRecipeCost(state, recipe, 20);
  const productionRef = 'PROD-TRIAL-001';
  const production: ProductionDoc = { id: id('PROD'), date: today(), ref: productionRef, recipeId: recipe.id, sourceStoreId: r1Store.id, destinationStoreId: r1Store.id, outputItemId: recipe.outputItemId, plannedOutputQty: 20, actualOutputQty: 19.4, expiryDate: expiryFromDays(today(), recipe.defaultExpiryDays), status: 'posted', lines: prodCost.scaledLines.map((x) => ({ id: id('PL'), itemId: x.line.itemId, plannedQty: x.line.qty * 2, actualQty: x.actualQty, unit: x.line.unit, wastagePct: x.line.wastagePct })) };
  const productionOuts: StockMovement[] = prodCost.scaledLines.map((x) => ({ id: id('MOV'), date: today(), type: 'production', storeId: r1Store.id, itemId: x.line.itemId, direction: 'out', qty: x.actualQty, unitCost: getAveragePurchaseCost(state, x.line.itemId), ref: productionRef, note: 'Trial pizza dough production' }));
  const productionIn: StockMovement = { id: id('MOV'), date: today(), type: 'production', storeId: r1Store.id, itemId: recipe.outputItemId, direction: 'in', qty: production.actualOutputQty, unitCost: prodCost.inputCost / Math.max(production.actualOutputQty, 1), ref: productionRef, note: 'Semi-finished pizza dough output' };
  state = addAudit({ ...state, productions: [production], stockMovements: [...state.stockMovements, ...productionOuts, productionIn], journals: [...state.journals, { id: id('JE'), date: today(), ref: productionRef, source: 'production', description: 'Trial pizza dough production', status: 'posted', lines: [
    { id: id('JL'), accountCode: '1310', debit: prodCost.inputCost, credit: 0, branchId: branch.id, costCenterId: 'company', memo: 'Semi-finished dough inventory' },
    { id: id('JL'), accountCode: '1300', debit: 0, credit: prodCost.inputCost, branchId: branch.id, costCenterId: 'company', memo: 'Raw materials consumed to production' },
  ] }] }, 'post', 'production', productionRef, 'Trial production batch posted without recognizing food cost yet');

  const saleDoc: SaleDoc = { id: id('SALE'), date: today(), ref: 'SALE-TRIAL-001', branchId: branch.id, storeId: r1Store.id, menuItemId: state.menuItems.find((m) => m.code === 'PIZZA-M')!.id, qty: 12, paymentMethod: 'Cash', posted: true };
  const saleLines = state.recipeLines.filter((r) => r.menuItemId === saleDoc.menuItemId);
  const saleMoves: StockMovement[] = saleLines.map((r) => ({ id: id('MOV'), date: today(), type: 'sales_consumption', storeId: saleDoc.storeId, itemId: r.itemId, direction: 'out', qty: r.qty * saleDoc.qty, unitCost: getAveragePurchaseCost(state, r.itemId), ref: saleDoc.ref, note: 'Trial recipe consumption' }));
  const foodCost = saleMoves.reduce((sum, m) => sum + m.qty * m.unitCost, 0);
  state = addAudit({ ...state, sales: [saleDoc], stockMovements: [...state.stockMovements, ...saleMoves], journals: [...state.journals, buildSalesJournal(state, saleDoc, foodCost)] }, 'post', 'sale', saleDoc.ref, 'Trial sale posted; cost center applied on recipe consumption, not on purchase');
  const lotRows: InventoryLot[] = state.stores.flatMap((store) => state.items.map((item) => ({ store, item, balance: getBalance(state, store.id, item.id), cost: getAveragePurchaseCost(state, item.id) })).filter((r) => r.balance > 0).map((r, idx) => ({ id: id('LOT'), storeId: r.store.id, itemId: r.item.id, lotNo: `${r.item.sku}-LOT-${idx + 1}`, batchNo: `${r.item.sku}-B-${idx + 1}`, binCode: r.store.code === 'MAIN' ? (r.item.category === 'Dairy' || r.item.category === 'Meat' ? 'C-01-COLD' : 'A-01-DRY') : 'K-01-PREP', receivedDate: today(), expiryDate: r.item.isSemiFinished ? expiryFromDays(today(), 2) : expiryFromDays(today(), r.item.category === 'Meat' || r.item.category === 'Dairy' ? 10 : 45), qty: r.balance, unitCost: r.cost, status: 'available' as InventoryLotStatus, sourceRef: 'TRIAL-LOT-BUILD', supplierId: supplier.id, note: 'Fast-trial lot control row' })));
  const quarantineLot: InventoryLot = { id: id('LOT'), storeId: mainStore.id, itemId: itemBySku('TOMATO').id, lotNo: 'TOMATO-QC-001', batchNo: 'TOMATO-QC-001', binCode: 'QC-HOLD', receivedDate: today(), expiryDate: expiryFromDays(today(), 4), qty: 3, unitCost: getAveragePurchaseCost(state, itemBySku('TOMATO').id), status: 'quarantine', sourceRef: purchase.ref, supplierId: supplier.id, note: 'Damaged box held for supplier decision' };
  const approval: InventoryApproval = { id: id('IAP'), ref: 'IAP-TRIAL-001', date: today(), requestType: 'adjustment', status: 'pending', storeId: r1Store.id, itemId: itemBySku('BOX').id, direction: 'out', qty: 5, unitCost: getAveragePurchaseCost(state, itemBySku('BOX').id), costCenterId: state.costCenters[0]?.id ?? 'company', reason: 'Damaged packaging', note: 'Demo pending approval before posting', requestedBy: 'Local Admin' };
  const trialMr: MaterialRequest = { id: id('MR'), ref: 'MR-TRIAL-001', date: today(), branchId: branch.id, storeId: r1Store.id, requestedBy: 'Chef Demo', neededBy: today(), status: 'converted', lines: [ { id: id('MRL'), itemId: itemBySku('FLOUR').id, qty: 25, note: 'Pizza dough prep' }, { id: id('MRL'), itemId: itemBySku('CHEESE').id, qty: 10, note: 'Pizza station' } ], note: 'Fast-trial request converted to PO' };
  const trialPo: PurchaseOrder = { id: id('PO'), ref: 'PO-TRIAL-001', date: today(), supplierId: supplier.id, branchId: branch.id, storeId: mainStore.id, requestRef: trialMr.ref, eta: today(), status: 'closed', note: 'Closed after GRN and invoice match', lines: purchase.lines.slice(0, 4).map((l) => ({ id: id('POL'), itemId: l.itemId, qty: l.qty, unitCost: l.unitCost, vatRate: l.vatRate, receivedQty: l.qty, invoicedQty: l.qty })) };
  const trialGrn: GoodsReceipt = { id: id('GRN'), ref: 'GRN-TRIAL-001', date: today(), poId: trialPo.id, supplierId: supplier.id, storeId: mainStore.id, status: 'posted', lines: trialPo.lines.map((l, idx) => ({ id: id('GRNL'), itemId: l.itemId, qty: l.qty, unitCost: l.unitCost, lotNo: 'TRIAL-L' + (idx + 1), batchNo: 'TRIAL-B' + (idx + 1), binCode: 'A-01-DRY', expiryDate: expiryFromDays(today(), 45) })) };
  const trialPayment: SupplierPayment = { id: id('PAY'), ref: 'PAY-TRIAL-001', date: today(), supplierId: supplier.id, amount: 2500, method: 'bank', accountCode: '1020', status: 'posted', note: 'Fast trial payment voucher', invoiceRef: purchase.ref };
  return { ...state, materialRequests: [trialMr], purchaseOrders: [trialPo], goodsReceipts: [trialGrn], supplierPayments: [trialPayment], inventoryLots: [...lotRows, quarantineLot], inventoryApprovals: [approval] };
}

function AppShell() {
  const [locale, setLocale] = useState<Locale>('en');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [route, setRoute] = useState<RouteKey>('dashboard');
  const [state, setState] = useLocalState<ERPState>(STORAGE_KEY, emptyState);
  const [toast, setToast] = useState<Toast>(null);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const notify = (type: 'success' | 'warning' | 'error', message: string) => { setToast({ type: type ?? 'success', message }); window.setTimeout(() => setToast(null), 3800); };
  const update = (fn: (current: ERPState) => ERPState, success?: string) => { setState((current) => fn(current)); if (success) notify('success', success); };
  const totals = useMemo<Totals>(() => calculateTotalsFromState(state), [state]);
  const page: Record<RouteKey, ReactNode> = {
    dashboard: <DashboardPage state={state} totals={totals} locale={locale} setState={setState} notify={notify} />,
    smartAnalysis: <ModuleSuspense label={L(locale, 'Loading smart analysis studio', 'تحميل التحليل الذكي')}><SmartAnalysisRoutePage state={state} locale={locale} /></ModuleSuspense>,
    setup: <SetupPage state={state} update={update} locale={locale} />,
    access: <AccessPage state={state} update={update} locale={locale} />,
    users: <UsersPage state={state} update={update} locale={locale} />,
    inventory: <InventoryPage state={state} update={update} locale={locale} />,
    inventoryGate: <ModuleSuspense label={L(locale, 'Loading inventory workflow gate', 'تحميل بوابة المخزون')}><EnterpriseV386InventoryGatePage state={state} locale={locale} notify={notify} /></ModuleSuspense>,
    purchasing: <PurchasingPage state={state} update={update} locale={locale} />,
    purchasingGate: <ModuleSuspense label={L(locale, 'Loading purchasing workflow gate', 'تحميل بوابة دورة المشتريات')}><EnterpriseV385PurchasingGatePage state={state} locale={locale} notify={notify} /></ModuleSuspense>,
    production: <ProductionPage state={state} update={update} locale={locale} />,
    productionGate: <ModuleSuspense label={L(locale, 'Loading production recipe gate', 'تحميل بوابة الإنتاج والوصفات')}><EnterpriseV388ProductionGatePage state={state} locale={locale} notify={notify} /></ModuleSuspense>,
    sales: <SalesPage state={state} update={update} locale={locale} />,
    salesGate: <ModuleSuspense label={L(locale, 'Loading sales settlement gate', 'تحميل بوابة تسوية المبيعات')}><EnterpriseV387SalesGatePage state={state} locale={locale} notify={notify} /></ModuleSuspense>,
    finance: <FinancePage state={state} totals={totals} update={update} locale={locale} />,
    financeCloseGate: <ModuleSuspense label={L(locale, 'Loading finance close gate', 'تحميل بوابة الإغلاق المالي')}><EnterpriseV389FinanceCloseGatePage state={state} locale={locale} notify={notify} /></ModuleSuspense>,
    hr: <HRPage state={state} update={update} locale={locale} />,
    hrGate: <ModuleSuspense label={L(locale, 'Loading HR attendance gate', 'تحميل بوابة الموارد البشرية والحضور')}><EnterpriseV390HRGatePage state={state} locale={locale} notify={notify} /></ModuleSuspense>,
    imports: <ModuleSuspense label={L(locale, 'Loading import workspace', 'تحميل الاستيراد')}><ImportExportRoutePage state={state} setState={setState} locale={locale} notify={notify} /></ModuleSuspense>,
    controls: <ControlCenterPage state={state} totals={totals} update={update} locale={locale} notify={notify} />,
    enterprise: <ModuleSuspense label={L(locale, 'Loading enterprise upgrade command', 'تحميل مركز المؤسسة')}><EnterpriseV367UpgradePage state={state} totals={totals} update={update} locale={locale} notify={notify} /></ModuleSuspense>,
    workload: <ModuleSuspense label={L(locale, 'Loading workload operations', 'تحميل عمليات الأحمال')}><EnterpriseV371WorkloadPage state={state} totals={totals} update={update} locale={locale} notify={notify} /></ModuleSuspense>,
    backup: <ModuleSuspense label={L(locale, 'Loading backup center', 'تحميل مركز النسخ الاحتياطي')}><EnterpriseV381BackupPage state={state} totals={totals} update={update} locale={locale} notify={notify} /></ModuleSuspense>,
    backend: <ModuleSuspense label={L(locale, 'Loading backend mode gate', 'تحميل بوابة نمط الخلفية')}><EnterpriseV382BackendModePage locale={locale} notify={notify} /></ModuleSuspense>,
    rbac: <ModuleSuspense label={L(locale, 'Loading RBAC production gate', 'تحميل بوابة الصلاحيات للإنتاج')}><EnterpriseV383RBACPage state={state} locale={locale} notify={notify} /></ModuleSuspense>,
    truth: <ModuleSuspense label={L(locale, 'Loading backend source of truth gate', 'تحميل بوابة مصدر الحقيقة الخلفية')}><EnterpriseV384SourceOfTruthPage state={state} locale={locale} notify={notify} /></ModuleSuspense>,
    reports: <ModuleSuspense label={L(locale, 'Loading reports workspace', 'تحميل التقارير')}><ReportsRoutePage state={state} totals={totals} locale={locale} /></ModuleSuspense>,
    reportPackGate: <ModuleSuspense label={L(locale, 'Loading report pack gate', 'تحميل بوابة حزم التقارير')}><EnterpriseV391V394OperationalConfidencePage gateId="reportPack" state={state} totals={totals} locale={locale} notify={notify} /></ModuleSuspense>,
    alertsGate: <ModuleSuspense label={L(locale, 'Loading alerts and exceptions gate', 'تحميل بوابة التنبيهات والاستثناءات')}><EnterpriseV391V394OperationalConfidencePage gateId="alerts" state={state} totals={totals} locale={locale} notify={notify} /></ModuleSuspense>,
    supportGate: <ModuleSuspense label={L(locale, 'Loading support diagnostics gate', 'تحميل بوابة تشخيص الدعم')}><EnterpriseV391V394OperationalConfidencePage gateId="support" state={state} totals={totals} locale={locale} notify={notify} /></ModuleSuspense>,
    performanceGate: <ModuleSuspense label={L(locale, 'Loading performance budget gate', 'تحميل بوابة ميزانية الأداء')}><EnterpriseV391V394OperationalConfidencePage gateId="performance" state={state} totals={totals} locale={locale} notify={notify} /></ModuleSuspense>,
    tabletGate: <ModuleSuspense label={L(locale, 'Loading tablet readiness gate', 'تحميل بوابة جاهزية الأجهزة')}><EnterpriseV395V400ProductionReadinessPage gateId="tablet" state={state} totals={totals} locale={locale} notify={notify} /></ModuleSuspense>,
    deploymentGate: <ModuleSuspense label={L(locale, 'Loading deployment gate', 'تحميل بوابة النشر')}><EnterpriseV395V400ProductionReadinessPage gateId="deployment" state={state} totals={totals} locale={locale} notify={notify} /></ModuleSuspense>,
    uatGate: <ModuleSuspense label={L(locale, 'Loading UAT gate', 'تحميل بوابة اختبار القبول')}><EnterpriseV395V400ProductionReadinessPage gateId="uat" state={state} totals={totals} locale={locale} notify={notify} /></ModuleSuspense>,
    securityGate: <ModuleSuspense label={L(locale, 'Loading security review gate', 'تحميل بوابة مراجعة الأمن')}><EnterpriseV395V400ProductionReadinessPage gateId="security" state={state} totals={totals} locale={locale} notify={notify} /></ModuleSuspense>,
    rehearsalGate: <ModuleSuspense label={L(locale, 'Loading production rehearsal gate', 'تحميل بوابة تجربة الإطلاق')}><EnterpriseV395V400ProductionReadinessPage gateId="rehearsal" state={state} totals={totals} locale={locale} notify={notify} /></ModuleSuspense>,
    releaseGate: <ModuleSuspense label={L(locale, 'Loading pilot release gate', 'تحميل بوابة الإطلاق التجريبي')}><EnterpriseV395V400ProductionReadinessPage gateId="release" state={state} totals={totals} locale={locale} notify={notify} /></ModuleSuspense>,
    restaurantOps: <ModuleSuspense label={L(locale, 'Loading restaurant operations flow', 'تحميل دورة تشغيل المطعم')}><EnterpriseV456V470RestaurantOpsPage state={state} locale={locale} notify={notify} /></ModuleSuspense>,
  };
  const meta = routeMeta[route];
  return <div className={`app ${theme}`} dir={dir}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">ERP</div><div><strong>{L(locale, 'Restaurant ERP', 'نظام المطاعم')}</strong><span>{L(locale, 'v456-v470 Restaurant Ops', 'v395-v400 Release Gates')}</span></div></div>
      <nav className="nav-list clean">
        {routeGroups.map((group) => <div className="nav-group" key={group.en}>
          <div className="nav-group-title">{L(locale, group.en, group.ar)}</div>
          {group.keys.map((key) => { const Icon = routeMeta[key].icon; return <button key={key} className={`nav-item ${route === key ? 'active' : ''}`} onClick={() => setRoute(key)}><Icon size={18}/><span>{L(locale, routeMeta[key].en, routeMeta[key].ar)}</span></button>; })}
        </div>)}
      </nav>
      <div className="sidebar-card final"><span className="eyebrow">v395-v400 Release Gates</span><p>{L(locale, 'Restaurant Operations Flow now clarifies material requests, reservations, store transfers, internal issues, shortage POs, and Batch No. control.', 'Production Readiness Gates now cover tablet UX, deployment, UAT, security, rehearsal, and pilot release signoff.')}</p></div>
    </aside>
    <main className="main"><header className="topbar"><div><span className="eyebrow">{L(locale, 'Restaurant ERP • Restaurant Operations Flow', 'Restaurant ERP v395-v400 Production Readiness Gates')}</span><h1>{L(locale, meta.en, meta.ar)}</h1></div><div className="top-actions"><select value={state.activeUserId ?? ''} onChange={(e) => setState({ ...state, activeUserId: e.target.value || undefined })}><option value="">{L(locale, 'Local Admin', 'مدير محلي')}</option>{state.employees.map((e) => { const user = (state.userAccounts ?? []).find((u) => u.employeeId === e.id); return <option key={e.id} value={e.id}>{e.name}{user ? ` · ${user.email}` : ''}</option>; })}</select><button onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}>{locale === 'en' ? 'العربية' : 'English'}</button><button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? L(locale, 'Light', 'فاتح') : L(locale, 'Dark', 'داكن')}</button></div></header>{toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}{<ErrorBoundary title={L(locale, 'Module failed to load', 'تعذر تحميل الموديول')} subtitle={L(locale, 'Only this module crashed. The rest of the ERP is protected from a white page.', 'تعطل هذا الموديول فقط، وباقي النظام محمي من الشاشة البيضاء.')} moduleName={route} resetKey={route} storageKey={STORAGE_KEY}>{page[route]}</ErrorBoundary>}</main>
  </div>;
}

function Card({ title, children, icon, action }: { title: string; children: ReactNode; icon?: ReactNode; action?: ReactNode }) { return <section className="card"><div className="card-header"><div className="card-title">{icon}{title}</div>{action}</div>{children}</section>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function KPI({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: ReactNode }) { return <div className="kpi"><div className="kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>; }
function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) { return <div className="table-wrap"><table><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((r, i) => <tr key={i}>{r.map((c, ci) => <td key={ci}>{c}</td>)}</tr>) : <tr><td colSpan={headers.length}>—</td></tr>}</tbody></table></div>; }
function TabButton<T extends string>({ active, value, onClick, children }: { active: T; value: T; onClick: (v: T) => void; children: ReactNode }) { return <button className={active === value ? 'active-tab' : ''} onClick={() => onClick(value)}>{children}</button>; }
function ModuleSuspense({ label, children }: { label: string; children: ReactNode }) { return <Suspense fallback={<div className="notice">{label}</div>}>{children}</Suspense>; }
function actionButtons(onEdit: () => void, onDelete: () => void, locale: Locale) { return <div className="button-row compact"><button onClick={onEdit}><Edit3 size={14}/>{L(locale, 'Edit', 'تعديل')}</button><button className="danger" onClick={onDelete}><Trash2 size={14}/>{L(locale, 'Deactivate', 'تعطيل')}</button></div>; }

type ExecutiveChartDatum = { label: string; value: number; hint?: string };
type ExecutiveKpiTone = 'good' | 'warn' | 'bad' | 'info' | 'neutral';

function compactNumber(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);
}
function percentText(value: number) { return Number.isFinite(value) ? `${value.toFixed(1)}%` : '0.0%'; }
function clampPercent(value: number) { return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)); }
function chartDataHasValue(data: ExecutiveChartDatum[]) { return data.some((d) => Math.abs(d.value || 0) > 0.0001); }
function combineData(rows: ExecutiveChartDatum[]) {
  const map = new Map<string, number>();
  rows.forEach((r) => map.set(r.label, (map.get(r.label) ?? 0) + Number(r.value || 0)));
  return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
}

function categoryDisplayName(cat: MasterCategory | undefined, locale: Locale) { return cat ? L(locale, cat.nameEn, cat.nameAr) : ''; }
function normalizeCategoryName(value: string) { return value.trim().replace(/\s+/g, ' '); }
function allCategoryNames(state: ERPState, kind: CategoryKind, locale: Locale) {
  const seeded = (kind === 'item' ? state.itemCategories : state.menuCategories).filter((c) => c.active !== false).map((c) => categoryDisplayName(c, locale));
  const used = (kind === 'item' ? state.items : state.menuItems).map((x) => x.category || '').filter(Boolean);
  const map = new Map<string, string>();
  [...seeded, ...used].forEach((name) => { const clean = normalizeCategoryName(name); if (clean) map.set(clean.toLowerCase(), clean); });
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
}
function ensureCategoryRecord(state: ERPState, kind: CategoryKind, name: string): ERPState {
  const clean = normalizeCategoryName(name || (kind === 'item' ? 'Uncategorized' : 'Menu'));
  const key = clean.toLowerCase();
  const list = kind === 'item' ? state.itemCategories : state.menuCategories;
  if (list.some((c) => c.active !== false && (c.nameEn.toLowerCase() === key || c.nameAr.toLowerCase() === key))) return state;
  const record: MasterCategory = { id: id(kind === 'item' ? 'ICAT' : 'MCAT'), kind, nameEn: clean, nameAr: clean, active: true };
  return kind === 'item' ? { ...state, itemCategories: [...state.itemCategories, record] } : { ...state, menuCategories: [...state.menuCategories, record] };
}
function renameCategoryEverywhere(state: ERPState, kind: CategoryKind, oldName: string, nextName: string): ERPState {
  const clean = normalizeCategoryName(nextName);
  const oldKey = normalizeCategoryName(oldName).toLowerCase();
  if (!clean || !oldKey) return state;
  if (kind === 'item') return { ...state, itemCategories: state.itemCategories.map((c) => (c.nameEn.toLowerCase() === oldKey || c.nameAr.toLowerCase() === oldKey) ? { ...c, nameEn: clean, nameAr: clean } : c), items: state.items.map((it) => normalizeCategoryName(it.category).toLowerCase() === oldKey ? { ...it, category: clean } : it) };
  return { ...state, menuCategories: state.menuCategories.map((c) => (c.nameEn.toLowerCase() === oldKey || c.nameAr.toLowerCase() === oldKey) ? { ...c, nameEn: clean, nameAr: clean } : c), menuItems: state.menuItems.map((m) => normalizeCategoryName(m.category).toLowerCase() === oldKey ? { ...m, category: clean } : m) };
}
function filteredStateForPeriod(state: ERPState, from: string, to: string): ERPState {
  if (!from && !to) return state;
  const inPeriod = (date?: string) => dateInRange(date, from || undefined, to || undefined);
  return {
    ...state,
    stockMovements: state.stockMovements.filter((x) => inPeriod(x.date)),
    journals: state.journals.filter((x) => inPeriod(x.date)),
    purchaseInvoices: state.purchaseInvoices.filter((x) => inPeriod(x.invoiceDate)),
    materialRequests: state.materialRequests.filter((x) => inPeriod(x.date)),
    purchaseOrders: state.purchaseOrders.filter((x) => inPeriod(x.date)),
    goodsReceipts: state.goodsReceipts.filter((x) => inPeriod(x.date)),
    supplierPayments: state.supplierPayments.filter((x) => inPeriod(x.date)),
    productions: state.productions.filter((x) => inPeriod(x.date)),
    sales: state.sales.filter((x) => inPeriod(x.date)),
    transfers: state.transfers.filter((x) => inPeriod(x.date)),
    attendance: state.attendance.filter((x) => inPeriod(x.date)),
    schedules: state.schedules.filter((x) => inPeriod(x.date)),
    fixedAssets: state.fixedAssets.filter((x) => !to || x.purchaseDate <= to),
    arInvoices: state.arInvoices.filter((x) => inPeriod(x.date)),
    audits: state.audits.filter((x) => inPeriod(x.at?.slice(0, 10))),
    inventoryLots: state.inventoryLots.filter((x) => inPeriod(x.receivedDate)),
    inventoryApprovals: state.inventoryApprovals.filter((x) => inPeriod(x.date)),
    supplierReturns: state.supplierReturns.filter((x) => inPeriod(x.date)),
    bankReconLines: state.bankReconLines.filter((x) => inPeriod(x.date)),
  };
}
function salesByDateData(state: ERPState, locale: Locale): ExecutiveChartDatum[] {
  const rows = combineData(state.sales.map((sale) => ({ label: sale.date.slice(5), value: calculateSalesAmounts(state.menuItems.find((m) => m.id === sale.menuItemId), sale.qty).netSales })));
  if (rows.length) return rows.sort((a, b) => a.label.localeCompare(b.label));
  return [L(locale, 'Setup', 'إعداد'), L(locale, 'Purchase', 'شراء'), L(locale, 'Production', 'إنتاج'), L(locale, 'Sales', 'بيع')].map((label) => ({ label, value: 0 }));
}
function branchSalesData(state: ERPState, locale: Locale): ExecutiveChartDatum[] {
  return state.branches.map((branch) => ({
    label: L(locale, branch.nameEn, branch.nameAr),
    value: state.sales.filter((sale) => sale.branchId === branch.id).reduce((sum, sale) => sum + calculateSalesAmounts(state.menuItems.find((m) => m.id === sale.menuItemId), sale.qty).netSales, 0),
  })).filter((row) => row.value > 0).slice(0, 6);
}
function inventoryCategoryData(state: ERPState): ExecutiveChartDatum[] {
  return combineData(availableRows(state).map((row) => ({ label: row.item.category || 'Uncategorized', value: Math.max(0, row.onHand * row.cost) }))).filter((row) => row.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);
}
function storeValueData(state: ERPState, locale: Locale): ExecutiveChartDatum[] {
  return state.stores.map((store) => ({
    label: L(locale, store.nameEn, store.nameAr),
    value: availableRows(state).filter((row) => row.store.id === store.id).reduce((sum, row) => sum + Math.max(0, row.onHand * row.cost), 0),
  })).filter((row) => row.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);
}
function menuMarginData(state: ERPState, locale: Locale): ExecutiveChartDatum[] {
  return state.menuItems.map((menu) => {
    const qtySold = state.sales.filter((sale) => sale.menuItemId === menu.id && sale.posted).reduce((sum, sale) => sum + sale.qty, 0);
    const netUnit = calculateSalesAmounts(menu, 1).netSales;
    const recipeUnitCost = recipeCost(state, menu.id);
    const marginPct = netUnit ? ((netUnit - recipeUnitCost) / netUnit) * 100 : 0;
    return { label: L(locale, menu.nameEn, menu.nameAr), value: marginPct, hint: qtySold ? L(locale, `${qtySold} sold`, `مباع ${qtySold}`) : L(locale, 'Recipe margin', 'هامش الوصفة') };
  }).filter((row) => row.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);
}
function supplierExposureData(state: ERPState): ExecutiveChartDatum[] {
  return state.suppliers.map((supplier) => ({ label: supplier.name, value: supplierOpenInvoices(state, supplier.id).reduce((sum, inv) => sum + supplierInvoiceBalance(state, inv), 0) })).filter((row) => row.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);
}
function purchaseStatusData(state: ERPState, locale: Locale): ExecutiveChartDatum[] {
  const labels: Record<PurchaseOrder['status'], string> = {
    draft: L(locale, 'Draft', 'مسودة'), approved: L(locale, 'Approved', 'معتمد'), partially_received: L(locale, 'Partial', 'جزئي'), received: L(locale, 'Received', 'مستلم'), closed: L(locale, 'Closed', 'مغلق'), cancelled: L(locale, 'Cancelled', 'ملغي'),
  };
  return combineData(state.purchaseOrders.map((po) => ({ label: labels[po.status], value: 1 }))).filter((row) => row.value > 0);
}
function productionOutputData(state: ERPState): ExecutiveChartDatum[] {
  return state.productions.map((doc) => ({ label: doc.ref, value: doc.actualOutputQty, hint: `plan ${doc.plannedOutputQty}` })).slice(0, 6);
}


type SmartLensKey = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'customPeriod' | 'customPeriodProducts' | 'hourlyMetrics' | 'hourlySales' | 'hourlyMenu' | 'hourlyOptions' | 'financeWide' | 'inventoryWide' | 'purchasingWide' | 'productionWide';
type SmartLensGroup = { key: string; labelEn: string; labelAr: string; items: Array<{ key: SmartLensKey; labelEn: string; labelAr: string; icon: ReactNode }> };
type ComparisonRow = { label: string; current: string; previous: string; delta: string; tone: ExecutiveKpiTone };
type ComparisonMode = 'yesterday' | 'sameDayLastWeek' | 'sameDayLastYear' | 'previousSameLength' | 'previousMonth' | 'custom';
type SmartStudioMode = 'kpis' | 'reportStudio' | 'importCenter' | 'actionCenter' | 'dataQuality' | 'savedViews';
type CustomKpiDraft = { name: string; formula: string; chartType: SmartChartShape; target: number; warning: number; critical: number; color: string; visible: boolean };
type SavedSmartView = { id: string; name: string; from: string; to: string; selectedKeys: string[]; comparisonMode: ComparisonMode; chartShape: SmartChartShape; colors: Record<string, string> };

function isoDateFrom(value?: string) { return String(value || '').slice(0, 10); }
function asDate(value: string) { return new Date((value || today()) + 'T00:00:00'); }
function addDaysIso(value: string, days: number) { const d = asDate(value); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }
function daysBetweenInclusive(from: string, to: string) { return Math.max(1, Math.round((asDate(to).getTime() - asDate(from).getTime()) / 86400000) + 1); }
function startOfWeekIso(value = today()) { const d = asDate(value); const day = d.getDay(); const diff = day === 0 ? -6 : 1 - day; d.setDate(d.getDate() + diff); return d.toISOString().slice(0, 10); }
function endOfWeekIso(value = today()) { return addDaysIso(startOfWeekIso(value), 6); }
function endOfMonthIso(value = today()) { const d = asDate(value); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10); }
function shiftMonthIso(value: string, months: number) { const d = asDate(value); return new Date(d.getFullYear(), d.getMonth() + months, d.getDate()).toISOString().slice(0, 10); }
function smartLensBounds(lens: SmartLensKey, customFrom: string, customTo: string) {
  const end = today();
  if (lens === 'today' || lens === 'hourlyMetrics' || lens === 'hourlySales' || lens === 'hourlyMenu' || lens === 'hourlyOptions') return { from: end, to: end };
  if (lens === 'yesterday') { const y = addDaysIso(end, -1); return { from: y, to: y }; }
  if (lens === 'thisWeek') return { from: startOfWeekIso(end), to: end };
  if (lens === 'lastWeek') { const start = addDaysIso(startOfWeekIso(end), -7); return { from: start, to: addDaysIso(start, 6) }; }
  if (lens === 'thisMonth') return { from: startOfMonthIso(end), to: end };
  if (lens === 'lastMonth') { const shifted = shiftMonthIso(startOfMonthIso(end), -1); return { from: startOfMonthIso(shifted), to: endOfMonthIso(shifted) }; }
  if (lens === 'thisYear') return { from: startOfYearIso(end), to: end };
  return { from: customFrom, to: customTo };
}
function previousComparableBounds(from: string, to: string) {
  if (!from || !to) return { from: '', to: '' };
  const days = daysBetweenInclusive(from, to);
  const prevTo = addDaysIso(from, -1);
  const prevFrom = addDaysIso(prevTo, -(days - 1));
  return { from: prevFrom, to: prevTo };
}
function comparisonBoundsForMode(mode: ComparisonMode, from: string, to: string, customFrom: string, customTo: string) {
  if (!from || !to) return { from: '', to: '' };
  if (mode === 'custom') return { from: customFrom, to: customTo };
  if (mode === 'previousSameLength') return previousComparableBounds(from, to);
  if (mode === 'yesterday') { const y = addDaysIso(to, -1); return { from: y, to: y }; }
  if (mode === 'sameDayLastWeek') return { from: addDaysIso(from, -7), to: addDaysIso(to, -7) };
  if (mode === 'sameDayLastYear') return { from: addDaysIso(from, -364), to: addDaysIso(to, -364) };
  const shiftedFrom = shiftMonthIso(from, -1);
  const shiftedTo = shiftMonthIso(to, -1);
  return { from: shiftedFrom, to: shiftedTo };
}
function metricMapFromTotals(totals: Totals, orders: number) {
  return {
    netSales: totals.salesNet,
    grossSales: totals.salesGross,
    orders,
    avgTicket: orders ? totals.salesNet / orders : 0,
    grossProfit: totals.grossProfit,
    grossMargin: totals.salesNet ? (totals.grossProfit / totals.salesNet) * 100 : 0,
    foodCost: totals.cogs,
    foodCostPct: totals.salesNet ? (totals.cogs / totals.salesNet) * 100 : 0,
    inventoryValue: totals.stockValue,
    cash: totals.cash,
    ap: totals.ap,
    ar: totals.ar,
    vatPayable: totals.vatPayable,
    netIncome: totals.netIncome,
  } as Record<string, number>;
}
function evaluateCustomKpiFormula(formula: string, metrics: Record<string, number>) {
  const safe = String(formula || '0').replace(/[a-zA-Z][a-zA-Z0-9_]*/g, (name) => String(metrics[name] ?? 0));
  if (!/^[0-9+\-*/().\s]+$/.test(safe)) return 0;
  try { return Number(Function(`"use strict"; return (${safe});`)()) || 0; } catch { return 0; }
}
function smartDataQualityRows(state: ERPState, locale: Locale) {
  return [
    { area: L(locale, 'Chart of accounts', 'دليل الحسابات'), status: state.chartAccounts.length > 0 ? 'ok' : 'critical', detail: `${state.chartAccounts.length} accounts`, action: L(locale, 'Load default COA before finance cutover', 'حمّل دليل الحسابات قبل الانتقال المالي') },
    { area: L(locale, 'Menu categories', 'تصنيفات المنيو'), status: state.menuItems.every((item) => item.category) ? 'ok' : 'warning', detail: `${state.menuItems.filter((item) => !item.category).length} missing`, action: L(locale, 'Fill category info in Setup → Menu Items', 'أكمل التصنيف في الإعدادات ← أصناف البيع') },
    { area: L(locale, 'Item categories', 'تصنيفات الأصناف'), status: state.items.every((item) => item.category) ? 'ok' : 'warning', detail: `${state.items.filter((item) => !item.category).length} missing`, action: L(locale, 'Fill category info in Setup → Items', 'أكمل التصنيف في الإعدادات ← الأصناف') },
    { area: L(locale, 'Ledger balance', 'توازن الأستاذ'), status: state.journals.filter((j) => !journalBalance(j).balanced).length ? 'critical' : 'ok', detail: `${state.journals.filter((j) => !journalBalance(j).balanced).length} unbalanced`, action: L(locale, 'Repair before exporting management reports', 'عالجها قبل تصدير التقارير الإدارية') },
    { area: L(locale, 'Stock balances', 'أرصدة المخزون'), status: availableRows(state).some((row) => row.onHand < 0) ? 'critical' : 'ok', detail: `${availableRows(state).filter((row) => row.onHand < 0).length} negative`, action: L(locale, 'Run stock count and variance approval', 'شغّل الجرد واعتماد الفروقات') },
  ];
}
function smartActionRows(state: ERPState, totals: Totals, locale: Locale) {
  const rows = [] as Array<{ priority: string; owner: string; action: string; due: string; tone: 'good' | 'warn' | 'bad' | 'info' }>;
  if (totals.ap > totals.cash) rows.push({ priority: L(locale, 'High', 'عالي'), owner: L(locale, 'Finance', 'المالية'), action: L(locale, 'Review AP payment run because supplier exposure exceeds cash.', 'راجع دفعة الموردين لأن الالتزامات أعلى من النقد.'), due: L(locale, 'Today', 'اليوم'), tone: 'bad' });
  const low = lowStockData(state, locale).length;
  if (low) rows.push({ priority: L(locale, 'Medium', 'متوسط'), owner: L(locale, 'Inventory', 'المخزون'), action: L(locale, `Reorder or transfer ${low} low-stock SKU(s).`, `أعد الطلب أو حوّل ${low} صنف منخفض.`), due: L(locale, '24h', '٢٤ ساعة'), tone: 'warn' });
  const unbalanced = state.journals.filter((j) => !journalBalance(j).balanced).length;
  if (unbalanced) rows.push({ priority: L(locale, 'Critical', 'حرج'), owner: L(locale, 'Accounting', 'المحاسبة'), action: L(locale, `Fix ${unbalanced} unbalanced journal(s) before close.`, `أصلح ${unbalanced} قيد غير متوازن قبل الإقفال.`), due: L(locale, 'Before close', 'قبل الإقفال'), tone: 'bad' });
  if (!rows.length) rows.push({ priority: L(locale, 'Normal', 'طبيعي'), owner: L(locale, 'Management', 'الإدارة'), action: L(locale, 'No immediate exceptions from the current report pack.', 'لا توجد استثناءات فورية من حزمة التقرير الحالية.'), due: L(locale, 'Monitor', 'متابعة'), tone: 'good' });
  return rows;
}
function smartLensDefaultKeys(lens: SmartLensKey): string[] {
  if (lens === 'hourlyMetrics') return ['hourlySales', 'hourlyOrders', 'avgTicket', 'paymentMethodMix', 'discounts', 'voids', 'returns'];
  if (lens === 'hourlySales') return ['hourlySales', 'orders', 'avgTicket', 'branchSales', 'paymentMethodMix'];
  if (lens === 'hourlyMenu') return ['productNetQty', 'productQuantity', 'menuMargin', 'categorySalesQty'];
  if (lens === 'hourlyOptions') return ['controls', 'discounts', 'voids', 'returns'];
  if (lens === 'customPeriodProducts') return ['productNetQty', 'productQuantity', 'productMargin', 'categorySalesQty', 'productReturns', 'productVoids'];
  if (lens === 'financeWide') return ['netSales', 'grossMargin', 'cash', 'vat', 'financeWide', 'supplierExposure', 'apPayments'];
  if (lens === 'inventoryWide') return ['inventoryValue', 'inventoryHealth', 'stockByStore', 'lowStock', 'categorySalesQty', 'productQuantity'];
  if (lens === 'purchasingWide') return ['supplierExposure', 'apPayments', 'paymentMethodMix', 'controls'];
  if (lens === 'productionWide') return ['production', 'menuMargin', 'productMargin', 'inventoryValue'];
  return ['netSales', 'orders', 'avgTicket', 'grossMargin', 'branchComparison', 'productNetQty', 'paymentsAmount', 'paymentMethodMix', 'discounts', 'voids', 'returns'];
}
function smartLensTitle(lens: SmartLensKey, locale: Locale) {
  const map: Record<SmartLensKey, { en: string; ar: string }> = {
    today: { en: 'Today comparison', ar: 'مقارنة اليوم' },
    yesterday: { en: 'Yesterday comparison', ar: 'مقارنة الأمس' },
    thisWeek: { en: 'This week comparison', ar: 'مقارنة هذا الأسبوع' },
    lastWeek: { en: 'Last week comparison', ar: 'مقارنة الأسبوع الماضي' },
    thisMonth: { en: 'This month comparison', ar: 'مقارنة هذا الشهر' },
    lastMonth: { en: 'Last month comparison', ar: 'مقارنة الشهر الماضي' },
    thisYear: { en: 'This year comparison', ar: 'مقارنة هذه السنة' },
    customPeriod: { en: 'Custom period comparison', ar: 'مقارنة فترة مخصصة' },
    customPeriodProducts: { en: 'Custom period products', ar: 'منتجات فترة مخصصة' },
    hourlyMetrics: { en: 'Hourly metrics', ar: 'مؤشرات كل ساعة' },
    hourlySales: { en: 'Hourly sales analysis', ar: 'تحليل المبيعات بالساعة' },
    hourlyMenu: { en: 'Hourly menu analysis', ar: 'تحليل المنيو بالساعة' },
    hourlyOptions: { en: 'Hourly option analysis', ar: 'تحليل الخيارات بالساعة' },
    financeWide: { en: 'Platform finance comparison', ar: 'مقارنة مالية شاملة' },
    inventoryWide: { en: 'Platform inventory comparison', ar: 'مقارنة مخزون شاملة' },
    purchasingWide: { en: 'Platform purchasing comparison', ar: 'مقارنة مشتريات شاملة' },
    productionWide: { en: 'Platform production comparison', ar: 'مقارنة إنتاج شاملة' },
  };
  return L(locale, map[lens].en, map[lens].ar);
}
function saleNetValue(state: ERPState, sale: SaleDoc) { return calculateSalesAmounts(state.menuItems.find((m) => m.id === sale.menuItemId), sale.qty).netSales; }
function saleGrossValue(state: ERPState, sale: SaleDoc) { return calculateSalesAmounts(state.menuItems.find((m) => m.id === sale.menuItemId), sale.qty).grossSales; }
function salesCountByDateData(state: ERPState, locale: Locale): ExecutiveChartDatum[] {
  const rows = combineData(state.sales.map((sale) => ({ label: sale.date.slice(5), value: 1 })));
  if (rows.length) return rows.sort((a, b) => a.label.localeCompare(b.label));
  return [L(locale, 'No sales', 'لا توجد مبيعات')].map((label) => ({ label, value: 0 }));
}
function averageTicketByDateData(state: ERPState, locale: Locale): ExecutiveChartDatum[] {
  const map = new Map<string, { sales: number; count: number }>();
  state.sales.forEach((sale) => { const label = sale.date.slice(5); const current = map.get(label) ?? { sales: 0, count: 0 }; current.sales += saleNetValue(state, sale); current.count += 1; map.set(label, current); });
  const rows = Array.from(map.entries()).map(([label, row]) => ({ label, value: row.count ? row.sales / row.count : 0 }));
  if (rows.length) return rows.sort((a, b) => a.label.localeCompare(b.label));
  return [L(locale, 'No sales', 'لا توجد مبيعات')].map((label) => ({ label, value: 0 }));
}
function salesByPaymentMethodData(state: ERPState, locale: Locale): ExecutiveChartDatum[] {
  const rows = combineData(state.sales.map((sale) => ({ label: sale.paymentMethod || L(locale, 'Unspecified', 'غير محدد'), value: saleGrossValue(state, sale) })));
  return rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value).slice(0, 8);
}
function salesCountByPaymentMethodData(state: ERPState, locale: Locale): ExecutiveChartDatum[] {
  const rows = combineData(state.sales.map((sale) => ({ label: sale.paymentMethod || L(locale, 'Unspecified', 'غير محدد'), value: 1 })));
  return rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value).slice(0, 8);
}
function salesByProductData(state: ERPState, locale: Locale): ExecutiveChartDatum[] {
  return state.menuItems.map((menu) => {
    const related = state.sales.filter((sale) => sale.menuItemId === menu.id && sale.posted);
    const value = related.reduce((sum, sale) => sum + saleNetValue(state, sale), 0);
    const quantity = related.reduce((sum, sale) => sum + Number(sale.qty || 0), 0);
    return { label: L(locale, menu.nameEn, menu.nameAr), value, hint: L(locale, `${qty(quantity)} sold`, `مباع ${qty(quantity)}`) };
  }).filter((row) => row.value > 0).sort((a, b) => b.value - a.value).slice(0, 10);
}
function salesQuantityByProductData(state: ERPState, locale: Locale): ExecutiveChartDatum[] {
  return state.menuItems.map((menu) => ({ label: L(locale, menu.nameEn, menu.nameAr), value: state.sales.filter((sale) => sale.menuItemId === menu.id && sale.posted).reduce((sum, sale) => sum + Number(sale.qty || 0), 0) })).filter((row) => row.value > 0).sort((a, b) => b.value - a.value).slice(0, 10);
}
function salesByCategoryData(state: ERPState, locale: Locale): ExecutiveChartDatum[] {
  return combineData(state.sales.map((sale) => {
    const menu = state.menuItems.find((m) => m.id === sale.menuItemId);
    return { label: menu?.category || L(locale, 'Uncategorized', 'غير مصنف'), value: saleNetValue(state, sale), hint: qty(sale.qty) };
  })).filter((row) => row.value > 0).sort((a, b) => b.value - a.value).slice(0, 10);
}
function productMarginAmountData(state: ERPState, locale: Locale): ExecutiveChartDatum[] {
  return state.menuItems.map((menu) => {
    const soldQty = state.sales.filter((sale) => sale.menuItemId === menu.id && sale.posted).reduce((sum, sale) => sum + sale.qty, 0);
    const net = calculateSalesAmounts(menu, soldQty).netSales;
    const cost = recipeCost(state, menu.id) * soldQty;
    return { label: L(locale, menu.nameEn, menu.nameAr), value: Math.max(0, net - cost), hint: `${percentText(net ? ((net - cost) / net) * 100 : 0)} margin` };
  }).filter((row) => row.value > 0).sort((a, b) => b.value - a.value).slice(0, 10);
}
function salesByHourData(state: ERPState, locale: Locale): ExecutiveChartDatum[] {
  if (!state.sales.length) return [{ label: L(locale, 'No hourly sales', 'لا توجد مبيعات بالساعة'), value: 0 }];
  const rows = combineData(state.sales.map((sale, index) => {
    const hasTime = sale.date.includes('T') || sale.date.includes(' ');
    const rawHour = hasTime ? new Date(sale.date).getHours() : 8 + (index % 14);
    const label = `${String(rawHour).padStart(2, '0')}:00`;
    return { label, value: saleNetValue(state, sale) };
  }));
  return rows.sort((a, b) => a.label.localeCompare(b.label));
}
function ordersByHourData(state: ERPState, locale: Locale): ExecutiveChartDatum[] {
  if (!state.sales.length) return [{ label: L(locale, 'No hourly orders', 'لا توجد طلبات بالساعة'), value: 0 }];
  const rows = combineData(state.sales.map((sale, index) => {
    const hasTime = sale.date.includes('T') || sale.date.includes(' ');
    const rawHour = hasTime ? new Date(sale.date).getHours() : 8 + (index % 14);
    const label = `${String(rawHour).padStart(2, '0')}:00`;
    return { label, value: 1 };
  }));
  return rows.sort((a, b) => a.label.localeCompare(b.label));
}
function branchComparisonData(current: ERPState, previous: ERPState, locale: Locale): ExecutiveChartDatum[] {
  return current.branches.map((branch) => {
    const currentValue = current.sales.filter((sale) => sale.branchId === branch.id).reduce((sum, sale) => sum + saleNetValue(current, sale), 0);
    const previousValue = previous.sales.filter((sale) => sale.branchId === branch.id).reduce((sum, sale) => sum + saleNetValue(previous, sale), 0);
    return { label: L(locale, branch.nameEn, branch.nameAr), value: currentValue, hint: `${L(locale, 'Prior', 'السابق')}: ${money(previousValue, locale)} · ${deltaText(currentValue, previousValue)}` };
  }).filter((row) => row.value > 0 || (row.hint || '').includes('Prior')).sort((a, b) => b.value - a.value).slice(0, 8);
}
function paymentReturnsData(state: ERPState, locale: Locale): ExecutiveChartDatum[] {
  const supplierReturnValue = (state.supplierReturns ?? []).reduce((sum, doc) => sum + Number(doc.qty || 0) * Number(doc.unitCost || 0), 0);
  const adjustments = (state.inventoryApprovals ?? []).filter((x) => x.status === 'posted').reduce((sum, row) => sum + Math.abs(Number(row.qty || 0) * Number(row.unitCost || 0)), 0);
  return [
    { label: L(locale, 'Supplier returns', 'مرتجعات الموردين'), value: supplierReturnValue },
    { label: L(locale, 'Inventory adjustments', 'تسويات المخزون'), value: adjustments },
    { label: L(locale, 'POS returns pending import', 'مرتجعات الكاشير بانتظار الاستيراد'), value: 0 },
  ];
}
function lowStockData(state: ERPState, locale: Locale): ExecutiveChartDatum[] {
  return state.items.map((item) => {
    const onHand = state.stores.reduce((sum, store) => sum + getBalance(state, store.id, item.id), 0);
    const threshold = Math.max(item.reorderPoint || item.minStock || 0, 0);
    return { label: L(locale, item.nameEn, item.nameAr), value: Math.max(0, threshold - onHand), hint: `${L(locale, 'On hand', 'المتوفر')}: ${qty(onHand, item.consumptionUnit)}` };
  }).filter((row) => row.value > 0).sort((a, b) => b.value - a.value).slice(0, 8);
}
function smartInventoryHealthRows(state: ERPState, locale: Locale): ExecutiveChartDatum[] {
  const lowStock = lowStockData(state, locale).length;
  const nearExpiry = (state.inventoryLots ?? []).filter((lot) => lot.status === 'available' && daysUntil(lot.expiryDate) <= 7).length;
  const quarantine = (state.inventoryLots ?? []).filter((lot) => lot.status === 'quarantine').length;
  const negative = availableRows(state).filter((row) => row.onHand < 0).length;
  return [
    { label: L(locale, 'Low stock', 'مخزون منخفض'), value: lowStock },
    { label: L(locale, 'Near expiry', 'قرب انتهاء صلاحية'), value: nearExpiry },
    { label: L(locale, 'Quarantine', 'حجر'), value: quarantine },
    { label: L(locale, 'Negative balances', 'أرصدة سالبة'), value: negative },
  ];
}
function postedSupplierPaymentsData(state: ERPState, locale: Locale): ExecutiveChartDatum[] {
  const rows = combineData(state.supplierPayments.filter((p) => p.status === 'posted').map((p) => ({ label: supplierName(state, p.supplierId) || L(locale, 'Supplier', 'مورد'), value: p.amount })));
  return rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value).slice(0, 8);
}
function financeWideData(state: ERPState, totals: Totals, locale: Locale): ExecutiveChartDatum[] {
  return [
    { label: L(locale, 'Revenue', 'الإيراد'), value: totals.salesNet },
    { label: L(locale, 'COGS', 'تكلفة المبيعات'), value: Math.abs(totals.cogs) },
    { label: L(locale, 'Expenses', 'المصاريف'), value: Math.abs(totals.expenses) },
    { label: L(locale, 'Cash', 'النقد'), value: totals.cash },
    { label: L(locale, 'AP', 'الموردون'), value: Math.abs(totals.ap) },
    { label: L(locale, 'AR', 'العملاء'), value: Math.abs(totals.ar) },
  ].filter((x) => Number.isFinite(x.value));
}
function deltaPercentValue(current: number, previous: number) { return previous ? ((current - previous) / Math.abs(previous)) * 100 : current ? 100 : 0; }
function deltaText(current: number, previous: number) {
  const delta = deltaPercentValue(current, previous);
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%`;
}
function deltaTone(current: number, previous: number, lowerIsBetter = false): ExecutiveKpiTone {
  if (Math.abs(current - previous) < 0.0001) return 'neutral';
  const improving = lowerIsBetter ? current < previous : current > previous;
  return improving ? 'good' : 'warn';
}
function buildComparisonRows(current: ERPState, previous: ERPState, locale: Locale): ComparisonRow[] {
  const currentTotals = calculateTotalsFromState(current);
  const previousTotals = calculateTotalsFromState(previous);
  const currentOrders = current.sales.length;
  const previousOrders = previous.sales.length;
  const currentAvg = currentOrders ? currentTotals.salesNet / currentOrders : 0;
  const previousAvg = previousOrders ? previousTotals.salesNet / previousOrders : 0;
  const currentFoodCost = currentTotals.salesNet ? (currentTotals.cogs / currentTotals.salesNet) * 100 : 0;
  const previousFoodCost = previousTotals.salesNet ? (previousTotals.cogs / previousTotals.salesNet) * 100 : 0;
  const currentLowStock = lowStockData(current, locale).length;
  const previousLowStock = lowStockData(previous, locale).length;
  return [
    { label: L(locale, 'Net Sales', 'صافي المبيعات'), current: money(currentTotals.salesNet, locale), previous: money(previousTotals.salesNet, locale), delta: deltaText(currentTotals.salesNet, previousTotals.salesNet), tone: deltaTone(currentTotals.salesNet, previousTotals.salesNet) },
    { label: L(locale, 'Orders', 'الطلبات'), current: `${currentOrders}`, previous: `${previousOrders}`, delta: deltaText(currentOrders, previousOrders), tone: deltaTone(currentOrders, previousOrders) },
    { label: L(locale, 'Net Sales / Order', 'صافي المبيعات لكل طلب'), current: money(currentAvg, locale), previous: money(previousAvg, locale), delta: deltaText(currentAvg, previousAvg), tone: deltaTone(currentAvg, previousAvg) },
    { label: L(locale, 'Food Cost %', 'نسبة تكلفة الغذاء'), current: percentText(currentFoodCost), previous: percentText(previousFoodCost), delta: deltaText(currentFoodCost, previousFoodCost), tone: deltaTone(currentFoodCost, previousFoodCost, true) },
    { label: L(locale, 'Cash Movement', 'حركة النقد'), current: money(currentTotals.cash, locale), previous: money(previousTotals.cash, locale), delta: deltaText(currentTotals.cash, previousTotals.cash), tone: deltaTone(currentTotals.cash, previousTotals.cash) },
    { label: L(locale, 'Inventory Value', 'قيمة المخزون'), current: money(currentTotals.stockValue, locale), previous: money(previousTotals.stockValue, locale), delta: deltaText(currentTotals.stockValue, previousTotals.stockValue), tone: deltaTone(currentTotals.stockValue, previousTotals.stockValue) },
    { label: L(locale, 'AP Exposure', 'التزامات الموردين'), current: money(currentTotals.ap, locale), previous: money(previousTotals.ap, locale), delta: deltaText(currentTotals.ap, previousTotals.ap), tone: deltaTone(currentTotals.ap, previousTotals.ap, true) },
    { label: L(locale, 'Low Stock SKUs', 'أصناف منخفضة'), current: `${currentLowStock}`, previous: `${previousLowStock}`, delta: deltaText(currentLowStock, previousLowStock), tone: deltaTone(currentLowStock, previousLowStock, true) },
  ];
}
function exportComparisonCsv(rows: ComparisonRow[]) {
  return rowsToCsv(rows.map((row) => ({ KPI: row.label, Current: row.current, Previous: row.previous, Delta: row.delta, Tone: row.tone })));
}
function cashMovementData(state: ERPState, locale: Locale): ExecutiveChartDatum[] {
  const cashCodes = new Set(['1010', '1020', '1100']);
  const rows = combineData(state.journals.filter((j) => j.status === 'posted').flatMap((j) => j.lines.filter((line) => cashCodes.has(line.accountCode)).map((line) => ({ label: j.date.slice(5), value: Number(line.debit || 0) - Number(line.credit || 0) }))));
  if (rows.length) return rows.sort((a, b) => a.label.localeCompare(b.label));
  return [L(locale, 'Open', 'افتتاحي'), L(locale, 'Ops', 'تشغيل'), L(locale, 'Close', 'إقفال')].map((label) => ({ label, value: 0 }));
}
function controlRiskData(state: ERPState, locale: Locale): ExecutiveChartDatum[] {
  const pendingApprovals = (state.inventoryApprovals ?? []).filter((x) => x.status === 'pending').length;
  const drafts = state.journals.filter((j) => j.status === 'draft').length + state.purchaseInvoices.filter((x) => x.status === 'draft').length + state.productions.filter((x) => x.status === 'draft').length + state.materialRequests.filter((x) => x.status === 'draft').length;
  const unbalanced = state.journals.filter((j) => !journalBalance(j).balanced).length;
  const lockedPeriods = (state.fiscalPeriods ?? []).filter((p) => p.status === 'locked' || p.status === 'closed').length;
  return [
    { label: L(locale, 'Pending approvals', 'اعتمادات معلقة'), value: pendingApprovals },
    { label: L(locale, 'Draft docs', 'مستندات مسودة'), value: drafts },
    { label: L(locale, 'Unbalanced JEs', 'قيود غير متوازنة'), value: unbalanced },
    { label: L(locale, 'Locked periods', 'فترات مقفلة'), value: lockedPeriods },
  ];
}
function setupReadinessChecks(state: ERPState, totals: Totals, locale: Locale) {
  const unbalancedJournals = state.journals.filter((j) => !journalBalance(j).balanced).length;
  return [
    { ok: state.branches.length > 0, text: L(locale, 'Branches configured', 'تم إعداد الفروع') },
    { ok: state.stores.length > 0, text: L(locale, 'Stores and kitchens configured', 'تم إعداد المخازن والمطابخ') },
    { ok: state.chartAccounts.length > 20, text: L(locale, 'Professional chart of accounts', 'دليل حسابات احترافي') },
    { ok: state.items.length > 0, text: L(locale, 'Inventory item master ready', 'بطاقة الأصناف جاهزة') },
    { ok: state.menuItems.length > 0 && state.recipeLines.length > 0, text: L(locale, 'POS menu linked to recipes', 'قائمة الكاشير مربوطة بالوصفات') },
    { ok: state.purchaseInvoices.some((x) => x.status === 'posted'), text: L(locale, 'Purchasing cycle posted', 'دورة مشتريات مرحلة') },
    { ok: state.stockMovements.length > 0 && totals.stockValue >= 0, text: L(locale, 'Inventory costing is moving', 'تكلفة المخزون متحركة') },
    { ok: state.productions.some((x) => x.status === 'posted'), text: L(locale, 'Production/prep cycle tested', 'دورة الإنتاج والتحضير مجربة') },
    { ok: state.sales.some((x) => x.posted), text: L(locale, 'Sales/POS posting tested', 'ترحيل المبيعات والكاشير مجرب') },
    { ok: state.journals.some((x) => x.status === 'posted') && unbalancedJournals === 0, text: L(locale, 'Ledger is posted and balanced', 'الأستاذ مرحل ومتوازن') },
    { ok: state.employees.length > 0 && state.userAccounts.length > 0 && state.userAccess.length > 0, text: L(locale, 'Users linked to employees and roles', 'المستخدمون مرتبطون بالموظفين والأدوار') },
    { ok: state.fiscalPeriods.length >= 12, text: L(locale, 'Fiscal periods available', 'الفترات المالية متاحة') },
  ];
}
function MiniBarChart({ data, valueFormatter = (value: number) => compactNumber(value, 'en') }: { data: ExecutiveChartDatum[]; valueFormatter?: (value: number) => string }) {
  const visible = data.filter((d) => Number.isFinite(d.value));
  const max = Math.max(1, ...visible.map((d) => Math.abs(d.value)));
  if (!chartDataHasValue(visible)) return <div className="chart-empty">No chart data yet</div>;
  return <div className="mini-bars">{visible.map((d) => <div className="mini-bar-row" key={d.label}><div className="mini-bar-top"><span>{d.label}</span><strong>{valueFormatter(d.value)}</strong></div><div className="mini-bar-track"><i style={{ width: `${Math.max(3, (Math.abs(d.value) / max) * 100)}%` }}/></div>{d.hint && <small>{d.hint}</small>}</div>)}</div>;
}
function MiniLineChart({ data, valueFormatter = (value: number) => compactNumber(value, 'en') }: { data: ExecutiveChartDatum[]; valueFormatter?: (value: number) => string }) {
  const visible = data.filter((d) => Number.isFinite(d.value));
  if (!chartDataHasValue(visible)) return <div className="line-chart empty-line"><svg viewBox="0 0 220 72" role="img"><polyline points="6,58 74,58 146,58 214,58"/></svg><span>No movement yet</span></div>;
  const values = visible.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const points = visible.map((d, i) => {
    const x = visible.length === 1 ? 110 : 8 + (i * 204) / (visible.length - 1);
    const y = 62 - ((d.value - min) / span) * 50;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const last = visible[visible.length - 1];
  return <div className="line-chart"><svg viewBox="0 0 220 72" role="img"><polyline points={points}/>{visible.map((d, i) => { const x = visible.length === 1 ? 110 : 8 + (i * 204) / (visible.length - 1); const y = 62 - ((d.value - min) / span) * 50; return <circle key={d.label + i} cx={x} cy={y} r="3"/>; })}</svg><span>{last.label} · {valueFormatter(last.value)}</span></div>;
}
function DoughnutChart({ value, total = 100, label, center, hint }: { value: number; total?: number; label: string; center?: string; hint?: string }) {
  const pct = clampPercent(total ? (value / total) * 100 : value);
  return <div className="doughnut-wrap"><div className="doughnut" style={{ background: `conic-gradient(#22d3ee ${pct}%, rgba(148,163,184,.18) 0)` }}><div><strong>{center ?? `${pct.toFixed(0)}%`}</strong><span>{label}</span></div></div>{hint && <small>{hint}</small>}</div>;
}

type SmartChartShape = 'auto' | 'bar' | 'line' | 'doughnut';
type SmartKpiDefinition = { key: string; label: string; value: string; hint: string; icon: ReactNode; defaultShape: Exclude<SmartChartShape, 'auto'>; data: ExecutiveChartDatum[]; formatter: (value: number) => string; doughnutValue?: number; tone?: ExecutiveKpiTone };
function SmartBarChart({ data, color, accent, valueFormatter }: { data: ExecutiveChartDatum[]; color: string; accent: string; valueFormatter: (value: number) => string }) {
  const visible = data.filter((d) => Number.isFinite(d.value));
  const max = Math.max(1, ...visible.map((d) => Math.abs(d.value)));
  if (!chartDataHasValue(visible)) return <div className="chart-empty">No chart data yet</div>;
  return <div className="smart-bars">{visible.map((d) => <div className="mini-bar-row" key={d.label}><div className="mini-bar-top"><span>{d.label}</span><strong>{valueFormatter(d.value)}</strong></div><div className="mini-bar-track"><i style={{ width: `${Math.max(3, (Math.abs(d.value) / max) * 100)}%`, background: `linear-gradient(90deg, ${color}, ${accent})` }}/></div>{d.hint && <small>{d.hint}</small>}</div>)}</div>;
}
function SmartLineChart({ data, color, accent, valueFormatter }: { data: ExecutiveChartDatum[]; color: string; accent: string; valueFormatter: (value: number) => string }) {
  const visible = data.filter((d) => Number.isFinite(d.value));
  if (!chartDataHasValue(visible)) return <div className="line-chart smart-line-chart empty-line"><svg viewBox="0 0 220 72" role="img"><polyline points="6,58 74,58 146,58 214,58"/></svg><span>No movement yet</span></div>;
  const values = visible.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const points = visible.map((d, i) => {
    const x = visible.length === 1 ? 110 : 8 + (i * 204) / (visible.length - 1);
    const y = 62 - ((d.value - min) / span) * 50;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const last = visible[visible.length - 1];
  return <div className="line-chart smart-line-chart"><svg viewBox="0 0 220 72" role="img"><polyline points={points} style={{ stroke: color }}/>{visible.map((d, i) => { const x = visible.length === 1 ? 110 : 8 + (i * 204) / (visible.length - 1); const y = 62 - ((d.value - min) / span) * 50; return <circle key={d.label + i} cx={x} cy={y} r="3.4" style={{ fill: accent }}/>; })}</svg><span>{last.label} · {valueFormatter(last.value)}</span></div>;
}
function SmartDoughnutChart({ value, label, center, color }: { value: number; label: string; center: string; color: string }) {
  const pct = clampPercent(value);
  return <div className="doughnut-wrap smart-doughnut-wrap"><div className="doughnut smart-doughnut" style={{ background: `conic-gradient(${color} ${pct}%, rgba(148,163,184,.18) 0)` }}><div><strong>{center}</strong><span>{label}</span></div></div></div>;
}
function SmartChart({ kpi, shape, color, accent }: { kpi: SmartKpiDefinition; shape: SmartChartShape; color: string; accent: string }) {
  const selected = shape === 'auto' ? kpi.defaultShape : shape;
  if (selected === 'line') return <SmartLineChart data={kpi.data} color={color} accent={accent} valueFormatter={kpi.formatter}/>;
  if (selected === 'doughnut') return <SmartDoughnutChart value={kpi.doughnutValue ?? 0} label={kpi.label} center={kpi.value} color={color}/>;
  return <SmartBarChart data={kpi.data} color={color} accent={accent} valueFormatter={kpi.formatter}/>;
}
function SmartKpiCard({ kpi, selected, onSelectedChange, shape, color, accent, onColorChange, onDrilldown }: { kpi: SmartKpiDefinition; selected: boolean; onSelectedChange: (selected: boolean) => void; shape: SmartChartShape; color: string; accent: string; onColorChange: (color: string) => void; onDrilldown: () => void }) {
  return <div className={`smart-kpi-card ${selected ? 'selected' : ''} ${kpi.tone ?? 'neutral'}`}>
    <div className="smart-kpi-toolbar">
      <label className="check smart-show-toggle"><input type="checkbox" checked={selected} onChange={(e) => onSelectedChange(e.target.checked)}/><span>Show</span></label>
      <div className="button-row compact"><button type="button" onClick={onDrilldown}><Download size={14}/>CSV</button><input className="color-picker smart-card-color" title="Chart color" type="color" value={color} onChange={(e) => onColorChange(e.target.value)}/></div>
    </div>
    <button type="button" className="smart-kpi-click" onClick={onDrilldown} title="Export KPI drilldown">
      <div className="executive-kpi-head smart-kpi-head">
        <div className="kpi-icon">{kpi.icon}</div>
        <div className="smart-kpi-copy"><span className="smart-kpi-title">{kpi.label}</span><strong className="smart-kpi-value">{kpi.value}</strong><small className="smart-kpi-hint">{kpi.hint}</small></div>
      </div>
    </button>
    <div className="smart-chart-shell"><SmartChart kpi={kpi} shape={shape} color={color} accent={accent}/></div>
  </div>;
}
function ExecutiveKPI({ label, value, hint, icon, chart, tone = 'neutral' }: { label: string; value: string; hint: string; icon: ReactNode; chart: ReactNode; tone?: ExecutiveKpiTone }) {
  return <div className={`executive-kpi ${tone}`}><div className="executive-kpi-head"><div className="kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>{chart}</div>;
}
function MetricRail({ rows }: { rows: Array<{ label: string; value: string; hint?: string; tone?: ExecutiveKpiTone }> }) {
  return <div className="metric-rail">{rows.map((row) => <div key={row.label} className={row.tone ?? 'neutral'}><span>{row.label}</span><strong>{row.value}</strong>{row.hint && <small>{row.hint}</small>}</div>)}</div>;
}
function ReadinessMatrix({ checks }: { checks: Array<{ ok: boolean; text: string }> }) {
  return <div className="readiness-matrix">{checks.map((check) => <div key={check.text} className={check.ok ? 'ok' : 'warn'}><ClipboardCheck size={15}/><span>{check.text}</span></div>)}</div>;
}

function DashboardPage({ state, totals, locale, setState, notify }: { state: ERPState; totals: Totals; locale: Locale; setState: (s: ERPState) => void; notify: (type: 'success' | 'warning' | 'error', message: string) => void }) {
  const readinessChecks = setupReadinessChecks(state, totals, locale);
  const readinessScore = Math.round((readinessChecks.filter((x) => x.ok).length / Math.max(readinessChecks.length, 1)) * 100);
  const salesTrend = salesByDateData(state, locale);
  const branchSales = branchSalesData(state, locale);
  const inventoryByCategory = inventoryCategoryData(state);
  const stockByStore = storeValueData(state, locale);
  const menuMargins = menuMarginData(state, locale);
  const supplierExposure = supplierExposureData(state);
  const poStatus = purchaseStatusData(state, locale);
  const productionOutput = productionOutputData(state);
  const cashTrend = cashMovementData(state, locale);
  const controlRisks = controlRiskData(state, locale);
  const available = availableRows(state);
  const lowStock = state.items.filter((item) => state.stores.reduce((sum, store) => sum + getBalance(state, store.id, item.id), 0) <= Math.max(item.reorderPoint || item.minStock || 0, 0) && (item.reorderPoint || item.minStock) > 0).length;
  const nearExpiryLots = (state.inventoryLots ?? []).filter((lot) => lot.status === 'available' && daysUntil(lot.expiryDate) <= 7).length;
  const quarantineLots = (state.inventoryLots ?? []).filter((lot) => lot.status === 'quarantine').length;
  const grossMarginPct = totals.salesNet ? (totals.grossProfit / totals.salesNet) * 100 : 0;
  const foodCostPct = totals.salesNet ? (totals.cogs / totals.salesNet) * 100 : 0;
  const avgTicket = state.sales.length ? totals.salesGross / state.sales.length : 0;
  const avgRecipeMargin = menuMargins.length ? menuMargins.reduce((sum, row) => sum + row.value, 0) / menuMargins.length : 0;
  const pendingApprovals = (state.inventoryApprovals ?? []).filter((x) => x.status === 'pending').length;
  const draftDocs = state.journals.filter((j) => j.status === 'draft').length + state.purchaseInvoices.filter((x) => x.status === 'draft').length + state.productions.filter((x) => x.status === 'draft').length + state.materialRequests.filter((x) => x.status === 'draft').length;
  const unbalancedJournals = state.journals.filter((j) => !journalBalance(j).balanced).length;
  const loadMasters = () => { setState(createProfessionalMasterData(locale)); notify('success', L(locale, 'Professional non-money master data loaded. Costs remain zero until purchase invoices are posted.', 'تم تحميل بيانات أساسية احترافية بدون مبالغ. تبقى التكاليف صفر حتى ترحيل فواتير شراء.')); };
  const loadTrial = () => { setState(createProfessionalTrialScenario(locale)); notify('success', L(locale, 'Trial scenario loaded with executive analytics data: purchasing, stock, production, sales, VAT, AP, and ledger postings.', 'تم تحميل سيناريو تجربة مع بيانات التحليلات التنفيذية: مشتريات، مخزون، إنتاج، مبيعات، ضريبة، ذمم دائنة، وترحيلات أستاذ.')); };

  return <div className="page-grid executive-dashboard">
    <section className="executive-hero">
      <div>
        <span className="eyebrow">{L(locale, 'v305 Executive Analytics Dashboard', 'إصدار ٣٠٥ - لوحة التحليلات التنفيذية')}</span>
        <h2>{L(locale, 'One command center for finance, stock, purchasing, production, POS, HR, and controls.', 'مركز قيادة واحد للمالية والمخزون والمشتريات والإنتاج والكاشير والموارد البشرية والرقابة.')}</h2>
        <p>{L(locale, 'The dashboard now uses mixed chart shapes by KPI: lines for movement, bars for ranking, doughnuts for ratios, and risk rails for operational exceptions.', 'تعتمد اللوحة الآن أشكال رسوم مختلفة حسب المؤشر: خطوط للحركة، أعمدة للترتيب، دوائر للنسب، ومؤشرات مخاطر للاستثناءات التشغيلية.')}</p>
        <div className="button-row"><button onClick={loadMasters}><Plus size={16}/>{L(locale, 'Load master data only', 'تحميل البيانات الأساسية فقط')}</button><button onClick={loadTrial}><Database size={16}/>{L(locale, 'Load fast trial scenario', 'تحميل سيناريو تجربة سريع')}</button></div>
      </div>
      <div className="executive-score"><DoughnutChart value={readinessScore} label={L(locale, 'readiness', 'الجاهزية')} center={`${readinessScore}%`} hint={L(locale, 'Enterprise setup score', 'درجة الجاهزية المؤسسية')}/></div>
    </section>

    <div className="executive-kpi-grid">
      <ExecutiveKPI tone="good" label={L(locale, 'Net Sales', 'صافي المبيعات')} value={money(totals.salesNet, locale)} hint={L(locale, 'Line trend from posted POS batches', 'اتجاه خطي من مبيعات الكاشير المرحلة')} icon={<BadgeDollarSign/>} chart={<MiniLineChart data={salesTrend} valueFormatter={(v) => money(v, locale)}/>}/>
      <ExecutiveKPI tone={grossMarginPct >= 55 ? 'good' : grossMarginPct >= 35 ? 'warn' : 'bad'} label={L(locale, 'Gross Margin', 'هامش مجمل الربح')} value={percentText(grossMarginPct)} hint={L(locale, 'Doughnut ratio of gross profit to sales', 'نسبة دائرية لمجمل الربح إلى المبيعات')} icon={<PieChart/>} chart={<DoughnutChart value={grossMarginPct} label={L(locale, 'GP margin', 'هامش الربح')} center={percentText(grossMarginPct)}/>}/>
      <ExecutiveKPI tone="info" label={L(locale, 'Inventory Value', 'قيمة المخزون')} value={money(totals.stockValue, locale)} hint={L(locale, 'Bar ranking by stock category', 'ترتيب بالأعمدة حسب تصنيف المخزون')} icon={<Archive/>} chart={<MiniBarChart data={inventoryByCategory} valueFormatter={(v) => money(v, locale)}/>}/>
      <ExecutiveKPI tone="good" label={L(locale, 'Cash & Banks', 'النقد والبنوك')} value={money(totals.cash, locale)} hint={L(locale, 'Cash movement from posted ledger', 'حركة النقد من الأستاذ المرحل')} icon={<Banknote/>} chart={<MiniLineChart data={cashTrend} valueFormatter={(v) => money(v, locale)}/>}/>
      <ExecutiveKPI tone={totals.ap > totals.cash ? 'warn' : 'good'} label={L(locale, 'Supplier Exposure', 'التزامات الموردين')} value={money(totals.ap, locale)} hint={L(locale, 'Doughnut: AP pressure versus liquidity', 'دائرة: ضغط الموردين مقابل السيولة')} icon={<Wallet/>} chart={<DoughnutChart value={totals.ap} total={Math.max(totals.ap + Math.max(totals.cash, 0), 1)} label={L(locale, 'AP pressure', 'ضغط الموردين')} center={percentText((totals.ap / Math.max(totals.ap + Math.max(totals.cash, 0), 1)) * 100)}/>}/>
      <ExecutiveKPI tone={totals.vatPayable > 0 ? 'warn' : 'good'} label={L(locale, 'VAT Position', 'موقف الضريبة')} value={money(totals.vatPayable, locale)} hint={L(locale, 'Input, output, and payable bars', 'أعمدة للمدخلات والمخرجات والمستحق')} icon={<ReceiptText/>} chart={<MiniBarChart data={[{ label: L(locale, 'Input', 'مدخلات'), value: Math.abs(totals.vatInput) }, { label: L(locale, 'Output', 'مخرجات'), value: Math.abs(totals.vatOutput) }, { label: L(locale, 'Payable', 'مستحق'), value: Math.abs(totals.vatPayable) }]} valueFormatter={(v) => money(v, locale)}/>}/>
      <ExecutiveKPI tone={foodCostPct <= 35 ? 'good' : foodCostPct <= 45 ? 'warn' : 'bad'} label={L(locale, 'Food Cost %', 'نسبة تكلفة الغذاء')} value={percentText(foodCostPct)} hint={L(locale, 'COGS / net sales doughnut', 'دائرة تكلفة المبيعات إلى صافي المبيعات')} icon={<ChefHat/>} chart={<DoughnutChart value={foodCostPct} label={L(locale, 'food cost', 'تكلفة الغذاء')} center={percentText(foodCostPct)}/>}/>
      <ExecutiveKPI tone={pendingApprovals + draftDocs + unbalancedJournals ? 'warn' : 'good'} label={L(locale, 'Control Exceptions', 'استثناءات الرقابة')} value={`${pendingApprovals + draftDocs + unbalancedJournals}`} hint={L(locale, 'Approvals, drafts, and unbalanced entries', 'اعتمادات ومسودات وقيود غير متوازنة')} icon={<ShieldCheck/>} chart={<MiniBarChart data={controlRisks} valueFormatter={(v) => `${v}`}/>}/>
    </div>

    <div className="page-grid two">
      <Card title={L(locale, 'Finance cockpit', 'قمرة المالية')} icon={<Landmark/>}>
        <MetricRail rows={[{ label: L(locale, 'Revenue', 'الإيراد'), value: money(totals.salesNet, locale), tone: 'good' }, { label: L(locale, 'COGS', 'تكلفة المبيعات'), value: money(totals.cogs, locale), tone: 'warn' }, { label: L(locale, 'Expenses', 'المصاريف'), value: money(totals.expenses, locale) }, { label: L(locale, 'Net income', 'صافي الربح'), value: money(totals.netIncome, locale), tone: totals.netIncome >= 0 ? 'good' : 'bad' }]}/>
        <MiniBarChart data={[{ label: L(locale, 'Sales', 'مبيعات'), value: totals.salesNet }, { label: L(locale, 'COGS', 'تكلفة'), value: Math.abs(totals.cogs) }, { label: L(locale, 'Expenses', 'مصروفات'), value: Math.abs(totals.expenses) }, { label: L(locale, 'Net income', 'صافي'), value: Math.abs(totals.netIncome) }]} valueFormatter={(v) => money(v, locale)}/>
      </Card>
      <Card title={L(locale, 'Balance-sheet structure', 'هيكل المركز المالي')} icon={<Calculator/>}>
        <div className="three-doughnuts"><DoughnutChart value={Math.max(totals.assets, 0)} total={Math.max(totals.assets + totals.liabilities + totals.equity, 1)} label={L(locale, 'assets', 'الأصول')} center={compactNumber(totals.assets, locale)}/><DoughnutChart value={Math.max(totals.liabilities, 0)} total={Math.max(totals.assets + totals.liabilities + totals.equity, 1)} label={L(locale, 'liabilities', 'الالتزامات')} center={compactNumber(totals.liabilities, locale)}/><DoughnutChart value={Math.max(totals.equity, 0)} total={Math.max(totals.assets + totals.liabilities + totals.equity, 1)} label={L(locale, 'equity', 'الملكية')} center={compactNumber(totals.equity, locale)}/></div>
      </Card>
      <Card title={L(locale, 'Sales and branch performance', 'أداء المبيعات والفروع')} icon={<Store/>}>
        <MetricRail rows={[{ label: L(locale, 'Posted tickets', 'فواتير مرحلة'), value: `${state.sales.filter((x) => x.posted).length}` }, { label: L(locale, 'Average ticket', 'متوسط الفاتورة'), value: money(avgTicket, locale), tone: 'info' }, { label: L(locale, 'Active branches', 'فروع نشطة'), value: `${state.branches.filter((x) => x.active).length}` }, { label: L(locale, 'Best margin', 'أفضل هامش'), value: menuMargins[0] ? percentText(menuMargins[0].value) : '—', tone: 'good' }]}/>
        <MiniBarChart data={branchSales} valueFormatter={(v) => money(v, locale)}/>
      </Card>
      <Card title={L(locale, 'Menu engineering', 'هندسة المنيو')} icon={<ChefHat/>}>
        <MetricRail rows={[{ label: L(locale, 'Menu items', 'أصناف بيع'), value: `${state.menuItems.length}` }, { label: L(locale, 'Recipe lines', 'بنود وصفات'), value: `${state.recipeLines.length}` }, { label: L(locale, 'Average recipe margin', 'متوسط هامش الوصفة'), value: menuMargins.length ? percentText(avgRecipeMargin) : '—', tone: avgRecipeMargin >= 50 ? 'good' : 'warn' }, { label: L(locale, 'Production batches', 'دفعات إنتاج'), value: `${state.productions.length}` }]}/>
        <MiniBarChart data={menuMargins} valueFormatter={(v) => percentText(v)}/>
      </Card>
      <Card title={L(locale, 'Inventory control tower', 'برج مراقبة المخزون')} icon={<Archive/>}>
        <MetricRail rows={[{ label: L(locale, 'On-hand rows', 'أرصدة مخزون'), value: `${available.length}` }, { label: L(locale, 'Low stock SKUs', 'أصناف منخفضة'), value: `${lowStock}`, tone: lowStock ? 'warn' : 'good' }, { label: L(locale, 'Near expiry lots', 'صلاحية قريبة'), value: `${nearExpiryLots}`, tone: nearExpiryLots ? 'warn' : 'good' }, { label: L(locale, 'Quarantine lots', 'تحت الحجر'), value: `${quarantineLots}`, tone: quarantineLots ? 'warn' : 'good' }]}/>
        <MiniBarChart data={stockByStore} valueFormatter={(v) => money(v, locale)}/>
      </Card>
      <Card title={L(locale, 'Purchasing and AP exposure', 'المشتريات والتزامات الموردين')} icon={<ShoppingCart/>}>
        <MetricRail rows={[{ label: L(locale, 'Posted invoices', 'فواتير مرحلة'), value: `${state.purchaseInvoices.filter((x) => x.status === 'posted').length}` }, { label: L(locale, 'POs', 'أوامر شراء'), value: `${state.purchaseOrders.length}` }, { label: L(locale, 'Open suppliers', 'موردون مفتوحون'), value: `${supplierExposure.length}`, tone: supplierExposure.length ? 'warn' : 'good' }, { label: L(locale, 'Payments', 'مدفوعات'), value: money(state.supplierPayments.filter((x) => x.status === 'posted').reduce((sum, p) => sum + p.amount, 0), locale) }]}/>
        <MiniBarChart data={supplierExposure.length ? supplierExposure : poStatus} valueFormatter={(v) => supplierExposure.length ? money(v, locale) : `${v}`}/>
      </Card>
      <Card title={L(locale, 'Production and prep yield', 'إنتاج وتحضير')} icon={<Factory/>}>
        <MetricRail rows={[{ label: L(locale, 'Recipes', 'وصفات إنتاج'), value: `${state.productionRecipes.length}` }, { label: L(locale, 'Posted batches', 'دفعات مرحلة'), value: `${state.productions.filter((x) => x.status === 'posted').length}` }, { label: L(locale, 'Actual output', 'إنتاج فعلي'), value: qty(state.productions.reduce((sum, p) => sum + p.actualOutputQty, 0)) }, { label: L(locale, 'Planned output', 'إنتاج مخطط'), value: qty(state.productions.reduce((sum, p) => sum + p.plannedOutputQty, 0)) }]}/>
        <MiniBarChart data={productionOutput} valueFormatter={(v) => qty(v)}/>
      </Card>
      <Card title={L(locale, 'People, access, and audit', 'الأفراد والصلاحيات والتدقيق')} icon={<Users/>}>
        <MetricRail rows={[{ label: L(locale, 'Employees', 'الموظفون'), value: `${state.employees.length}` }, { label: L(locale, 'User accounts', 'حسابات المستخدمين'), value: `${state.userAccounts.length}` }, { label: L(locale, 'Roles', 'الأدوار'), value: `${state.roles.length}` }, { label: L(locale, 'Audit events', 'أحداث التدقيق'), value: `${state.audits.length}`, tone: 'info' }]}/>
        <MiniBarChart data={[{ label: L(locale, 'Employees', 'الموظفون'), value: state.employees.length }, { label: L(locale, 'Users', 'المستخدمون'), value: state.userAccounts.length }, { label: L(locale, 'Access grants', 'صلاحيات ممنوحة'), value: state.userAccess.length }, { label: L(locale, 'Audit logs', 'سجل التدقيق'), value: state.audits.length }]} valueFormatter={(v) => `${v}`}/>
      </Card>
    </div>

    <Card title={L(locale, 'Enterprise readiness checklist', 'قائمة الجاهزية المؤسسية')} icon={<ClipboardCheck/>}>
      <ReadinessMatrix checks={readinessChecks}/>
      <div className="notice">{L(locale, 'Recommended trial: load fast scenario → verify dashboard numbers → inspect Finance, Inventory, Purchasing, Production, Sales, Users, and Control Center. The sidebar remains unchanged; v305 keeps the dashboard strong and polishes Smart Analysis for custom period/color reporting.', 'التجربة المقترحة: تحميل السيناريو السريع ← مراجعة أرقام اللوحة ← فحص المالية والمخزون والمشتريات والإنتاج والمبيعات والمستخدمين ومركز الرقابة. القائمة الجانبية لم تتغير؛ تحديث ٣٠٥ يحافظ على قوة اللوحة ويحسّن التحليل الذكي للفترات والألوان المخصصة.')}</div>
    </Card>
  </div>;
}


function SetupPage({ state, update, locale }: { state: ERPState; update: (fn: (s: ERPState) => ERPState, success?: string) => void; locale: Locale }) {
  const [tab, setTab] = useState<SetupTab>('branches');
  const labels: Record<SetupTab, { en: string; ar: string }> = { branches: { en: 'Branches', ar: 'الفروع' }, stores: { en: 'Stores', ar: 'المخازن' }, suppliers: { en: 'Suppliers', ar: 'الموردون' }, categories: { en: 'Categories', ar: 'التصنيفات' }, items: { en: 'Items', ar: 'الأصناف' }, menu: { en: 'Menu Items', ar: 'أصناف البيع' }, recipes: { en: 'Recipe Builder', ar: 'منشئ الوصفات' }, costCenters: { en: 'Cost Centers', ar: 'مراكز التكلفة' } };
  return <div className="page-grid"><Card title={L(locale, 'Master data setup', 'إعداد البيانات الأساسية')} icon={<Building2/>}><div className="tab-row">{(Object.keys(labels) as SetupTab[]).map((t) => <TabButton key={t} active={tab} value={t} onClick={setTab}>{L(locale, labels[t].en, labels[t].ar)}</TabButton>)}</div></Card>{tab === 'branches' && <BranchesSetup state={state} update={update} locale={locale}/>} {tab === 'stores' && <StoresSetup state={state} update={update} locale={locale}/>} {tab === 'suppliers' && <SuppliersSetup state={state} update={update} locale={locale}/>} {tab === 'categories' && <CategoriesSetup state={state} update={update} locale={locale}/>} {tab === 'items' && <ItemsSetup state={state} update={update} locale={locale}/>} {tab === 'menu' && <MenuSetup state={state} update={update} locale={locale}/>} {tab === 'recipes' && <RecipesSetup state={state} update={update} locale={locale}/>} {tab === 'costCenters' && <CostCentersSetup state={state} update={update} locale={locale}/>}</div>;
}

function BranchesSetup({ state, update, locale }: { state: ERPState; update: (fn: (s: ERPState) => ERPState, success?: string) => void; locale: Locale }) {
  const blank: Branch = { id: '', code: '', nameEn: '', nameAr: '', location: '', active: true };
  const [draft, setDraft] = useState<Branch>(blank);
  const save = () => draft.code && draft.nameEn && update((s) => addAudit({ ...s, branches: upsert(s.branches, { ...draft, id: draft.id || id('BR') }) }, draft.id ? 'edit' : 'create', 'branch', draft.code, 'Branch saved'), L(locale, 'Branch saved', 'تم حفظ الفرع'));
  return <Card title={L(locale, 'Branches / Restaurants', 'الفروع / المطاعم')} icon={<Building2/>} action={<button onClick={() => setDraft(blank)}><X size={16}/>{L(locale, 'Clear form', 'تفريغ النموذج')}</button>}><div className="form-grid"><Field label={L(locale, 'Code', 'الكود')}><input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })}/></Field><Field label={L(locale, 'Name EN', 'الاسم إنجليزي')}><input value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })}/></Field><Field label={L(locale, 'Name AR', 'الاسم عربي')}><input value={draft.nameAr} onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })}/></Field><Field label={L(locale, 'Location', 'الموقع')}><input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })}/></Field><label className="check"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })}/>{L(locale, 'Active', 'نشط')}</label></div><button onClick={save}><Save size={16}/>{draft.id ? L(locale, 'Update Branch', 'تحديث الفرع') : L(locale, 'Create Branch', 'إنشاء فرع')}</button><Table headers={[L(locale, 'Code', 'الكود'), L(locale, 'Name', 'الاسم'), L(locale, 'Location', 'الموقع'), L(locale, 'Actions', 'إجراءات')]} rows={state.branches.map((b) => [b.code, L(locale, b.nameEn, b.nameAr), b.location, actionButtons(() => setDraft(b), () => update((s) => addAudit({ ...s, branches: s.branches.map((x) => x.id === b.id ? { ...x, active: false } : x) }, 'delete', 'branch', b.code, 'Branch deleted'), L(locale, 'Branch deleted', 'تم حذف الفرع')), locale)])}/></Card>;
}
function StoresSetup({ state, update, locale }: { state: ERPState; update: (fn: (s: ERPState) => ERPState, success?: string) => void; locale: Locale }) {
  const blank: StoreLocation = { id: '', code: '', nameEn: '', nameAr: '', branchId: 'main', type: 'Kitchen', active: true };
  const [draft, setDraft] = useState<StoreLocation>(blank);
  const save = () => draft.code && draft.nameEn && update((s) => addAudit({ ...s, stores: upsert(s.stores, { ...draft, id: draft.id || id('ST') }) }, draft.id ? 'edit' : 'create', 'store', draft.code, 'Store saved'), L(locale, 'Store saved', 'تم حفظ المخزن'));
  return <Card title={L(locale, 'Stores / stockrooms linked to branches', 'المخازن المرتبطة بالفروع')} icon={<Store/>} action={<button onClick={() => setDraft(blank)}><X size={16}/>{L(locale, 'Clear form', 'تفريغ النموذج')}</button>}><div className="form-grid"><Field label={L(locale, 'Code', 'الكود')}><input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })}/></Field><Field label={L(locale, 'Name EN', 'الاسم إنجليزي')}><input value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })}/></Field><Field label={L(locale, 'Name AR', 'الاسم عربي')}><input value={draft.nameAr} onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })}/></Field><Field label={L(locale, 'Linked branch', 'الفرع المرتبط')}><select value={draft.branchId} onChange={(e) => setDraft({ ...draft, branchId: e.target.value })}><option value="main">{L(locale, 'Main / central store', 'الرئيسي / مخزن مركزي')}</option>{state.branches.map((b) => <option key={b.id} value={b.id}>{L(locale, b.nameEn, b.nameAr)}</option>)}</select></Field><Field label={L(locale, 'Store type', 'نوع المخزن')}><select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}><option>Kitchen</option><option>Dry Store</option><option>Cold Room</option><option>Freezer</option><option>Packaging</option><option>Main</option></select></Field><label className="check"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })}/>{L(locale, 'Active', 'نشط')}</label></div><button onClick={save}><Save size={16}/>{draft.id ? L(locale, 'Update Store', 'تحديث المخزن') : L(locale, 'Create Store', 'إنشاء مخزن')}</button><Table headers={[L(locale, 'Code', 'الكود'), L(locale, 'Name', 'الاسم'), L(locale, 'Branch', 'الفرع'), L(locale, 'Type', 'النوع'), L(locale, 'Actions', 'إجراءات')]} rows={state.stores.map((st) => [st.code, L(locale, st.nameEn, st.nameAr), branchName(state, st.branchId, locale), st.type, actionButtons(() => setDraft(st), () => update((s) => addAudit({ ...s, stores: s.stores.map((x) => x.id === st.id ? { ...x, active: false } : x) }, 'delete', 'store', st.code, 'Store deleted'), L(locale, 'Store deleted', 'تم حذف المخزن')), locale)])}/></Card>;
}
function SuppliersSetup({ state, update, locale }: { state: ERPState; update: (fn: (s: ERPState) => ERPState, success?: string) => void; locale: Locale }) {
  const blank: Supplier = { id: '', code: '', name: '', vatNo: '', paymentTerms: '', contactName: '', phone: '', email: '', bankName: '', bankAccount: '', representativeName: '', representativePhone: '', active: true };
  const [draft, setDraft] = useState<Supplier>(blank);
  const save = () => draft.name && update((s) => addAudit({ ...s, suppliers: upsert(s.suppliers, { ...draft, id: draft.id || id('SUP'), code: draft.code || `SUP-${String(s.suppliers.length + 1).padStart(3, '0')}` }) }, draft.id ? 'edit' : 'create', 'supplier', draft.name, 'Supplier saved'), L(locale, 'Supplier saved', 'تم حفظ المورد'));
  return <Card title={L(locale, 'Suppliers with bank and representative details', 'الموردون مع معلومات البنك والمندوب')} icon={<Users/>} action={<button onClick={() => setDraft(blank)}><X size={16}/>{L(locale, 'Clear form', 'تفريغ النموذج')}</button>}><div className="form-grid"><Field label={L(locale, 'Supplier name', 'اسم المورد')}><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}/></Field><Field label={L(locale, 'Supplier code', 'كود المورد')}><input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })}/></Field><Field label={L(locale, 'VAT number', 'الرقم الضريبي')}><input value={draft.vatNo} onChange={(e) => setDraft({ ...draft, vatNo: e.target.value })}/></Field><Field label={L(locale, 'Payment terms', 'شروط الدفع')}><input value={draft.paymentTerms} onChange={(e) => setDraft({ ...draft, paymentTerms: e.target.value })}/></Field><Field label={L(locale, 'Contact name', 'اسم التواصل')}><input value={draft.contactName} onChange={(e) => setDraft({ ...draft, contactName: e.target.value })}/></Field><Field label={L(locale, 'Phone', 'الهاتف')}><input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })}/></Field><Field label={L(locale, 'Primary email', 'البريد الرئيسي')}><input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })}/></Field><Field label={L(locale, 'Bank name', 'اسم البنك')}><input value={draft.bankName} onChange={(e) => setDraft({ ...draft, bankName: e.target.value })}/></Field><Field label={L(locale, 'Bank account / IBAN', 'رقم الحساب / الآيبان')}><input value={draft.bankAccount} onChange={(e) => setDraft({ ...draft, bankAccount: e.target.value })}/></Field><Field label={L(locale, 'Representative name', 'اسم المندوب')}><input value={draft.representativeName} onChange={(e) => setDraft({ ...draft, representativeName: e.target.value })}/></Field><Field label={L(locale, 'Representative number', 'رقم المندوب')}><input value={draft.representativePhone} onChange={(e) => setDraft({ ...draft, representativePhone: e.target.value })}/></Field><label className="check"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })}/>{L(locale, 'Active', 'نشط')}</label></div><button onClick={save}><Save size={16}/>{draft.id ? L(locale, 'Update Supplier', 'تحديث المورد') : L(locale, 'Create Supplier', 'إنشاء مورد')}</button><Table headers={[L(locale, 'Supplier', 'المورد'), L(locale, 'Terms', 'الشروط'), L(locale, 'Bank', 'البنك'), L(locale, 'Representative', 'المندوب'), L(locale, 'Actions', 'إجراءات')]} rows={state.suppliers.map((sup) => [sup.name, sup.paymentTerms, `${sup.bankName} ${sup.bankAccount}`, `${sup.representativeName} ${sup.representativePhone}`, actionButtons(() => setDraft(sup), () => update((s) => addAudit({ ...s, suppliers: s.suppliers.map((x) => x.id === sup.id ? { ...x, active: false } : x) }, 'delete', 'supplier', sup.name, 'Supplier deleted'), L(locale, 'Supplier deleted', 'تم حذف المورد')), locale)])}/></Card>;
}

function CategorySelectField({ kind, value, onChange, state, locale }: { kind: CategoryKind; value: string; onChange: (value: string) => void; state: ERPState; locale: Locale }) {
  const [creating, setCreating] = useState(false);
  const options = allCategoryNames(state, kind, locale);
  const currentValue = creating ? '__create__' : value;
  return <>
    <Field label={L(locale, 'Category', 'التصنيف')}><select value={currentValue || ''} onChange={(e) => { const next = e.target.value; if (next === '__create__') { setCreating(true); onChange(''); } else { setCreating(false); onChange(next); } }}><option value="__create__">{kind === 'item' ? L(locale, '+ Create new item category', '+ إنشاء تصنيف صنف جديد') : L(locale, '+ Create new menu category', '+ إنشاء تصنيف منيو جديد')}</option><option value="">—</option>{options.map((name) => <option key={name} value={name}>{name}</option>)}</select></Field>
    {creating && <Field label={kind === 'item' ? L(locale, 'New item category', 'تصنيف صنف جديد') : L(locale, 'New menu category', 'تصنيف منيو جديد')}><input value={value} autoFocus placeholder={L(locale, 'Type category name', 'اكتب اسم التصنيف')} onChange={(e) => onChange(e.target.value)}/></Field>}
  </>;
}

function CategoriesSetup({ state, update, locale }: { state: ERPState; update: (fn: (s: ERPState) => ERPState, success?: string) => void; locale: Locale }) {
  const [kind, setKind] = useState<CategoryKind>('item');
  const [name, setName] = useState('');
  const [renameFrom, setRenameFrom] = useState('');
  const [renameTo, setRenameTo] = useState('');
  const itemRows = allCategoryNames(state, 'item', locale).map((cat) => ({ kind: 'item' as CategoryKind, cat, used: state.items.filter((i) => normalizeCategoryName(i.category).toLowerCase() === cat.toLowerCase()).length }));
  const menuRows = allCategoryNames(state, 'menu', locale).map((cat) => ({ kind: 'menu' as CategoryKind, cat, used: state.menuItems.filter((m) => normalizeCategoryName(m.category).toLowerCase() === cat.toLowerCase()).length }));
  const rows = [...itemRows, ...menuRows];
  const create = () => {
    const clean = normalizeCategoryName(name);
    if (!clean) return;
    update((s) => addAudit(ensureCategoryRecord(s, kind, clean), 'create', `${kind}_category`, clean, 'Category created'), L(locale, 'Category created', 'تم إنشاء التصنيف'));
    setName('');
  };
  const rename = () => {
    if (!renameFrom || !normalizeCategoryName(renameTo)) return;
    update((s) => addAudit(renameCategoryEverywhere(ensureCategoryRecord(s, kind, renameTo), kind, renameFrom, renameTo), 'edit', `${kind}_category`, renameFrom, `Category renamed to ${renameTo}`), L(locale, 'Category renamed and linked records updated', 'تم تغيير التصنيف وتحديث السجلات المرتبطة'));
    setRenameFrom(''); setRenameTo('');
  };
  return <div className="page-grid"><Card title={L(locale, 'Category library for items and menu items', 'مكتبة تصنيفات الأصناف والمنيو')} icon={<Layers/>}><div className="notice">{L(locale, 'Categories are now controlled from a dropdown in Items and Menu Items. Use this tab to create categories before data entry or rename existing categories everywhere.', 'أصبحت التصنيفات الآن من قائمة منسدلة في الأصناف وأصناف البيع. استخدم هذا التبويب لإنشاء التصنيفات قبل الإدخال أو تغيير اسم التصنيف في كل السجلات.')}</div><div className="form-grid"><Field label={L(locale, 'Category type', 'نوع التصنيف')}><select value={kind} onChange={(e) => setKind(e.target.value as CategoryKind)}><option value="item">{L(locale, 'Inventory item category', 'تصنيف صنف مخزون')}</option><option value="menu">{L(locale, 'Menu item category', 'تصنيف صنف بيع')}</option></select></Field><Field label={L(locale, 'New category name', 'اسم التصنيف الجديد')}><input value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'item' ? L(locale, 'Example: Dairy / Meat / Packaging', 'مثال: ألبان / لحوم / تغليف') : L(locale, 'Example: Pizza / BBQ / Drinks', 'مثال: بيتزا / مشويات / مشروبات')}/></Field></div><button onClick={create}><Plus size={16}/>{L(locale, 'Create Category', 'إنشاء تصنيف')}</button></Card><Card title={L(locale, 'Rename category across linked records', 'تغيير التصنيف في السجلات المرتبطة')} icon={<Edit3/>}><div className="form-grid"><Field label={L(locale, 'Type', 'النوع')}><select value={kind} onChange={(e) => { setKind(e.target.value as CategoryKind); setRenameFrom(''); }}><option value="item">{L(locale, 'Inventory item category', 'تصنيف صنف مخزون')}</option><option value="menu">{L(locale, 'Menu item category', 'تصنيف صنف بيع')}</option></select></Field><Field label={L(locale, 'Existing category', 'التصنيف الحالي')}><select value={renameFrom} onChange={(e) => setRenameFrom(e.target.value)}><option value="">—</option>{allCategoryNames(state, kind, locale).map((cat) => <option key={cat} value={cat}>{cat}</option>)}</select></Field><Field label={L(locale, 'New name', 'الاسم الجديد')}><input value={renameTo} onChange={(e) => setRenameTo(e.target.value)}/></Field></div><button onClick={rename}><Save size={16}/>{L(locale, 'Rename Category', 'تغيير التصنيف')}</button></Card><Card title={L(locale, 'Existing category dropdown values', 'قيم التصنيفات الموجودة في القوائم')} icon={<ListChecks/>}><Table headers={[L(locale, 'Type', 'النوع'), L(locale, 'Category', 'التصنيف'), L(locale, 'Linked records', 'السجلات المرتبطة')]} rows={rows.map((r) => [r.kind === 'item' ? L(locale, 'Items', 'الأصناف') : L(locale, 'Menu Items', 'أصناف البيع'), r.cat, `${r.used}`])}/></Card></div>;
}

function ItemsSetup({ state, update, locale }: { state: ERPState; update: (fn: (s: ERPState) => ERPState, success?: string) => void; locale: Locale }) {
  const blank: Item = { id: '', sku: '', nameEn: '', nameAr: '', category: '', purchaseUnit: 'KG', consumptionUnit: 'KG', conversionFactor: 1, standardCost: 0, minStock: 0, maxStock: 0, reorderPoint: 0, isSemiFinished: false, active: true };
  const [draft, setDraft] = useState<Item>(blank);
  const save = () => draft.sku && draft.nameEn && update((s) => { const cleanCategory = normalizeCategoryName(draft.category || 'Uncategorized'); const withCategory = ensureCategoryRecord(s, 'item', cleanCategory); return addAudit({ ...withCategory, items: upsert(withCategory.items, { ...draft, category: cleanCategory, id: draft.id || id('ITM'), standardCost: Number(draft.standardCost || 0) }) }, draft.id ? 'edit' : 'create', 'item', draft.sku, 'Item saved'); }, L(locale, 'Item saved', 'تم حفظ الصنف'));
  return <Card title={L(locale, 'Inventory items — category dropdown linked to setup', 'أصناف المخزون — التصنيف مرتبط بقائمة الإعداد')} icon={<Archive/>} action={<button onClick={() => setDraft(blank)}><X size={16}/>{L(locale, 'Clear form', 'تفريغ النموذج')}</button>}><div className="notice">{L(locale, 'Choose an existing category or use the first dropdown option to create a new one while saving the item. All categories are visible under Setup → Categories.', 'اختر تصنيفاً موجوداً أو استخدم أول خيار في القائمة لإنشاء تصنيف جديد أثناء حفظ الصنف. كل التصنيفات تظهر في الإعداد ← التصنيفات.')}</div><div className="form-grid"><Field label="SKU"><input value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })}/></Field><Field label={L(locale, 'Name EN', 'الاسم إنجليزي')}><input value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })}/></Field><Field label={L(locale, 'Name AR', 'الاسم عربي')}><input value={draft.nameAr} onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })}/></Field><CategorySelectField kind="item" value={draft.category} onChange={(category) => setDraft({ ...draft, category })} state={state} locale={locale}/><Field label={L(locale, 'Purchase unit', 'وحدة الشراء')}><input value={draft.purchaseUnit} onChange={(e) => setDraft({ ...draft, purchaseUnit: e.target.value })}/></Field><Field label={L(locale, 'Consumption unit', 'وحدة الاستهلاك')}><input value={draft.consumptionUnit} onChange={(e) => setDraft({ ...draft, consumptionUnit: e.target.value })}/></Field><Field label={L(locale, 'Conversion factor', 'معامل التحويل')}><input type="number" value={draft.conversionFactor} onChange={(e) => setDraft({ ...draft, conversionFactor: Number(e.target.value) })}/></Field><Field label={L(locale, 'Standard cost / optional', 'تكلفة قياسية / اختيارية')}><input type="number" value={draft.standardCost ?? 0} onChange={(e) => setDraft({ ...draft, standardCost: Number(e.target.value) })}/></Field><Field label={L(locale, 'Reorder point', 'نقطة إعادة الطلب')}><input type="number" value={draft.reorderPoint} onChange={(e) => setDraft({ ...draft, reorderPoint: Number(e.target.value) })}/></Field><Field label={L(locale, 'Min stock', 'الحد الأدنى')}><input type="number" value={draft.minStock} onChange={(e) => setDraft({ ...draft, minStock: Number(e.target.value) })}/></Field><Field label={L(locale, 'Max stock', 'الحد الأعلى')}><input type="number" value={draft.maxStock} onChange={(e) => setDraft({ ...draft, maxStock: Number(e.target.value) })}/></Field><label className="check"><input type="checkbox" checked={draft.isSemiFinished} onChange={(e) => setDraft({ ...draft, isSemiFinished: e.target.checked })}/>{L(locale, 'Semi-finished / production item', 'نصف مصنع / منتج تحضيري')}</label></div><button onClick={save}><Save size={16}/>{draft.id ? L(locale, 'Update Item', 'تحديث الصنف') : L(locale, 'Create Item', 'إنشاء صنف')}</button><Table headers={[L(locale, 'SKU', 'الكود'), L(locale, 'Name', 'الاسم'), L(locale, 'Category', 'التصنيف'), L(locale, 'Avg Cost', 'متوسط التكلفة'), L(locale, 'Actions', 'إجراءات')]} rows={state.items.map((it) => [it.sku, L(locale, it.nameEn, it.nameAr), it.category, money(getAveragePurchaseCost(state, it.id), locale), actionButtons(() => setDraft(it), () => update((s) => addAudit({ ...s, items: removeById(s.items, it.id) }, 'delete', 'item', it.sku, 'Item deleted'), L(locale, 'Item deleted', 'تم حذف الصنف')), locale)])}/></Card>;
}
function MenuSetup({ state, update, locale }: { state: ERPState; update: (fn: (s: ERPState) => ERPState, success?: string) => void; locale: Locale }) {
  const blank: MenuItem = { id: '', code: '', nameEn: '', nameAr: '', category: '', sellingPrice: 0, vatRate: 15, priceIncludesVat: true, active: true };
  const [draft, setDraft] = useState<MenuItem>(blank);
  const save = () => draft.code && draft.nameEn && update((s) => { const cleanCategory = normalizeCategoryName(draft.category || 'Menu'); const withCategory = ensureCategoryRecord(s, 'menu', cleanCategory); return addAudit({ ...withCategory, menuItems: upsert(withCategory.menuItems, { ...draft, category: cleanCategory, id: draft.id || id('MENU') }) }, draft.id ? 'edit' : 'create', 'menu_item', draft.code, 'Menu item saved'); }, L(locale, 'Menu item saved', 'تم حفظ صنف البيع'));
  return <Card title={L(locale, 'Menu items and VAT pricing mode — category dropdown linked to setup', 'أصناف البيع وطريقة تسعير الضريبة — التصنيف مرتبط بالإعداد')} icon={<ChefHat/>} action={<button onClick={() => setDraft(blank)}><X size={16}/>{L(locale, 'Clear form', 'تفريغ النموذج')}</button>}><div className="form-grid"><Field label={L(locale, 'Code', 'الكود')}><input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })}/></Field><Field label={L(locale, 'Name EN', 'الاسم إنجليزي')}><input value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })}/></Field><Field label={L(locale, 'Name AR', 'الاسم عربي')}><input value={draft.nameAr} onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })}/></Field><CategorySelectField kind="menu" value={draft.category} onChange={(category) => setDraft({ ...draft, category })} state={state} locale={locale}/><Field label={L(locale, 'Selling price', 'سعر البيع')}><input type="number" value={draft.sellingPrice} onChange={(e) => setDraft({ ...draft, sellingPrice: Number(e.target.value) })}/></Field><Field label={L(locale, 'VAT %', 'نسبة الضريبة')}><input type="number" value={draft.vatRate} onChange={(e) => setDraft({ ...draft, vatRate: Number(e.target.value) })}/></Field><Field label={L(locale, 'VAT mode', 'وضع الضريبة')}><select value={draft.priceIncludesVat ? 'yes' : 'no'} onChange={(e) => setDraft({ ...draft, priceIncludesVat: e.target.value === 'yes' })}><option value="yes">{L(locale, 'Price includes VAT', 'السعر شامل الضريبة')}</option><option value="no">{L(locale, 'Price excludes VAT', 'السعر غير شامل الضريبة')}</option></select></Field></div><button onClick={save}><Save size={16}/>{L(locale, 'Save Menu Item', 'حفظ صنف البيع')}</button><Table headers={[L(locale, 'Code', 'الكود'), L(locale, 'Name', 'الاسم'), L(locale, 'Category', 'التصنيف'), L(locale, 'Price', 'السعر'), L(locale, 'VAT Mode', 'وضع الضريبة'), L(locale, 'Recipe Cost', 'تكلفة الوصفة'), L(locale, 'Actions', 'إجراءات')]} rows={state.menuItems.map((m) => [m.code, L(locale, m.nameEn, m.nameAr), m.category, money(m.sellingPrice, locale), m.priceIncludesVat ? L(locale, 'Inclusive', 'شامل') : L(locale, 'Exclusive', 'غير شامل'), money(recipeCost(state, m.id), locale), actionButtons(() => setDraft(m), () => update((s) => addAudit({ ...s, menuItems: s.menuItems.map((x) => x.id === m.id ? { ...x, active: false } : x), recipeLines: s.recipeLines.filter((r) => r.menuItemId !== m.id) }, 'delete', 'menu_item', m.code, 'Menu deleted'), L(locale, 'Menu item deleted', 'تم حذف صنف البيع')), locale)])}/></Card>;
}
function RecipesSetup({ state, update, locale }: { state: ERPState; update: (fn: (s: ERPState) => ERPState, success?: string) => void; locale: Locale }) {
  const [menuId, setMenuId] = useState('');
  const [line, setLine] = useState({ itemId: '', qty: 0, unit: 'KG', wastagePct: 0, note: '' });
  const activeLines = state.recipeLines.filter((r) => r.menuItemId === menuId);
  const addLine = () => menuId && line.itemId && line.qty > 0 && update((s) => addAudit({ ...s, recipeLines: [...s.recipeLines, { id: id('REC'), menuItemId: menuId, ...line }] }, 'create', 'recipe_line', menuName(s, menuId, 'en'), 'Recipe line added'), L(locale, 'Recipe line added', 'تمت إضافة بند وصفة'));
  return <div className="page-grid"><Card title={L(locale, 'Multi-line recipe builder', 'منشئ الوصفات متعددة البنود')} icon={<BookOpen/>}><div className="notice">{L(locale, 'Each recipe can contain unlimited ingredients. Cost is calculated from average purchase price, not from fixed item master price.', 'كل وصفة يمكن أن تحتوي عدد غير محدود من المكونات. التكلفة تحسب من متوسط سعر الشراء وليس من سعر ثابت في بطاقة الصنف.')}</div><div className="form-grid"><Field label={L(locale, 'Menu item', 'صنف البيع')}><select value={menuId} onChange={(e) => setMenuId(e.target.value)}><option value="">—</option>{state.menuItems.map((m) => <option key={m.id} value={m.id}>{L(locale, m.nameEn, m.nameAr)}</option>)}</select></Field><Field label={L(locale, 'Ingredient', 'المكون')}><select value={line.itemId} onChange={(e) => setLine({ ...line, itemId: e.target.value })}><option value="">—</option>{state.items.map((i) => <option key={i.id} value={i.id}>{i.sku} - {L(locale, i.nameEn, i.nameAr)}</option>)}</select></Field><Field label={L(locale, 'Quantity', 'الكمية')}><input type="number" value={line.qty} onChange={(e) => setLine({ ...line, qty: Number(e.target.value) })}/></Field><Field label={L(locale, 'Unit', 'الوحدة')}><input value={line.unit} onChange={(e) => setLine({ ...line, unit: e.target.value })}/></Field><Field label={L(locale, 'Wastage %', 'نسبة الهدر')}><input type="number" value={line.wastagePct} onChange={(e) => setLine({ ...line, wastagePct: Number(e.target.value) })}/></Field><Field label={L(locale, 'Note', 'ملاحظة')}><input value={line.note} onChange={(e) => setLine({ ...line, note: e.target.value })}/></Field></div><button onClick={addLine}><Plus size={16}/>{L(locale, 'Add Recipe Line', 'إضافة بند وصفة')}</button><div className="kpi-grid"><KPI label={L(locale, 'Recipe Lines', 'بنود الوصفة')} value={`${activeLines.length}`} hint={L(locale, 'For selected item', 'للصنف المحدد')} icon={<ListChecks/>}/><KPI label={L(locale, 'Recipe Cost', 'تكلفة الوصفة')} value={money(menuId ? recipeCost(state, menuId) : 0, locale)} hint={L(locale, 'Average purchase cost', 'متوسط سعر الشراء')} icon={<Calculator/>}/></div><Table headers={[L(locale, 'Ingredient', 'المكون'), L(locale, 'Qty', 'الكمية'), L(locale, 'Wastage', 'الهدر'), L(locale, 'Avg Cost', 'متوسط التكلفة'), L(locale, 'Line Cost', 'تكلفة البند'), L(locale, 'Actions', 'إجراءات')]} rows={activeLines.map((r) => { const c = r.qty * (1 + r.wastagePct / 100) * getAveragePurchaseCost(state, r.itemId); return [itemName(state, r.itemId, locale), `${r.qty} ${r.unit}`, `${r.wastagePct}%`, money(getAveragePurchaseCost(state, r.itemId), locale), money(c, locale), <button className="danger" onClick={() => update((s) => addAudit({ ...s, recipeLines: removeById(s.recipeLines, r.id) }, 'delete', 'recipe_line', r.id, 'Recipe line deleted'), L(locale, 'Line deleted', 'تم حذف البند'))}><Trash2 size={14}/>{L(locale, 'Delete', 'حذف')}</button>]; })}/></Card><Card title={L(locale, 'Recipe list', 'قائمة الوصفات')} icon={<ChefHat/>}><Table headers={[L(locale, 'Menu item', 'صنف البيع'), L(locale, 'Lines', 'البنود'), L(locale, 'Cost', 'التكلفة'), L(locale, 'Food Cost %', 'نسبة التكلفة')]} rows={state.menuItems.map((m) => { const cost = recipeCost(state, m.id); const net = calculateSalesAmounts(m, 1).netSales; return [L(locale, m.nameEn, m.nameAr), `${state.recipeLines.filter((r) => r.menuItemId === m.id).length}`, money(cost, locale), `${net ? ((cost / net) * 100).toFixed(1) : '0.0'}%`]; })}/></Card></div>;
}
function CostCentersSetup({ state, update, locale }: { state: ERPState; update: (fn: (s: ERPState) => ERPState, success?: string) => void; locale: Locale }) {
  const blank: CostCenter = { id: '', code: '', nameEn: '', nameAr: '', branchId: 'company', budget: 0, active: true };
  const [draft, setDraft] = useState<CostCenter>(blank);
  const save = () => draft.code && draft.nameEn && update((s) => addAudit({ ...s, costCenters: upsert(s.costCenters, { ...draft, id: draft.id || id('CC') }) }, draft.id ? 'edit' : 'create', 'cost_center', draft.code, 'Cost center saved'), L(locale, 'Cost center saved', 'تم حفظ مركز التكلفة'));
  return <Card title={L(locale, 'Cost centers', 'مراكز التكلفة')} icon={<Layers/>}><div className="form-grid"><Field label={L(locale, 'Code', 'الكود')}><input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })}/></Field><Field label={L(locale, 'Name EN', 'الاسم إنجليزي')}><input value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })}/></Field><Field label={L(locale, 'Name AR', 'الاسم عربي')}><input value={draft.nameAr} onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })}/></Field><Field label={L(locale, 'Branch', 'الفرع')}><select value={draft.branchId} onChange={(e) => setDraft({ ...draft, branchId: e.target.value })}><option value="company">{L(locale, 'Company', 'الشركة')}</option>{state.branches.map((b) => <option key={b.id} value={b.id}>{L(locale, b.nameEn, b.nameAr)}</option>)}</select></Field><Field label={L(locale, 'Budget', 'الموازنة')}><input type="number" value={draft.budget} onChange={(e) => setDraft({ ...draft, budget: Number(e.target.value) })}/></Field></div><button onClick={save}><Save size={16}/>{L(locale, 'Save Cost Center', 'حفظ مركز التكلفة')}</button><Table headers={[L(locale, 'Code', 'الكود'), L(locale, 'Name', 'الاسم'), L(locale, 'Branch', 'الفرع'), L(locale, 'Budget', 'الموازنة'), L(locale, 'Actions', 'إجراءات')]} rows={state.costCenters.map((c) => [c.code, L(locale, c.nameEn, c.nameAr), branchName(state, c.branchId, locale), money(c.budget, locale), actionButtons(() => setDraft(c), () => update((s) => addAudit({ ...s, costCenters: s.costCenters.map((x) => x.id === c.id ? { ...x, active: false } : x) }, 'delete', 'cost_center', c.code, 'Cost center deleted'), L(locale, 'Cost center deleted', 'تم حذف مركز التكلفة')), locale)])}/></Card>;
}


function UsersPage({ state, update, locale }: { state: ERPState; update: (fn: (s: ERPState) => ERPState, success?: string) => void; locale: Locale }) {
  const defaultRoleId = state.roles[0]?.id ?? '';
  const defaultBranchId = state.branches[0]?.id ?? 'company';
  const [editingUserId, setEditingUserId] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', displayName: '', employeeCode: '', branchId: defaultBranchId, department: 'Operations', jobTitle: 'Cashier', salary: 0, roleId: defaultRoleId, scopeType: 'branch' as RoleScope, scopeId: defaultBranchId, status: 'active' as AppUser['status'], mustChangePassword: true });
  const reset = () => { setEditingUserId(''); setError(''); setForm({ email: '', displayName: '', employeeCode: '', branchId: defaultBranchId, department: 'Operations', jobTitle: 'Cashier', salary: 0, roleId: defaultRoleId, scopeType: 'branch', scopeId: defaultBranchId, status: 'active', mustChangePassword: true }); };
  const scopeOptions = () => form.scopeType === 'branch' ? state.branches.map((b) => ({ id: b.id, name: L(locale, b.nameEn, b.nameAr) })) : form.scopeType === 'store' ? state.stores.map((s) => ({ id: s.id, name: L(locale, s.nameEn, s.nameAr) })) : form.scopeType === 'cost_center' ? state.costCenters.map((c) => ({ id: c.id, name: L(locale, c.nameEn, c.nameAr) })) : [{ id: 'all', name: L(locale, 'All company', 'كل الشركة') }];
  const loadUser = (user: AppUser) => { const employee = state.employees.find((e) => e.id === user.employeeId); const access = state.userAccess.find((a) => a.employeeId === user.employeeId); setEditingUserId(user.id); setError(''); setForm({ email: user.email, displayName: user.displayName || employee?.name || '', employeeCode: employee?.code || '', branchId: employee?.branchId || 'company', department: employee?.department || 'Operations', jobTitle: employee?.jobTitle || 'Cashier', salary: employee?.salary || 0, roleId: access?.roleId || defaultRoleId, scopeType: access?.scopeType || 'branch', scopeId: access?.scopeId || employee?.branchId || defaultBranchId, status: user.status, mustChangePassword: user.mustChangePassword }); };
  const saveUser = () => { const email = form.email.trim().toLowerCase(); const name = form.displayName.trim(); const employeeCode = form.employeeCode.trim() || `EMP-${String(state.employees.length + 1).padStart(3, '0')}`; if (!email || !email.includes('@')) { setError(L(locale, 'Enter a valid user email.', 'أدخل بريد مستخدم صحيح.')); return; } if (!name) { setError(L(locale, 'Enter user / employee name.', 'أدخل اسم المستخدم / الموظف.')); return; } const duplicateEmail = (state.userAccounts ?? []).some((u) => u.id !== editingUserId && u.email.toLowerCase() === email); if (duplicateEmail) { setError(L(locale, 'This email already exists as a user.', 'هذا البريد موجود بالفعل كمستخدم.')); return; } const existingUser = (state.userAccounts ?? []).find((u) => u.id === editingUserId); const duplicateCode = state.employees.some((e) => e.id !== existingUser?.employeeId && e.code.toLowerCase() === employeeCode.toLowerCase()); if (duplicateCode) { setError(L(locale, 'This employee code already exists.', 'كود الموظف موجود بالفعل.')); return; }
    update((s) => { const currentUser = (s.userAccounts ?? []).find((u) => u.id === editingUserId); const employeeId = currentUser?.employeeId || id('EMP'); const employee: Employee = { id: employeeId, code: employeeCode, name, branchId: form.branchId, department: form.department || 'Operations', jobTitle: form.jobTitle || 'Employee', salary: Number(form.salary || 0), active: form.status !== 'disabled' }; const appUser: AppUser = { id: currentUser?.id || id('USR'), employeeId, email, displayName: name, status: form.status, authProvider: currentUser?.authProvider || 'local', mustChangePassword: form.mustChangePassword, createdAt: currentUser?.createdAt || new Date().toISOString(), lastLoginAt: currentUser?.lastLoginAt, active: form.status !== 'disabled' }; const scopeId = form.scopeType === 'all' ? 'all' : form.scopeId || form.branchId || 'all'; const accessRecord: UserAccess | undefined = form.roleId ? { id: s.userAccess.find((a) => a.employeeId === employeeId)?.id || id('ACCESS'), employeeId, roleId: form.roleId, scopeType: form.scopeType, scopeId } : undefined; const nextAccess = accessRecord ? upsert(s.userAccess.filter((a) => a.employeeId !== employeeId), accessRecord) : s.userAccess.filter((a) => a.employeeId !== employeeId); return addAudit({ ...s, employees: upsert(s.employees, employee), userAccounts: upsert(s.userAccounts ?? [], appUser), userAccess: nextAccess, activeUserId: s.activeUserId || employeeId }, currentUser ? 'edit' : 'create', 'user_employee', email, currentUser ? 'User and linked employee updated' : 'User created with linked employee by default'); }, L(locale, 'User and linked employee saved', 'تم حفظ المستخدم والموظف المرتبط')); reset(); };
  const disableUser = (user: AppUser) => update((s) => addAudit({ ...s, userAccounts: (s.userAccounts ?? []).map((u) => u.id === user.id ? { ...u, status: 'disabled', active: false } : u), employees: s.employees.map((e) => e.id === user.employeeId ? { ...e, active: false } : e) }, 'disable', 'user_employee', user.email, 'User disabled and linked employee deactivated'), L(locale, 'User disabled and employee deactivated', 'تم تعطيل المستخدم والموظف المرتبط'));
  const users = state.userAccounts ?? []; const orphanEmployees = state.employees.filter((e) => !users.some((u) => u.employeeId === e.id));
  return <div className="page-grid"><Card title={L(locale, 'Create user + employee', 'إنشاء مستخدم + موظف')} icon={<UserPlus/>} action={<button onClick={reset}><Plus size={16}/>{L(locale, 'New', 'جديد')}</button>}><div className="notice success">{L(locale, 'Creating a user automatically creates or updates the linked employee file. Access uses the linked employee, so HR, attendance, roles, and location scope stay connected.', 'إنشاء المستخدم ينشئ أو يحدث ملف الموظف المرتبط تلقائياً. الصلاحيات تستخدم الموظف المرتبط حتى تبقى الموارد البشرية والحضور والأدوار ونطاق الموقع مترابطة.')}</div>{error && <div className="notice warning">{error}</div>}<div className="form-grid"><Field label={L(locale, 'User email', 'بريد المستخدم')}><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="cashier@company.com"/></Field><Field label={L(locale, 'Display / employee name', 'اسم العرض / الموظف')}><input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })}/></Field><Field label={L(locale, 'Employee code', 'كود الموظف')}><input value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} placeholder="EMP-001"/></Field><Field label={L(locale, 'Branch', 'الفرع')}><select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value, scopeId: form.scopeType === 'branch' ? e.target.value : form.scopeId })}><option value="company">{L(locale, 'Company / HQ', 'الشركة / الإدارة')}</option>{state.branches.map((b) => <option key={b.id} value={b.id}>{L(locale, b.nameEn, b.nameAr)}</option>)}</select></Field><Field label={L(locale, 'Department', 'القسم')}><input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}/></Field><Field label={L(locale, 'Job title', 'المسمى الوظيفي')}><input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}/></Field><Field label={L(locale, 'Salary', 'الراتب')}><input type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: Number(e.target.value) })}/></Field><Field label={L(locale, 'User status', 'حالة المستخدم')}><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as AppUser['status'] })}><option value="active">{L(locale, 'Active', 'نشط')}</option><option value="invited">{L(locale, 'Invited / pending Supabase invite', 'دعوة / بانتظار Supabase')}</option><option value="disabled">{L(locale, 'Disabled', 'معطل')}</option></select></Field><Field label={L(locale, 'Role', 'الدور')}><select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}><option value="">—</option>{state.roles.map((r) => <option key={r.id} value={r.id}>{L(locale, r.nameEn, r.nameAr)}</option>)}</select></Field><Field label={L(locale, 'Scope type', 'نوع النطاق')}><select value={form.scopeType} onChange={(e) => setForm({ ...form, scopeType: e.target.value as RoleScope, scopeId: e.target.value === 'all' ? 'all' : '' })}><option value="all">{L(locale, 'All company', 'كل الشركة')}</option><option value="branch">{L(locale, 'Branch / restaurant', 'فرع / مطعم')}</option><option value="store">{L(locale, 'Store / stockroom', 'مخزن')}</option><option value="cost_center">{L(locale, 'Cost center', 'مركز تكلفة')}</option></select></Field><Field label={L(locale, 'Scope', 'النطاق')}><select value={form.scopeId} onChange={(e) => setForm({ ...form, scopeId: e.target.value })}>{scopeOptions().map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field><label className="check"><input type="checkbox" checked={form.mustChangePassword} onChange={(e) => setForm({ ...form, mustChangePassword: e.target.checked })}/><span>{L(locale, 'Require password reset / Supabase invite later', 'طلب تغيير كلمة المرور / دعوة Supabase لاحقاً')}</span></label></div><button onClick={saveUser}><Save size={16}/>{editingUserId ? L(locale, 'Update User + Employee', 'تحديث المستخدم والموظف') : L(locale, 'Create User + Employee', 'إنشاء المستخدم والموظف')}</button></Card><Card title={L(locale, 'User accounts', 'حسابات المستخدمين')} icon={<Users/>} action={<button onClick={() => saveFile('v302_users_employees.csv', rowsToCsv(users.map((u) => { const e = state.employees.find((x) => x.id === u.employeeId); const a = state.userAccess.find((x) => x.employeeId === u.employeeId); return { email: u.email, name: u.displayName, employeeCode: e?.code || '', branch: branchName(state, e?.branchId, locale), role: state.roles.find((r) => r.id === a?.roleId)?.nameEn || '', scope: a ? `${a.scopeType}:${a.scopeId}` : '', status: u.status }; })), 'text/csv;charset=utf-8')}><Download size={16}/>{L(locale, 'Export users', 'تصدير المستخدمين')}</button>}><Table headers={[L(locale, 'Email', 'البريد'), L(locale, 'Employee', 'الموظف'), L(locale, 'Branch', 'الفرع'), L(locale, 'Role', 'الدور'), L(locale, 'Scope', 'النطاق'), L(locale, 'Status', 'الحالة'), L(locale, 'Actions', 'إجراءات')]} rows={users.map((u) => { const e = state.employees.find((x) => x.id === u.employeeId); const a = state.userAccess.find((x) => x.employeeId === u.employeeId); const role = state.roles.find((r) => r.id === a?.roleId); return [u.email, e ? `${e.code} · ${e.name}` : L(locale, 'Missing employee link', 'رابط الموظف مفقود'), branchName(state, e?.branchId, locale), role ? L(locale, role.nameEn, role.nameAr) : '—', a ? `${a.scopeType}: ${a.scopeId === 'all' ? L(locale, 'All', 'الكل') : a.scopeId}` : '—', u.status, actionButtons(() => loadUser(u), () => disableUser(u), locale)]; })}/>{orphanEmployees.length > 0 && <div className="notice warning">{L(locale, `${orphanEmployees.length} employee(s) do not yet have user accounts. Create users here to link them.`, `${orphanEmployees.length} موظف/موظفين بدون حساب مستخدم. أنشئ المستخدمين هنا لربطهم.`)}</div>}</Card></div>;
}

function AccessPage({ state, update, locale }: { state: ERPState; update: (fn: (s: ERPState) => ERPState, success?: string) => void; locale: Locale }) {
  const [role, setRole] = useState<Role>({ id: '', nameEn: '', nameAr: '', description: '', permissions: [] });
  const [access, setAccess] = useState<UserAccess>({ id: '', employeeId: '', roleId: '', scopeType: 'all', scopeId: 'all' });
  const toggle = (key: string) => setRole((r) => ({ ...r, permissions: r.permissions.includes(key) ? r.permissions.filter((p) => p !== key) : [...r.permissions, key] }));
  const saveRole = () => role.nameEn && update((s) => addAudit({ ...s, roles: upsert(s.roles, { ...role, id: role.id || id('ROLE') }) }, role.id ? 'edit' : 'create', 'role', role.nameEn, 'Role saved'), L(locale, 'Role saved', 'تم حفظ الدور'));
  return <div className="page-grid"><Card title={L(locale, 'Custom roles and permissions', 'الأدوار والصلاحيات المخصصة')} icon={<ShieldCheck/>}><div className="form-grid"><Field label={L(locale, 'Role EN', 'الدور إنجليزي')}><input value={role.nameEn} onChange={(e) => setRole({ ...role, nameEn: e.target.value })}/></Field><Field label={L(locale, 'Role AR', 'الدور عربي')}><input value={role.nameAr} onChange={(e) => setRole({ ...role, nameAr: e.target.value })}/></Field><Field label={L(locale, 'Description', 'الوصف')}><input value={role.description} onChange={(e) => setRole({ ...role, description: e.target.value })}/></Field></div><div className="permission-grid">{permissionCatalog.map((p) => <label className="check permission" key={p.key}><input type="checkbox" checked={role.permissions.includes(p.key)} onChange={() => toggle(p.key)}/><span><strong>{L(locale, p.labelEn, p.labelAr)}</strong><small>{L(locale, p.moduleEn, p.moduleAr)} · {p.key}</small></span></label>)}</div><button onClick={saveRole}><Save size={16}/>{L(locale, 'Save Role', 'حفظ الدور')}</button></Card><Card title={L(locale, 'Assign role and location scope', 'تعيين الدور ونطاق الموقع')} icon={<LockKeyhole/>}><div className="form-grid"><Field label={L(locale, 'Employee', 'الموظف')}><select value={access.employeeId} onChange={(e) => setAccess({ ...access, employeeId: e.target.value })}><option value="">—</option>{state.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field><Field label={L(locale, 'Role', 'الدور')}><select value={access.roleId} onChange={(e) => setAccess({ ...access, roleId: e.target.value })}><option value="">—</option>{state.roles.map((r) => <option key={r.id} value={r.id}>{L(locale, r.nameEn, r.nameAr)}</option>)}</select></Field><Field label={L(locale, 'Scope type', 'نوع النطاق')}><select value={access.scopeType} onChange={(e) => setAccess({ ...access, scopeType: e.target.value as RoleScope, scopeId: 'all' })}><option value="all">{L(locale, 'All company', 'كل الشركة')}</option><option value="branch">{L(locale, 'Branch / restaurant', 'فرع / مطعم')}</option><option value="store">{L(locale, 'Store / stockroom', 'مخزن')}</option><option value="cost_center">{L(locale, 'Cost center', 'مركز تكلفة')}</option></select></Field><Field label={L(locale, 'Scope', 'النطاق')}><select value={access.scopeId} onChange={(e) => setAccess({ ...access, scopeId: e.target.value })}><option value="all">{L(locale, 'All', 'الكل')}</option>{access.scopeType === 'branch' && state.branches.map((b) => <option key={b.id} value={b.id}>{L(locale, b.nameEn, b.nameAr)}</option>)}{access.scopeType === 'store' && state.stores.map((s) => <option key={s.id} value={s.id}>{L(locale, s.nameEn, s.nameAr)}</option>)}{access.scopeType === 'cost_center' && state.costCenters.map((c) => <option key={c.id} value={c.id}>{L(locale, c.nameEn, c.nameAr)}</option>)}</select></Field></div><button onClick={() => access.employeeId && access.roleId && update((s) => addAudit({ ...s, userAccess: upsert(s.userAccess, { ...access, id: access.id || id('ACCESS') }) }, 'assign', 'access', access.employeeId, 'Access assigned'), L(locale, 'Access assigned', 'تم تعيين الصلاحية'))}><ShieldCheck size={16}/>{L(locale, 'Assign Access', 'تعيين الصلاحية')}</button><Table headers={[L(locale, 'Employee', 'الموظف'), L(locale, 'Role', 'الدور'), L(locale, 'Scope', 'النطاق')]} rows={state.userAccess.map((a) => [state.employees.find((e) => e.id === a.employeeId)?.name ?? '—', L(locale, state.roles.find((r) => r.id === a.roleId)?.nameEn ?? '—', state.roles.find((r) => r.id === a.roleId)?.nameAr ?? '—'), `${a.scopeType}: ${a.scopeId === 'all' ? L(locale, 'All', 'الكل') : a.scopeId}`])}/></Card></div>;
}


function StockPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info' }) { return <span className={`pill ${tone}`}>{children}</span>; }
function inventoryRowSet(state: ERPState) {
  return state.stores.flatMap((store) => state.items.map((item) => {
    const balance = getBalance(state, store.id, item.id);
    const cost = getAveragePurchaseCost(state, item.id);
    return { store, item, balance, cost, value: balance * cost };
  }));
}
function itemStockCardRows(state: ERPState) {
  return state.items.map((item) => {
    const qtyOnHand = state.stores.reduce((sum, store) => sum + getBalance(state, store.id, item.id), 0);
    const purchases = state.stockMovements.filter((m) => m.itemId === item.id && m.type === 'purchase_invoice' && m.direction === 'in' && m.unitCost > 0);
    const last = purchases[purchases.length - 1]?.unitCost ?? 0;
    const avg = getAveragePurchaseCost(state, item.id);
    const totalIn = state.stockMovements.filter((m) => m.itemId === item.id && m.direction === 'in').reduce((s, m) => s + m.qty, 0);
    const totalOut = state.stockMovements.filter((m) => m.itemId === item.id && m.direction === 'out').reduce((s, m) => s + m.qty, 0);
    return { item, qtyOnHand, avg, last, value: qtyOnHand * avg, totalIn, totalOut };
  });
}
function InventoryPage({ state, update, locale }: { state: ERPState; update: (fn: (s: ERPState) => ERPState, success?: string) => void; locale: Locale }) {
  const [tab, setTab] = useState<InventoryTab>('command');
  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');
  const [transfer, setTransfer] = useState<TransferDoc>({ id: '', date: today(), ref: '', fromStoreId: '', toStoreId: '', itemId: '', qty: 0, posted: false });
  const [binDraft, setBinDraft] = useState<BinLocation>({ id: '', storeId: '', code: '', zone: '', type: 'Shelf', active: true });
  const [adjustment, setAdjustment] = useState({ storeId: '', itemId: '', direction: 'out' as Direction, qty: 0, reason: 'Wastage / spoilage', costCenterId: 'company', note: '' });
  const [count, setCount] = useState({ storeId: '', itemId: '', countedQty: 0, costCenterId: 'company', note: '' });
  const [returnDoc, setReturnDoc] = useState({ supplierId: '', storeId: '', itemId: '', qty: 0, reason: 'Damaged / rejected goods', creditType: 'ap_credit' as SupplierReturnDoc['creditType'], sourceLotId: '' });
  type OpeningPreviewRow = { rowNo: number; storeCode: string; itemSku: string; qty: number; unitCost: number; date: string; lotNo: string; binCode: string; expiryDate: string; errors: string[] };
  type CountPreviewRow = { rowNo: number; storeCode: string; itemSku: string; countedQty: number; systemQty: number; variance: number; costCenterCode: string; note: string; errors: string[] };
  const [openingRows, setOpeningRows] = useState<OpeningPreviewRow[]>([]);
  const [countRows, setCountRows] = useState<CountPreviewRow[]>([]);
  const [openingFileName, setOpeningFileName] = useState('');
  const [countFileName, setCountFileName] = useState('');
  const [stockCountRef, setStockCountRef] = useState(`SC-${today().slice(0, 7)}-001`);
  const [countSheetStoreId, setCountSheetStoreId] = useState('all');
  const [autoCreateOpeningItems, setAutoCreateOpeningItems] = useState(true);
  const [autoCreateCountItems, setAutoCreateCountItems] = useState(false);
  const allRows = inventoryRowSet(state);
  const visibleRows = allRows.filter((r) => (r.balance !== 0 || r.cost > 0 || state.items.length <= 35))
    .filter((r) => storeFilter === 'all' || r.store.id === storeFilter)
    .filter((r) => !search.trim() || `${r.item.sku} ${r.item.nameEn} ${r.item.nameAr} ${r.item.category} ${r.store.nameEn} ${r.store.nameAr}`.toLowerCase().includes(search.toLowerCase()));
  const itemCards = itemStockCardRows(state);
  const lots = state.inventoryLots ?? [];
  const bins = state.binLocations ?? [];
  const pendingApprovals = (state.inventoryApprovals ?? []).filter((a) => a.status === 'pending' || a.status === 'approved');
  const quarantineLots = lots.filter((l) => l.status === 'quarantine');
  const expiringLots = lots.filter((l) => l.status === 'available' && daysUntil(l.expiryDate) <= 7);
  const zeroCostWithQty = allRows.filter((r) => r.balance > 0 && r.cost <= 0);
  const negativeStock = allRows.filter((r) => r.balance < 0);
  const lowStock = allRows.filter((r) => r.balance > 0 && r.balance <= r.item.reorderPoint);
  const glInventory = accountTotal(state, '1300', 'debitMinusCredit') + accountTotal(state, '1310', 'debitMinusCredit');
  const inventoryValue = allRows.reduce((sum, r) => sum + r.value, 0);
  const reconciliationDiff = inventoryValue - glInventory;
  const healthScore = Math.max(0, 100 - zeroCostWithQty.length * 10 - negativeStock.length * 20 - lowStock.length * 3 - quarantineLots.length * 4 - expiringLots.length * 3 - pendingApprovals.length * 2 - (Math.abs(reconciliationDiff) > 1 ? 20 : 0));
  const selectedTransferBalance = getBalance(state, transfer.fromStoreId, transfer.itemId);
  const selectedTransferCost = getAveragePurchaseCost(state, transfer.itemId);
  const transferReady = !!(transfer.fromStoreId && transfer.toStoreId && transfer.itemId && transfer.qty > 0 && transfer.fromStoreId !== transfer.toStoreId && selectedTransferBalance >= transfer.qty);
  const exportRows = () => saveFile(`inventory-balances-${today()}.csv`, rowsToCsv(visibleRows.map((r) => ({ store: r.store.code, item: r.item.sku, item_name: r.item.nameEn, category: r.item.category, on_hand: r.balance, average_cost: r.cost, value: r.value, status: r.balance < 0 ? 'negative' : r.balance > 0 && r.cost <= 0 ? 'needs costing' : r.balance <= r.item.reorderPoint ? 'low stock' : 'ok' }))), 'text/csv;charset=utf-8');
  const exportLedger = () => saveFile(`stock-ledger-${today()}.csv`, rowsToCsv(state.stockMovements.map((m) => ({ date: m.date, ref: m.ref, type: m.type, store: storeName(state, m.storeId, 'en'), item: itemName(state, m.itemId, 'en'), direction: m.direction, qty: m.qty, unit_cost: m.unitCost, lot: m.lotNo ?? '', bin: m.binCode ?? '', expiry: m.expiryDate ?? '', value: m.qty * m.unitCost, note: m.note }))), 'text/csv;charset=utf-8');
  const saveBin = () => binDraft.storeId && binDraft.code && update((s) => addAudit({ ...s, binLocations: upsert(s.binLocations, { ...binDraft, id: binDraft.id || id('BIN') }) }, binDraft.id ? 'edit' : 'create', 'bin_location', binDraft.code, 'Bin location saved'), L(locale, 'Bin location saved', 'تم حفظ موقع التخزين'));
  const updateLotStatus = (lotId: string, status: InventoryLotStatus, note: string) => update((s) => addAudit({ ...s, inventoryLots: s.inventoryLots.map((l) => l.id === lotId ? { ...l, status, note } : l) }, 'update', 'inventory_lot', lotId, note), L(locale, 'Lot status updated', 'تم تحديث حالة التشغيلة'));
  const postTransfer = () => { if (!transferReady) return; update((s) => { const ref = `TR-${String(s.transfers.length + 1).padStart(4, '0')}`; const cost = getAveragePurchaseCost(s, transfer.itemId); const doc = { ...transfer, id: id('TR'), ref, posted: true }; const out: StockMovement = { id: id('MOV'), date: today(), type: 'transfer', storeId: transfer.fromStoreId, itemId: transfer.itemId, direction: 'out', qty: transfer.qty, unitCost: cost, ref, note: 'Transfer dispatch' }; const inn: StockMovement = { id: id('MOV'), date: today(), type: 'transfer', storeId: transfer.toStoreId, itemId: transfer.itemId, direction: 'in', qty: transfer.qty, unitCost: cost, ref, note: 'Transfer receipt' }; return addAudit({ ...s, transfers: [...s.transfers, doc], stockMovements: [...s.stockMovements, out, inn] }, 'post', 'transfer', ref, 'Stock transfer posted with source/destination audit'); }, L(locale, 'Transfer posted', 'تم ترحيل التحويل')); };
  const requestAdjustment = () => { if (!adjustment.storeId || !adjustment.itemId || adjustment.qty <= 0) return; update((s) => { const ref = `IAP-${String(s.inventoryApprovals.length + 1).padStart(4, '0')}`; const approval: InventoryApproval = { id: id('IAP'), ref, date: today(), requestType: 'adjustment', status: 'pending', storeId: adjustment.storeId, itemId: adjustment.itemId, direction: adjustment.direction, qty: adjustment.qty, unitCost: getAveragePurchaseCost(s, adjustment.itemId), costCenterId: adjustment.costCenterId, reason: adjustment.reason, note: adjustment.note, requestedBy: 'Local Admin' }; return addAudit({ ...s, inventoryApprovals: [...s.inventoryApprovals, approval] }, 'request', 'inventory_approval', ref, 'Adjustment requested; waiting approval'); }, L(locale, 'Adjustment sent for approval', 'تم إرسال التسوية للموافقة')); };
  const requestCountVariance = () => { if (!count.storeId || !count.itemId) return; const systemQty = getBalance(state, count.storeId, count.itemId); const variance = Number(count.countedQty || 0) - systemQty; if (Math.abs(variance) < 0.0001) return; update((s) => { const ref = `IAP-${String(s.inventoryApprovals.length + 1).padStart(4, '0')}`; const approval: InventoryApproval = { id: id('IAP'), ref, date: today(), requestType: 'count_variance', status: 'pending', storeId: count.storeId, itemId: count.itemId, direction: variance > 0 ? 'in' : 'out', qty: Math.abs(variance), countedQty: Number(count.countedQty || 0), systemQty, unitCost: getAveragePurchaseCost(s, count.itemId), costCenterId: count.costCenterId, reason: 'Cycle count variance', note: count.note, requestedBy: 'Local Admin' }; return addAudit({ ...s, inventoryApprovals: [...s.inventoryApprovals, approval] }, 'request', 'count_variance', ref, 'Cycle count variance requested; waiting approval'); }, L(locale, 'Count variance sent for approval', 'تم إرسال فرق الجرد للموافقة')); };
  const postApproval = (approval: InventoryApproval) => update((s) => { const ref = `POST-${approval.ref}`; const item = s.items.find((i) => i.id === approval.itemId); const store = s.stores.find((st) => st.id === approval.storeId); const value = approval.qty * approval.unitCost; const movement: StockMovement = { id: id('MOV'), date: today(), type: approval.requestType, storeId: approval.storeId, itemId: approval.itemId, direction: approval.direction, qty: approval.qty, unitCost: approval.unitCost, ref, note: approval.reason }; const invAccount = item?.isSemiFinished ? '1310' : '1300'; const journal: JournalEntry = { id: id('JE'), date: today(), ref, source: approval.requestType, description: approval.reason, status: 'posted', lines: approval.direction === 'out' ? [ { id: id('JL'), accountCode: '6700', debit: value, credit: 0, branchId: store?.branchId ?? 'company', costCenterId: approval.costCenterId, memo: approval.reason }, { id: id('JL'), accountCode: invAccount, debit: 0, credit: value, branchId: store?.branchId ?? 'company', costCenterId: 'company', memo: 'Inventory decrease' } ] : [ { id: id('JL'), accountCode: invAccount, debit: value, credit: 0, branchId: store?.branchId ?? 'company', costCenterId: 'company', memo: 'Inventory increase' }, { id: id('JL'), accountCode: '6700', debit: 0, credit: value, branchId: store?.branchId ?? 'company', costCenterId: approval.costCenterId, memo: approval.reason } ] }; return addAudit({ ...s, inventoryApprovals: s.inventoryApprovals.map((a) => a.id === approval.id ? { ...a, status: 'posted', approvedBy: 'Local Admin', postedRef: ref } : a), stockMovements: [...s.stockMovements, movement], journals: [...s.journals, journal] }, 'post', approval.requestType, ref, 'Approved inventory request posted'); }, L(locale, 'Approved request posted', 'تم ترحيل الطلب المعتمد'));
  const rejectApproval = (approvalId: string) => update((s) => addAudit({ ...s, inventoryApprovals: s.inventoryApprovals.map((a) => a.id === approvalId ? { ...a, status: 'rejected' } : a) }, 'reject', 'inventory_approval', approvalId, 'Approval rejected'), L(locale, 'Approval rejected', 'تم رفض الطلب'));
  const postSupplierReturn = () => { if (!returnDoc.supplierId || !returnDoc.storeId || !returnDoc.itemId || returnDoc.qty <= 0) return; const available = getBalance(state, returnDoc.storeId, returnDoc.itemId); if (available < returnDoc.qty) return; update((s) => { const ref = `SRET-${String(s.supplierReturns.length + 1).padStart(4, '0')}`; const cost = getAveragePurchaseCost(s, returnDoc.itemId); const item = s.items.find((i) => i.id === returnDoc.itemId); const store = s.stores.find((st) => st.id === returnDoc.storeId); const doc: SupplierReturnDoc = { ...returnDoc, id: id('SRET'), ref, date: today(), unitCost: cost, status: 'posted' }; const movement: StockMovement = { id: id('MOV'), date: today(), type: 'supplier_return', storeId: returnDoc.storeId, itemId: returnDoc.itemId, direction: 'out', qty: returnDoc.qty, unitCost: cost, ref, note: returnDoc.reason, supplierId: returnDoc.supplierId }; const invAccount = item?.isSemiFinished ? '1310' : '1300'; const debitAccount = returnDoc.creditType === 'cash_refund' ? '1010' : returnDoc.creditType === 'replacement' ? '1400' : '2100'; const journal: JournalEntry = { id: id('JE'), date: today(), ref, source: 'supplier_return', description: returnDoc.reason, status: 'posted', lines: [ { id: id('JL'), accountCode: debitAccount, debit: returnDoc.qty * cost, credit: 0, branchId: store?.branchId ?? 'company', costCenterId: 'company', memo: returnDoc.creditType === 'replacement' ? 'Supplier replacement claim' : 'Supplier credit / refund' }, { id: id('JL'), accountCode: invAccount, debit: 0, credit: returnDoc.qty * cost, branchId: store?.branchId ?? 'company', costCenterId: 'company', memo: 'Inventory returned to supplier' } ] }; return addAudit({ ...s, supplierReturns: [...s.supplierReturns, doc], stockMovements: [...s.stockMovements, movement], journals: [...s.journals, journal], inventoryLots: s.inventoryLots.map((l) => l.id === returnDoc.sourceLotId ? { ...l, status: 'returned', note: `Returned under ${ref}` } : l) }, 'post', 'supplier_return', ref, 'Supplier return posted'); }, L(locale, 'Supplier return posted', 'تم ترحيل مرتجع المورد')); };
  const csvPick = (row: Record<string, string>, aliases: string[]) => { const target = aliases.map(normalizeImportKey); const key = Object.keys(row).find((h) => target.includes(normalizeImportKey(h))); return key ? row[key] : ''; };
  const storeByCode = (s: ERPState, code: string) => s.stores.find((st) => normalizeImportKey(st.code) === normalizeImportKey(code) || normalizeImportKey(st.nameEn) === normalizeImportKey(code) || normalizeImportKey(st.nameAr) === normalizeImportKey(code));
  const itemBySkuLocal = (s: ERPState, sku: string) => s.items.find((i) => normalizeImportKey(i.sku) === normalizeImportKey(sku) || normalizeImportKey(i.nameEn) === normalizeImportKey(sku) || normalizeImportKey(i.nameAr) === normalizeImportKey(sku));
  const costCenterByCode = (s: ERPState, code: string) => s.costCenters.find((c) => normalizeImportKey(c.code) === normalizeImportKey(code) || normalizeImportKey(c.nameEn) === normalizeImportKey(code) || normalizeImportKey(c.nameAr) === normalizeImportKey(code));
  const loadOpeningStockCsv = (file: File) => file.text().then((text) => { const parsed = parseCsvText(text); const preview = parsed.rows.map((row, idx) => { const storeCode = csvPick(row, ['store_code','store','storeCode','Store','Store Code','المخزن']); const itemSku = csvPick(row, ['item_sku','sku','item','Ingredient','Item SKU','SKU','الصنف']); const qtyValue = numberValue(csvPick(row, ['qty','quantity','opening_qty','opening_quantity','on_hand','balance','الكمية'])); const unitCost = numberValue(csvPick(row, ['unit_cost','average_cost','cost','unitCost','التكلفة'])); const date = csvPick(row, ['date','opening_date','Date','التاريخ']) || today(); const lotNo = csvPick(row, ['lot_no','lot','batch','lotNo','التشغيلة']); const binCode = csvPick(row, ['bin_code','bin','shelf','binCode','الموقع']); const expiryDate = csvPick(row, ['expiry_date','expiry','expiryDate','الصلاحية']); const errors: string[] = []; if (!storeByCode(state, storeCode)) errors.push('Unknown store'); if (!itemBySkuLocal(state, itemSku) && !autoCreateOpeningItems) errors.push('Unknown item SKU'); if (qtyValue <= 0) errors.push('Quantity must be greater than zero'); return { rowNo: idx + 2, storeCode, itemSku, qty: qtyValue, unitCost, date, lotNo, binCode, expiryDate, errors }; }); setOpeningRows(preview); setOpeningFileName(file.name); });
  const loadStockCountCsv = (file: File) => file.text().then((text) => { const parsed = parseCsvText(text); const preview = parsed.rows.map((row, idx) => { const storeCode = csvPick(row, ['store_code','store','storeCode','Store','Store Code','المخزن']); const itemSku = csvPick(row, ['item_sku','sku','item','Ingredient','Item SKU','SKU','الصنف']); const countedQty = numberValue(csvPick(row, ['counted_qty','counted','physical_qty','stock_count','qty','quantity','الجرد'])); const costCenterCode = csvPick(row, ['cost_center_code','cost_center','costCenter','cc','مركز التكلفة']) || 'company'; const note = csvPick(row, ['note','notes','reason','ملاحظة']); const store = storeByCode(state, storeCode); const item = itemBySkuLocal(state, itemSku); const systemQty = store && item ? getBalance(state, store.id, item.id) : 0; const variance = countedQty - systemQty; const errors: string[] = []; if (!store) errors.push('Unknown store'); if (!item && !autoCreateCountItems) errors.push('Unknown item SKU'); if (costCenterCode !== 'company' && !costCenterByCode(state, costCenterCode)) errors.push('Unknown cost center'); return { rowNo: idx + 2, storeCode, itemSku, countedQty, systemQty, variance, costCenterCode, note, errors }; }); setCountRows(preview); setCountFileName(file.name); });
  const openingValidRows = openingRows.filter((r) => !r.errors.length);
  const countValidRows = countRows.filter((r) => !r.errors.length);
  const openingValue = openingValidRows.reduce((sum, r) => sum + r.qty * r.unitCost, 0);
  const countSurplus = countValidRows.filter((r) => r.variance > 0.0001);
  const countShortage = countValidRows.filter((r) => r.variance < -0.0001);
  const postOpeningStock = () => { if (!openingValidRows.length) return; update((s) => { const batchRef = `OPEN-STOCK-${new Date().toISOString().slice(0, 10)}-${String(s.stockMovements.filter((m) => m.type === 'opening_stock').length + 1).padStart(3, '0')}`; const movements: StockMovement[] = []; const newLots: InventoryLot[] = []; let items = [...s.items]; const normalizeItemName = (sku: string) => sku.replace(/[-_]+/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()); const ensureItem = (sku: string) => { const found = items.find((i) => normalizeImportKey(i.sku) === normalizeImportKey(sku) || normalizeImportKey(i.nameEn) === normalizeImportKey(sku) || normalizeImportKey(i.nameAr) === normalizeImportKey(sku)); if (found) return found; const created: Item = { id: id('ITM'), sku: sku.trim(), nameEn: normalizeItemName(sku), nameAr: normalizeItemName(sku), category: 'Imported Opening Stock', purchaseUnit: 'KG', consumptionUnit: 'KG', conversionFactor: 1, standardCost: 0, minStock: 0, maxStock: 0, reorderPoint: 0, isSemiFinished: sku.toUpperCase().startsWith('SF-') || sku.toUpperCase().includes('DOUGH'), active: true }; items = [...items, created]; return created; }; openingValidRows.forEach((row) => { const store = storeByCode(s, row.storeCode); const item = autoCreateOpeningItems ? ensureItem(row.itemSku) : itemBySkuLocal(s, row.itemSku); if (!store || !item) return; movements.push({ id: id('MOV'), date: row.date || today(), type: 'opening_stock', storeId: store.id, itemId: item.id, direction: 'in', qty: row.qty, unitCost: row.unitCost, ref: batchRef, note: autoCreateOpeningItems && !s.items.find((i) => normalizeImportKey(i.sku) === normalizeImportKey(row.itemSku)) ? 'Opening stock upload - item master auto-created' : 'Opening stock upload', lotNo: row.lotNo, binCode: row.binCode, expiryDate: row.expiryDate }); if (row.lotNo || row.binCode || row.expiryDate) newLots.push({ id: id('LOT'), storeId: store.id, itemId: item.id, lotNo: row.lotNo || batchRef, batchNo: row.lotNo || batchRef, binCode: row.binCode || 'OPEN', receivedDate: row.date || today(), expiryDate: row.expiryDate || '', qty: row.qty, unitCost: row.unitCost, status: 'available', sourceRef: batchRef, note: 'Opening stock upload' }); }); const rawValue = movements.filter((m) => !items.find((i) => i.id === m.itemId)?.isSemiFinished).reduce((sum, m) => sum + m.qty * m.unitCost, 0); const semiValue = movements.filter((m) => items.find((i) => i.id === m.itemId)?.isSemiFinished).reduce((sum, m) => sum + m.qty * m.unitCost, 0); const totalValue = rawValue + semiValue; const lines: JournalLine[] = []; if (rawValue > 0) lines.push({ id: id('JL'), accountCode: '1300', debit: rawValue, credit: 0, branchId: 'company', costCenterId: 'company', memo: 'Opening raw inventory' }); if (semiValue > 0) lines.push({ id: id('JL'), accountCode: '1310', debit: semiValue, credit: 0, branchId: 'company', costCenterId: 'company', memo: 'Opening semi-finished inventory' }); if (totalValue > 0) lines.push({ id: id('JL'), accountCode: '3000', debit: 0, credit: totalValue, branchId: 'company', costCenterId: 'company', memo: 'Opening inventory equity / conversion balance' }); const journals = totalValue > 0 ? [...s.journals, { id: id('JE'), date: today(), ref: batchRef, source: 'opening_stock', description: 'Opening inventory upload', status: 'posted' as JournalStatus, lines }] : s.journals; const createdCount = items.length - s.items.length; return addAudit({ ...s, items, stockMovements: [...s.stockMovements, ...movements], inventoryLots: [...s.inventoryLots, ...newLots], journals }, 'post', 'opening_stock', batchRef, `Uploaded opening stock rows: ${movements.length}; auto-created items: ${createdCount}`); }, L(locale, 'Opening stock posted', 'تم ترحيل الرصيد الافتتاحي للمخزون')); setOpeningRows([]); };
  const createStockCountBatch = () => { if (!countValidRows.length) return; update((s) => { const approvals: InventoryApproval[] = []; let items = [...s.items]; const normalizeItemName = (sku: string) => sku.replace(/[-_]+/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()); const ensureItem = (sku: string) => { const found = items.find((i) => normalizeImportKey(i.sku) === normalizeImportKey(sku) || normalizeImportKey(i.nameEn) === normalizeImportKey(sku) || normalizeImportKey(i.nameAr) === normalizeImportKey(sku)); if (found) return found; const created: Item = { id: id('ITM'), sku: sku.trim(), nameEn: normalizeItemName(sku), nameAr: normalizeItemName(sku), category: 'Imported Stock Count', purchaseUnit: 'KG', consumptionUnit: 'KG', conversionFactor: 1, standardCost: 0, minStock: 0, maxStock: 0, reorderPoint: 0, isSemiFinished: sku.toUpperCase().startsWith('SF-') || sku.toUpperCase().includes('DOUGH'), active: true }; items = [...items, created]; return created; }; countValidRows.forEach((row, index) => { const store = storeByCode(s, row.storeCode); const item = autoCreateCountItems ? ensureItem(row.itemSku) : itemBySkuLocal(s, row.itemSku); if (!store || !item || Math.abs(row.variance) < 0.0001) return; const cc = row.costCenterCode === 'company' ? undefined : costCenterByCode(s, row.costCenterCode); approvals.push({ id: id('IAP'), ref: `${stockCountRef || 'SC'}-${String(index + 1).padStart(3, '0')}`, date: today(), requestType: 'count_variance', status: 'pending', storeId: store.id, itemId: item.id, direction: row.variance > 0 ? 'in' : 'out', qty: Math.abs(row.variance), countedQty: row.countedQty, systemQty: row.systemQty, unitCost: getAveragePurchaseCost({ ...s, items }, item.id), costCenterId: cc?.id ?? 'company', reason: row.variance > 0 ? 'Monthly stock count surplus' : 'Monthly stock count shortage', note: row.note || stockCountRef, requestedBy: 'Local Admin' }); }); const createdCount = items.length - s.items.length; return addAudit({ ...s, items, inventoryApprovals: [...s.inventoryApprovals, ...approvals] }, 'request', 'stock_count_batch', stockCountRef || 'SC', `Created stock count variance approvals: ${approvals.length}; auto-created items: ${createdCount}`); }, L(locale, 'Stock count variance batch created', 'تم إنشاء دفعة فروقات الجرد للموافقة')); setCountRows([]); };
  const downloadOpeningTemplate = () => saveFile('opening_stock_v41_template.csv', rowsToCsv([{ store_code: 'R01-KIT', item_sku: 'RM-BEEF', qty: 10, unit_cost: 45, date: today(), lot_no: 'LOT-001', bin_code: 'CH-01', expiry_date: '2026-06-30' }]), 'text/csv;charset=utf-8');
  const downloadStockCountTemplate = () => saveFile('monthly_stock_count_v41_template.csv', rowsToCsv([{ count_batch_ref: stockCountRef, store_code: 'R01-KIT', item_sku: 'RM-BEEF', counted_qty: 9.5, cost_center_code: 'CC-R01-KIT', note: 'Monthly count' }]), 'text/csv;charset=utf-8');
  const downloadStoreCountSheet = () => {
    const selectedStores = state.stores.filter((store) => countSheetStoreId === 'all' || store.id === countSheetStoreId);
    const rows = selectedStores.flatMap((store) => state.items.filter((item) => item.active !== false).map((item) => {
      const systemQty = getBalance(state, store.id, item.id);
      const cc = state.costCenters.find((c) => c.branchId === store.branchId && c.active !== false) ?? state.costCenters.find((c) => c.code === 'company');
      return { count_batch_ref: stockCountRef, store_code: store.code, store_name: store.nameEn, item_sku: item.sku, item_name: item.nameEn, system_qty: systemQty, counted_qty: '', variance_formula_note: 'Enter physical count only; ERP calculates variance on upload', cost_center_code: cc?.code ?? 'company', note: 'Monthly count' };
    })).filter((row) => Number(row.system_qty) !== 0 || countSheetStoreId !== 'all');
    saveFile(`monthly-count-sheet-${countSheetStoreId === 'all' ? 'all-stores' : (state.stores.find((st) => st.id === countSheetStoreId)?.code ?? 'store')}-${today()}.csv`, rowsToCsv(rows), 'text/csv;charset=utf-8');
  };
  const tabs: Record<InventoryTab, { en: string; ar: string; icon: ReactNode }> = {
    command: { en: 'Command Center', ar: 'مركز التحكم', icon: <LayoutDashboard size={16}/> },
    availability: { en: 'Available Stock', ar: 'الرصيد المتاح', icon: <PackageCheck size={16}/> },
    balances: { en: 'Balances by Store', ar: 'الأرصدة حسب المخزن', icon: <Archive size={16}/> },
    items: { en: 'Item Cost Cards', ar: 'بطاقات تكلفة الأصناف', icon: <Database size={16}/> },
    locations: { en: 'Bins & Barcodes', ar: 'المواقع والباركود', icon: <Store size={16}/> },
    lots: { en: 'Lots & Expiry', ar: 'التشغيلات والصلاحية', icon: <PackageCheck size={16}/> },
    transfers: { en: 'Transfers', ar: 'التحويلات', icon: <PackageCheck size={16}/> },
    openingStock: { en: 'Opening Stock Upload', ar: 'رفع الرصيد الافتتاحي', icon: <Upload size={16}/> },
    stockCount: { en: 'Monthly Stock Count', ar: 'الجرد الشهري', icon: <ClipboardCheck size={16}/> },
    adjustments: { en: 'Requests & Counts', ar: 'طلبات وجرد', icon: <ClipboardCheck size={16}/> },
    approvals: { en: 'Approval Queue', ar: 'طابور الموافقات', icon: <ShieldCheck size={16}/> },
    quarantine: { en: 'Quarantine', ar: 'الحجز والفحص', icon: <LockKeyhole size={16}/> },
    returns: { en: 'Supplier Returns', ar: 'مرتجعات الموردين', icon: <RefreshCw size={16}/> },
    reconciliation: { en: 'Reconciliation', ar: 'المطابقة والرقابة', icon: <Calculator size={16}/> },
    ledger: { en: 'Stock Ledger', ar: 'دفتر حركة المخزون', icon: <ListChecks size={16}/> },
  };
  return <div className="page-grid">
    <div className="kpi-grid"><KPI label={L(locale, 'Inventory value', 'قيمة المخزون')} value={money(inventoryValue, locale)} hint={L(locale, 'Weighted average purchase cost', 'متوسط تكلفة الشراء المرجح')} icon={<Archive/>}/><KPI label={L(locale, 'Control score', 'مؤشر الرقابة')} value={`${healthScore}%`} hint={L(locale, 'Lots, expiry, approvals, GL match', 'التشغيلات، الصلاحية، الموافقات، المطابقة')} icon={<ShieldCheck/>}/><KPI label={L(locale, 'Quarantine lots', 'تشغيلات محجوزة')} value={`${quarantineLots.length}`} hint={L(locale, 'Quality hold', 'حجز جودة')} icon={<LockKeyhole/>}/><KPI label={L(locale, 'Expiring soon', 'قريب الانتهاء')} value={`${expiringLots.length}`} hint={L(locale, 'Within 7 days', 'خلال ٧ أيام')} icon={<ClipboardCheck/>}/><KPI label={L(locale, 'Pending approvals', 'موافقات معلقة')} value={`${pendingApprovals.length}`} hint={L(locale, 'Adjustments/counts', 'تسويات وجرد')} icon={<ListChecks/>}/></div>
    <Card title={L(locale, 'Live inventory control workspace', 'مساحة رقابة المخزون التشغيلية')} icon={<Layers/>} action={<div className="button-row"><button onClick={exportRows}><Download size={16}/>{L(locale, 'Export balances', 'تصدير الأرصدة')}</button><button onClick={exportLedger}><Download size={16}/>{L(locale, 'Export ledger', 'تصدير الدفتر')}</button></div>}><div className="tab-row">{(Object.keys(tabs) as InventoryTab[]).map((key) => <TabButton key={key} active={tab} value={key} onClick={setTab}>{tabs[key].icon}{L(locale, tabs[key].en, tabs[key].ar)}</TabButton>)}</div></Card>
    {tab === 'command' && <div className="page-grid two"><Card title={L(locale, 'Inventory control map', 'خريطة رقابة المخزون')} icon={<ClipboardCheck/>}><div className="cycle-map"><div><strong>1</strong><span>{L(locale, 'PO/Invoice receiving creates stock movements + lots + bin location.', 'الاستلام ينشئ حركة مخزون + تشغيلة + موقع تخزين.')}</span></div><div><strong>2</strong><span>{L(locale, 'Average cost is recalculated from posted invoice prices.', 'متوسط التكلفة يحتسب من أسعار فواتير الشراء المرحلة.')}</span></div><div><strong>3</strong><span>{L(locale, 'FEFO/expiry and quarantine control protect food safety.', 'الصلاحية والحجز يحميان سلامة الغذاء.')}</span></div><div><strong>4</strong><span>{L(locale, 'Adjustments and count variances require approval before GL posting.', 'التسويات وفروقات الجرد تتطلب موافقة قبل الترحيل.')}</span></div><div><strong>5</strong><span>{L(locale, 'Supplier returns reduce stock and supplier AP/claims.', 'مرتجعات الموردين تخفض المخزون والذمم/المطالبات.')}</span></div><div><strong>6</strong><span>{L(locale, 'Stock subledger reconciles to inventory GL accounts.', 'دفتر المخزون الفرعي يطابق حسابات الأستاذ.')}</span></div></div></Card><Card title={L(locale, 'Control exceptions', 'استثناءات الرقابة')} icon={<ShieldCheck/>}><div className="exception-grid"><div><StockPill tone={zeroCostWithQty.length ? 'warn' : 'good'}>{zeroCostWithQty.length}</StockPill><span>{L(locale, 'Quantity with zero cost', 'كمية بتكلفة صفرية')}</span></div><div><StockPill tone={negativeStock.length ? 'bad' : 'good'}>{negativeStock.length}</StockPill><span>{L(locale, 'Negative stock rows', 'أرصدة سالبة')}</span></div><div><StockPill tone={quarantineLots.length ? 'warn' : 'good'}>{quarantineLots.length}</StockPill><span>{L(locale, 'Quality hold lots', 'تشغيلات حجز جودة')}</span></div><div><StockPill tone={Math.abs(reconciliationDiff) > 1 ? 'bad' : 'good'}>{money(reconciliationDiff, locale)}</StockPill><span>{L(locale, 'Stock vs GL difference', 'فرق المخزون مع الأستاذ')}</span></div></div></Card></div>}
    {tab === 'availability' && <Card title={L(locale, 'Available stock control engine', 'محرك الرصيد المتاح')} icon={<PackageCheck/>}><div className="notice">{L(locale, 'Available = on hand - reserved - quarantine - expired - in-transit out + in-transit in. This is the quantity that operations should be allowed to issue or sell.', 'المتاح = الرصيد الحالي - المحجوز - الحجز/الجودة - المنتهي - تحويلات خارجة + تحويلات واردة. هذه هي الكمية التي يسمح للتشغيل بصرفها أو بيعها.')}</div><Table headers={[L(locale, 'Store', 'المخزن'), L(locale, 'SKU', 'الكود'), L(locale, 'Item', 'الصنف'), L(locale, 'On hand', 'الحالي'), L(locale, 'Reserved', 'محجوز'), L(locale, 'Quarantine', 'حجز جودة'), L(locale, 'Expired', 'منتهي'), L(locale, 'In transit out', 'قيد التحويل خارج'), L(locale, 'In transit in', 'قيد التحويل وارد'), L(locale, 'Available', 'المتاح'), L(locale, 'Status', 'الحالة')]} rows={availableRows(state).map((r) => [L(locale, r.store.nameEn, r.store.nameAr), r.item.sku, L(locale, r.item.nameEn, r.item.nameAr), qty(r.onHand, r.item.purchaseUnit), qty(r.reserved, r.item.purchaseUnit), qty(r.quarantined, r.item.purchaseUnit), qty(r.expired, r.item.purchaseUnit), qty(r.inTransitOut, r.item.purchaseUnit), qty(r.inTransitIn, r.item.purchaseUnit), qty(r.available, r.item.purchaseUnit), r.available < 0 ? <StockPill tone="bad">{L(locale, 'Blocked', 'محجوب')}</StockPill> : r.available <= r.item.reorderPoint ? <StockPill tone="warn">{L(locale, 'Reorder', 'إعادة طلب')}</StockPill> : <StockPill tone="good">OK</StockPill>])}/></Card>}
    {tab === 'balances' && <Card title={L(locale, 'Inventory balances by store', 'أرصدة المخزون حسب المخزن')} icon={<Archive/>}><div className="form-grid"><Field label={L(locale, 'Search item/store', 'بحث صنف/مخزن')}><input value={search} onChange={(e) => setSearch(e.target.value)}/></Field><Field label={L(locale, 'Store filter', 'تصفية المخزن')}><select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}><option value="all">{L(locale, 'All stores', 'كل المخازن')}</option>{state.stores.map((s) => <option key={s.id} value={s.id}>{L(locale, s.nameEn, s.nameAr)}</option>)}</select></Field></div><Table headers={[L(locale, 'Store', 'المخزن'), L(locale, 'Branch', 'الفرع'), L(locale, 'SKU', 'الكود'), L(locale, 'Item', 'الصنف'), L(locale, 'On hand', 'الحالي'), L(locale, 'Reorder / Min / Max', 'طلب / أدنى / أعلى'), L(locale, 'Avg cost', 'متوسط التكلفة'), L(locale, 'Value', 'القيمة'), L(locale, 'Status', 'الحالة')]} rows={visibleRows.map((r) => [L(locale, r.store.nameEn, r.store.nameAr), branchName(state, r.store.branchId, locale), r.item.sku, L(locale, r.item.nameEn, r.item.nameAr), qty(r.balance, r.item.purchaseUnit), `${r.item.reorderPoint} / ${r.item.minStock} / ${r.item.maxStock}`, money(r.cost, locale), money(r.value, locale), r.balance < 0 ? <StockPill tone="bad">{L(locale, 'Negative', 'سالب')}</StockPill> : r.balance > 0 && r.cost <= 0 ? <StockPill tone="warn">{L(locale, 'Needs costing', 'يحتاج تسعير')}</StockPill> : r.balance <= r.item.reorderPoint ? <StockPill tone="warn">{L(locale, 'Low', 'منخفض')}</StockPill> : <StockPill tone="good">{L(locale, 'OK', 'سليم')}</StockPill>])}/></Card>}
    {tab === 'items' && <Card title={L(locale, 'Item cost cards and movement totals', 'بطاقات تكلفة الأصناف وإجمالي الحركات')} icon={<Database/>}><Table headers={[L(locale, 'SKU', 'الكود'), L(locale, 'Item', 'الصنف'), L(locale, 'Category', 'التصنيف'), L(locale, 'Qty on hand', 'الكمية الحالية'), L(locale, 'Total in', 'إجمالي الداخل'), L(locale, 'Total out', 'إجمالي الخارج'), L(locale, 'Average cost', 'متوسط التكلفة'), L(locale, 'Last purchase cost', 'آخر سعر شراء'), L(locale, 'Stock value', 'قيمة المخزون')]} rows={itemCards.map((r) => [r.item.sku, L(locale, r.item.nameEn, r.item.nameAr), r.item.category, qty(r.qtyOnHand, r.item.purchaseUnit), qty(r.totalIn, r.item.purchaseUnit), qty(r.totalOut, r.item.purchaseUnit), money(r.avg, locale), money(r.last, locale), money(r.value, locale)])}/></Card>}
    {tab === 'locations' && <div className="page-grid two"><Card title={L(locale, 'Bin / shelf master', 'تعريف المواقع والأرفف')} icon={<Store/>}><div className="notice">{L(locale, 'Use bin codes on purchase invoice lines and stock moves. Barcode scanning can later write the SKU/lot/bin into these fields.', 'استخدم أكواد المواقع في بنود فواتير الشراء وحركات المخزون. لاحقاً يمكن للباركود تعبئة الصنف/التشغيلة/الموقع.')}</div><div className="form-grid"><Field label={L(locale, 'Store', 'المخزن')}><select value={binDraft.storeId} onChange={(e) => setBinDraft({ ...binDraft, storeId: e.target.value })}><option value="">—</option>{state.stores.map((s) => <option key={s.id} value={s.id}>{L(locale, s.nameEn, s.nameAr)}</option>)}</select></Field><Field label={L(locale, 'Bin code', 'كود الموقع')}><input value={binDraft.code} onChange={(e) => setBinDraft({ ...binDraft, code: e.target.value })}/></Field><Field label={L(locale, 'Zone', 'النطاق')}><input value={binDraft.zone} onChange={(e) => setBinDraft({ ...binDraft, zone: e.target.value })}/></Field><Field label={L(locale, 'Type', 'النوع')}><input value={binDraft.type} onChange={(e) => setBinDraft({ ...binDraft, type: e.target.value })}/></Field></div><button onClick={saveBin}><Save size={16}/>{L(locale, 'Save Bin', 'حفظ الموقع')}</button></Card><Card title={L(locale, 'Location register', 'سجل المواقع')} icon={<ListChecks/>}><Table headers={[L(locale, 'Store', 'المخزن'), L(locale, 'Bin', 'الموقع'), L(locale, 'Zone', 'النطاق'), L(locale, 'Type', 'النوع'), L(locale, 'Actions', 'إجراءات')]} rows={bins.map((b) => [storeName(state, b.storeId, locale), b.code, b.zone, b.type, actionButtons(() => setBinDraft(b), () => update((s) => addAudit({ ...s, binLocations: removeById(s.binLocations, b.id) }, 'delete', 'bin', b.code, 'Bin deleted'), L(locale, 'Bin deleted', 'تم حذف الموقع')), locale)])}/></Card></div>}
    {tab === 'lots' && <Card title={L(locale, 'Lot, batch and expiry register', 'سجل التشغيلات والصلاحية')} icon={<PackageCheck/>}><Table headers={[L(locale, 'Status', 'الحالة'), L(locale, 'Store', 'المخزن'), L(locale, 'Item', 'الصنف'), L(locale, 'Batch No.', 'رقم الدفعة'), L(locale, 'Batch', 'الدفعة'), L(locale, 'Bin', 'الموقع'), L(locale, 'Qty', 'الكمية'), L(locale, 'Unit cost', 'تكلفة الوحدة'), L(locale, 'Expiry', 'الصلاحية'), L(locale, 'Days', 'الأيام'), L(locale, 'Actions', 'إجراءات')]} rows={lots.map((l) => [<StockPill tone={lotTone(l)}>{l.status}</StockPill>, storeName(state, l.storeId, locale), itemName(state, l.itemId, locale), l.lotNo, l.batchNo, l.binCode, qty(l.qty), money(l.unitCost, locale), l.expiryDate || '—', l.expiryDate ? String(daysUntil(l.expiryDate)) : '—', <div className="button-row"><button onClick={() => updateLotStatus(l.id, 'quarantine', 'Lot placed under quality hold')}><LockKeyhole size={14}/>{L(locale, 'Hold', 'حجز')}</button><button onClick={() => updateLotStatus(l.id, 'available', 'Lot released to available stock')}><ShieldCheck size={14}/>{L(locale, 'Release', 'إفراج')}</button><button onClick={() => updateLotStatus(l.id, 'expired', 'Lot marked expired')} className="danger"><X size={14}/>{L(locale, 'Expire', 'انتهاء')}</button></div>])}/></Card>}
    {tab === 'transfers' && <div className="page-grid two"><Card title={L(locale, 'Store-to-store transfer', 'تحويل بين المخازن')} icon={<PackageCheck/>}><div className="form-grid"><Field label={L(locale, 'From store', 'من مخزن')}><select value={transfer.fromStoreId} onChange={(e) => setTransfer({ ...transfer, fromStoreId: e.target.value })}><option value="">—</option>{state.stores.map((s) => <option key={s.id} value={s.id}>{L(locale, s.nameEn, s.nameAr)}</option>)}</select></Field><Field label={L(locale, 'To store', 'إلى مخزن')}><select value={transfer.toStoreId} onChange={(e) => setTransfer({ ...transfer, toStoreId: e.target.value })}><option value="">—</option>{state.stores.map((s) => <option key={s.id} value={s.id}>{L(locale, s.nameEn, s.nameAr)}</option>)}</select></Field><Field label={L(locale, 'Item', 'الصنف')}><select value={transfer.itemId} onChange={(e) => setTransfer({ ...transfer, itemId: e.target.value })}><option value="">—</option>{state.items.map((i) => <option key={i.id} value={i.id}>{i.sku} — {L(locale, i.nameEn, i.nameAr)}</option>)}</select></Field><Field label={L(locale, 'Qty', 'الكمية')}><input type="number" value={transfer.qty} onChange={(e) => setTransfer({ ...transfer, qty: Number(e.target.value) })}/></Field></div><div className={transferReady ? 'notice' : 'notice warning'}>{L(locale, 'Available from source', 'المتاح في المصدر')}: <strong>{qty(selectedTransferBalance)}</strong> · {L(locale, 'Transfer value', 'قيمة التحويل')}: <strong>{money(Number(transfer.qty || 0) * selectedTransferCost, locale)}</strong></div><button disabled={!transferReady} onClick={postTransfer}><Save size={16}/>{L(locale, 'Post Transfer', 'ترحيل التحويل')}</button></Card><Card title={L(locale, 'Transfer register', 'سجل التحويلات')} icon={<ListChecks/>}><Table headers={[L(locale, 'Date', 'التاريخ'), L(locale, 'Ref', 'المرجع'), L(locale, 'From', 'من'), L(locale, 'To', 'إلى'), L(locale, 'Item', 'الصنف'), L(locale, 'Qty', 'الكمية'), L(locale, 'Status', 'الحالة')]} rows={state.transfers.slice().reverse().map((t) => [t.date, t.ref, storeName(state, t.fromStoreId, locale), storeName(state, t.toStoreId, locale), itemName(state, t.itemId, locale), qty(t.qty), t.posted ? <StockPill tone="good">{L(locale, 'Posted', 'مرحل')}</StockPill> : <StockPill>{L(locale, 'Draft', 'مسودة')}</StockPill>])}/></Card></div>}
    {tab === 'adjustments' && <div className="page-grid two"><Card title={L(locale, 'Adjustment request', 'طلب تسوية مخزون')} icon={<Edit3/>}><div className="notice warning">{L(locale, 'This no longer posts immediately. It creates a pending approval; posting happens from the approval queue.', 'لم تعد ترحل فوراً. يتم إنشاء طلب موافقة، والترحيل يتم من طابور الموافقات.')}</div><div className="form-grid"><Field label={L(locale, 'Store', 'المخزن')}><select value={adjustment.storeId} onChange={(e) => setAdjustment({ ...adjustment, storeId: e.target.value })}><option value="">—</option>{state.stores.map((s) => <option key={s.id} value={s.id}>{L(locale, s.nameEn, s.nameAr)}</option>)}</select></Field><Field label={L(locale, 'Item', 'الصنف')}><select value={adjustment.itemId} onChange={(e) => setAdjustment({ ...adjustment, itemId: e.target.value })}><option value="">—</option>{state.items.map((i) => <option key={i.id} value={i.id}>{i.sku} — {L(locale, i.nameEn, i.nameAr)}</option>)}</select></Field><Field label={L(locale, 'Direction', 'الاتجاه')}><select value={adjustment.direction} onChange={(e) => setAdjustment({ ...adjustment, direction: e.target.value as Direction })}><option value="out">{L(locale, 'Out / expense', 'خارج / مصروف')}</option><option value="in">{L(locale, 'In / correction gain', 'داخل / تصحيح زيادة')}</option></select></Field><Field label={L(locale, 'Qty', 'الكمية')}><input type="number" value={adjustment.qty} onChange={(e) => setAdjustment({ ...adjustment, qty: Number(e.target.value) })}/></Field><Field label={L(locale, 'Reason', 'السبب')}><input value={adjustment.reason} onChange={(e) => setAdjustment({ ...adjustment, reason: e.target.value })}/></Field><Field label={L(locale, 'Cost center', 'مركز التكلفة')}><select value={adjustment.costCenterId} onChange={(e) => setAdjustment({ ...adjustment, costCenterId: e.target.value })}><option value="company">{L(locale, 'Company / no cost center', 'الشركة / بدون مركز تكلفة')}</option>{state.costCenters.map((cc) => <option key={cc.id} value={cc.id}>{L(locale, cc.nameEn, cc.nameAr)}</option>)}</select></Field><Field label={L(locale, 'Note', 'ملاحظة')}><input value={adjustment.note} onChange={(e) => setAdjustment({ ...adjustment, note: e.target.value })}/></Field></div><button onClick={requestAdjustment}><Save size={16}/>{L(locale, 'Submit for Approval', 'إرسال للموافقة')}</button></Card><Card title={L(locale, 'Cycle count variance request', 'طلب فرق جرد دوري')} icon={<ClipboardCheck/>}><div className="form-grid"><Field label={L(locale, 'Store', 'المخزن')}><select value={count.storeId} onChange={(e) => setCount({ ...count, storeId: e.target.value })}><option value="">—</option>{state.stores.map((s) => <option key={s.id} value={s.id}>{L(locale, s.nameEn, s.nameAr)}</option>)}</select></Field><Field label={L(locale, 'Item', 'الصنف')}><select value={count.itemId} onChange={(e) => setCount({ ...count, itemId: e.target.value })}><option value="">—</option>{state.items.map((i) => <option key={i.id} value={i.id}>{i.sku} — {L(locale, i.nameEn, i.nameAr)}</option>)}</select></Field><Field label={L(locale, 'Counted quantity', 'الكمية بالجرد')}><input type="number" value={count.countedQty} onChange={(e) => setCount({ ...count, countedQty: Number(e.target.value) })}/></Field><Field label={L(locale, 'Cost center', 'مركز التكلفة')}><select value={count.costCenterId} onChange={(e) => setCount({ ...count, costCenterId: e.target.value })}><option value="company">{L(locale, 'Company / no cost center', 'الشركة / بدون مركز تكلفة')}</option>{state.costCenters.map((cc) => <option key={cc.id} value={cc.id}>{L(locale, cc.nameEn, cc.nameAr)}</option>)}</select></Field></div><div className="notice">{L(locale, 'System quantity', 'كمية النظام')}: <strong>{qty(getBalance(state, count.storeId, count.itemId))}</strong> · {L(locale, 'Variance', 'الفرق')}: <strong>{qty(Number(count.countedQty || 0) - getBalance(state, count.storeId, count.itemId))}</strong></div><button onClick={requestCountVariance}><Save size={16}/>{L(locale, 'Submit Count Variance', 'إرسال فرق الجرد')}</button></Card></div>}
    {tab === 'approvals' && <Card title={L(locale, 'Inventory approval queue', 'طابور موافقات المخزون')} icon={<ShieldCheck/>}><Table headers={[L(locale, 'Status', 'الحالة'), L(locale, 'Ref', 'المرجع'), L(locale, 'Type', 'النوع'), L(locale, 'Store', 'المخزن'), L(locale, 'Item', 'الصنف'), L(locale, 'Direction', 'الاتجاه'), L(locale, 'Qty', 'الكمية'), L(locale, 'Value', 'القيمة'), L(locale, 'Cost center', 'مركز التكلفة'), L(locale, 'Actions', 'إجراءات')]} rows={(state.inventoryApprovals ?? []).slice().reverse().map((a) => [<StockPill tone={a.status === 'posted' ? 'good' : a.status === 'rejected' ? 'bad' : 'warn'}>{a.status}</StockPill>, a.ref, a.requestType, storeName(state, a.storeId, locale), itemName(state, a.itemId, locale), a.direction, qty(a.qty), money(a.qty * a.unitCost, locale), costCenterName(state, a.costCenterId, locale), a.status === 'pending' ? <div className="button-row"><button onClick={() => postApproval(a)}><ShieldCheck size={14}/>{L(locale, 'Approve & Post', 'اعتماد وترحيل')}</button><button className="danger" onClick={() => rejectApproval(a.id)}><X size={14}/>{L(locale, 'Reject', 'رفض')}</button></div> : a.postedRef || '—'])}/></Card>}
    {tab === 'quarantine' && <Card title={L(locale, 'Damaged goods quarantine / quality hold', 'حجز البضائع التالفة / فحص الجودة')} icon={<LockKeyhole/>}><Table headers={[L(locale, 'Store', 'المخزن'), L(locale, 'Item', 'الصنف'), L(locale, 'Batch No.', 'رقم الدفعة'), L(locale, 'Bin', 'الموقع'), L(locale, 'Qty', 'الكمية'), L(locale, 'Expiry', 'الصلاحية'), L(locale, 'Note', 'ملاحظة'), L(locale, 'Actions', 'إجراءات')]} rows={quarantineLots.map((l) => [storeName(state, l.storeId, locale), itemName(state, l.itemId, locale), l.lotNo, l.binCode, qty(l.qty), l.expiryDate || '—', l.note || '—', <div className="button-row"><button onClick={() => updateLotStatus(l.id, 'available', 'Quality released lot')}><ShieldCheck size={14}/>{L(locale, 'Release', 'إفراج')}</button><button className="danger" onClick={() => updateLotStatus(l.id, 'returned', 'Lot prepared for supplier return')}><RefreshCw size={14}/>{L(locale, 'Return', 'مرتجع')}</button></div>])}/></Card>}
    {tab === 'returns' && <div className="page-grid two"><Card title={L(locale, 'Supplier return / debit note', 'مرتجع مورد / إشعار دائن')} icon={<RefreshCw/>}><div className="form-grid"><Field label={L(locale, 'Supplier', 'المورد')}><select value={returnDoc.supplierId} onChange={(e) => setReturnDoc({ ...returnDoc, supplierId: e.target.value })}><option value="">—</option>{state.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Field label={L(locale, 'Store', 'المخزن')}><select value={returnDoc.storeId} onChange={(e) => setReturnDoc({ ...returnDoc, storeId: e.target.value })}><option value="">—</option>{state.stores.map((s) => <option key={s.id} value={s.id}>{L(locale, s.nameEn, s.nameAr)}</option>)}</select></Field><Field label={L(locale, 'Item', 'الصنف')}><select value={returnDoc.itemId} onChange={(e) => setReturnDoc({ ...returnDoc, itemId: e.target.value })}><option value="">—</option>{state.items.map((i) => <option key={i.id} value={i.id}>{i.sku} — {L(locale, i.nameEn, i.nameAr)}</option>)}</select></Field><Field label={L(locale, 'Qty', 'الكمية')}><input type="number" value={returnDoc.qty} onChange={(e) => setReturnDoc({ ...returnDoc, qty: Number(e.target.value) })}/></Field><Field label={L(locale, 'Credit type', 'نوع المعالجة')}><select value={returnDoc.creditType} onChange={(e) => setReturnDoc({ ...returnDoc, creditType: e.target.value as SupplierReturnDoc['creditType'] })}><option value="ap_credit">AP credit / debit note</option><option value="cash_refund">Cash refund</option><option value="replacement">Replacement pending</option></select></Field><Field label={L(locale, 'Reason', 'السبب')}><input value={returnDoc.reason} onChange={(e) => setReturnDoc({ ...returnDoc, reason: e.target.value })}/></Field></div><button onClick={postSupplierReturn}><Save size={16}/>{L(locale, 'Post Supplier Return', 'ترحيل مرتجع المورد')}</button></Card><Card title={L(locale, 'Supplier return register', 'سجل مرتجعات الموردين')} icon={<FileText/>}><Table headers={[L(locale, 'Date', 'التاريخ'), L(locale, 'Ref', 'المرجع'), L(locale, 'Supplier', 'المورد'), L(locale, 'Store', 'المخزن'), L(locale, 'Item', 'الصنف'), L(locale, 'Qty', 'الكمية'), L(locale, 'Value', 'القيمة'), L(locale, 'Reason', 'السبب')]} rows={(state.supplierReturns ?? []).slice().reverse().map((r) => [r.date, r.ref, supplierName(state, r.supplierId), storeName(state, r.storeId, locale), itemName(state, r.itemId, locale), qty(r.qty), money(r.qty * r.unitCost, locale), r.reason])}/></Card></div>}
    {tab === 'openingStock' && <div className="page-grid"><Card title={L(locale, 'Opening inventory upload', 'رفع الرصيد الافتتاحي للمخزون')} icon={<Upload/>} action={<div className="button-row"><button onClick={downloadOpeningTemplate}><Download size={16}/>{L(locale, 'Template', 'قالب')}</button><label className="upload-button"><Upload size={16}/>{L(locale, 'Upload CSV', 'رفع CSV')}<input type="file" accept=".csv" hidden onChange={(e) => e.target.files?.[0] && loadOpeningStockCsv(e.target.files[0])}/></label></div>}><div className="notice">{L(locale, 'Use this once when converting from an old system. It creates opening stock movements, lot/bin records when provided, and a balanced opening inventory journal when unit cost is positive.', 'يستخدم مرة واحدة عند التحويل من نظام قديم. ينشئ حركات رصيد افتتاحي وتشغيلات/مواقع عند توفرها وقيد افتتاحي متوازن عند وجود تكلفة.')}</div><label className="checkline"><input type="checkbox" checked={autoCreateOpeningItems} onChange={(e) => setAutoCreateOpeningItems(e.target.checked)}/>{L(locale, 'Auto-create missing item SKUs as zero-cost item masters during opening stock import', 'إنشاء أكواد الأصناف غير الموجودة تلقائياً كأصناف بدون تكلفة أثناء رفع الرصيد الافتتاحي')}</label><div className="kpi-grid"><KPI label={L(locale, 'File', 'الملف')} value={openingFileName || '—'} hint={L(locale, 'Opening stock CSV', 'ملف الرصيد الافتتاحي')} icon={<FileSpreadsheet/>}/><KPI label={L(locale, 'Rows', 'الصفوف')} value={`${openingRows.length}`} hint={L(locale, 'Preview rows', 'صفوف المعاينة')} icon={<ListChecks/>}/><KPI label={L(locale, 'Valid rows', 'صفوف صحيحة')} value={`${openingValidRows.length}`} hint={L(locale, 'Ready to post', 'جاهزة للترحيل')} icon={<ShieldCheck/>}/><KPI label={L(locale, 'Opening value', 'قيمة الافتتاح')} value={money(openingValue, locale)} hint={L(locale, 'Qty × unit cost', 'الكمية × التكلفة')} icon={<Calculator/>}/></div><Table headers={[L(locale, 'Row', 'الصف'), L(locale, 'Store', 'المخزن'), L(locale, 'SKU', 'الكود'), L(locale, 'Qty', 'الكمية'), L(locale, 'Unit Cost', 'تكلفة الوحدة'), L(locale, 'Value', 'القيمة'), L(locale, 'Lot/Bin/Expiry', 'التشغيلة/الموقع/الصلاحية'), L(locale, 'Status', 'الحالة')]} rows={openingRows.map((r) => [r.rowNo, r.storeCode, r.itemSku, qty(r.qty), money(r.unitCost, locale), money(r.qty * r.unitCost, locale), `${r.lotNo || '—'} / ${r.binCode || '—'} / ${r.expiryDate || '—'}`, r.errors.length ? <StockPill tone="bad">{r.errors.join('; ')}</StockPill> : <StockPill tone="good">Ready</StockPill>])}/><button disabled={!openingValidRows.length || openingRows.some((r) => r.errors.length)} onClick={postOpeningStock}><Save size={16}/>{L(locale, 'Post opening stock', 'ترحيل الرصيد الافتتاحي')}</button></Card></div>}
    {tab === 'stockCount' && <div className="page-grid"><Card title={L(locale, 'Monthly stock count upload', 'رفع الجرد الشهري')} icon={<ClipboardCheck/>} action={<div className="button-row"><button onClick={downloadStockCountTemplate}><Download size={16}/>{L(locale, 'Blank template', 'قالب فارغ')}</button><button onClick={downloadStoreCountSheet}><Download size={16}/>{L(locale, 'Generate count sheet', 'إنشاء نموذج جرد')}</button><label className="upload-button"><Upload size={16}/>{L(locale, 'Upload count CSV', 'رفع ملف الجرد')}<input type="file" accept=".csv" hidden onChange={(e) => e.target.files?.[0] && loadStockCountCsv(e.target.files[0])}/></label></div>}><div className="notice">{L(locale, 'Upload physical count by store and item every month. The system compares counted quantity to system quantity and creates shortage/surplus variance approvals before posting to inventory and GL.', 'ارفع الجرد الفعلي حسب المخزن والصنف شهرياً. يقارن النظام الكمية المعدودة بالكمية النظامية وينشئ فروقات عجز/زيادة للموافقة قبل ترحيل المخزون والأستاذ.')}</div><label className="checkline"><input type="checkbox" checked={autoCreateCountItems} onChange={(e) => setAutoCreateCountItems(e.target.checked)}/>{L(locale, 'Allow new item SKUs found in stock count to be created as zero-cost surplus items', 'السماح بإنشاء أكواد الأصناف الجديدة في الجرد كأصناف زيادة بدون تكلفة')}</label><div className="form-grid"><Field label={L(locale, 'Stock count reference', 'مرجع الجرد')}><input value={stockCountRef} onChange={(e) => setStockCountRef(e.target.value)}/></Field><Field label={L(locale, 'Count sheet store', 'مخزن نموذج الجرد')}><select value={countSheetStoreId} onChange={(e) => setCountSheetStoreId(e.target.value)}><option value="all">{L(locale, 'All stores with stock', 'كل المخازن ذات الرصيد')}</option>{state.stores.map((store) => <option key={store.id} value={store.id}>{store.code} — {L(locale, store.nameEn, store.nameAr)}</option>)}</select></Field><Field label={L(locale, 'File', 'الملف')}><input value={countFileName || '—'} readOnly/></Field></div><div className="kpi-grid"><KPI label={L(locale, 'Rows', 'الصفوف')} value={`${countRows.length}`} hint={L(locale, 'Count lines', 'بنود الجرد')} icon={<ListChecks/>}/><KPI label={L(locale, 'Surplus lines', 'بنود زيادة')} value={`${countSurplus.length}`} hint={L(locale, 'Counted > system', 'المعدود أكبر من النظام')} icon={<Plus/>}/><KPI label={L(locale, 'Shortage lines', 'بنود عجز')} value={`${countShortage.length}`} hint={L(locale, 'Counted < system', 'المعدود أقل من النظام')} icon={<Trash2/>}/><KPI label={L(locale, 'Variance value', 'قيمة الفرق')} value={money(countValidRows.reduce((sum, r) => sum + Math.abs(r.variance) * (itemBySkuLocal(state, r.itemSku) ? getAveragePurchaseCost(state, itemBySkuLocal(state, r.itemSku)!.id) : 0), 0), locale)} hint={L(locale, 'At average cost', 'بمتوسط التكلفة')} icon={<Calculator/>}/></div><Table headers={[L(locale, 'Row', 'الصف'), L(locale, 'Store', 'المخزن'), L(locale, 'SKU', 'الكود'), L(locale, 'System Qty', 'كمية النظام'), L(locale, 'Counted Qty', 'كمية الجرد'), L(locale, 'Variance', 'الفرق'), L(locale, 'Cost Center', 'مركز التكلفة'), L(locale, 'Status', 'الحالة')]} rows={countRows.map((r) => [r.rowNo, r.storeCode, r.itemSku, qty(r.systemQty), qty(r.countedQty), r.variance > 0 ? <StockPill tone="good">+{qty(r.variance)}</StockPill> : r.variance < 0 ? <StockPill tone="bad">-{qty(Math.abs(r.variance))}</StockPill> : <StockPill tone="info">0</StockPill>, r.costCenterCode, r.errors.length ? <StockPill tone="bad">{r.errors.join('; ')}</StockPill> : <StockPill tone="good">Ready</StockPill>])}/><button disabled={!countValidRows.length || countRows.some((r) => r.errors.length) || countValidRows.every((r) => Math.abs(r.variance) < 0.0001)} onClick={createStockCountBatch}><Save size={16}/>{L(locale, 'Create variance approval batch', 'إنشاء دفعة فروقات للموافقة')}</button></Card><Card title={L(locale, 'Monthly stock count control policy', 'سياسة رقابة الجرد الشهري')} icon={<ShieldCheck/>}><Table headers={[L(locale, 'Control', 'الرقابة'), L(locale, 'Policy', 'السياسة')]} rows={[[L(locale, 'No direct posting', 'لا ترحيل مباشر'), L(locale, 'Uploaded count creates approval requests first.', 'رفع الجرد ينشئ طلبات موافقة أولاً.')], [L(locale, 'Shortage', 'عجز'), L(locale, 'After approval: Dr Inventory Variance / Cr Inventory.', 'بعد الاعتماد: مدين فرق جرد / دائن مخزون.')], [L(locale, 'Surplus', 'زيادة'), L(locale, 'After approval: Dr Inventory / Cr Inventory Variance.', 'بعد الاعتماد: مدين مخزون / دائن فرق جرد.')], [L(locale, 'Monthly control', 'رقابة شهرية'), L(locale, 'Export count template by store, upload counted quantity, approve variances, then close period.', 'صدّر قالب الجرد حسب المخزن، ارفع الكمية المعدودة، اعتمد الفروقات ثم أقفل الفترة.')]]}/></Card></div>}
    {tab === 'reconciliation' && <div className="page-grid"><Card title={L(locale, 'Inventory to GL reconciliation', 'مطابقة المخزون مع الأستاذ العام')} icon={<Calculator/>}><Table headers={[L(locale, 'Control', 'الرقابة'), L(locale, 'Value', 'القيمة'), L(locale, 'Status', 'الحالة'), L(locale, 'Action', 'الإجراء')]} rows={[[L(locale, 'Stock subledger value', 'قيمة دفتر المخزون الفرعي'), money(inventoryValue, locale), <StockPill tone="info">Subledger</StockPill>, L(locale, 'Calculated from stock movements × average cost', 'محسوبة من الحركات × متوسط التكلفة')], [L(locale, 'General ledger inventory', 'مخزون الأستاذ العام'), money(glInventory, locale), <StockPill tone="info">GL</StockPill>, L(locale, 'Raw + semi-finished inventory accounts', 'حسابات الخام ونصف المصنع')], [L(locale, 'Difference', 'الفرق'), money(reconciliationDiff, locale), Math.abs(reconciliationDiff) > 1 ? <StockPill tone="bad">{L(locale, 'Investigate', 'راجع')}</StockPill> : <StockPill tone="good">{L(locale, 'Matched', 'مطابق')}</StockPill>, L(locale, 'Check manual journals, adjustments, and unposted documents', 'راجع القيود اليدوية والتسويات والمستندات غير المرحلة')], [L(locale, 'Zero-cost quantity rows', 'أرصدة بكمية وتكلفة صفر'), `${zeroCostWithQty.length}`, zeroCostWithQty.length ? <StockPill tone="warn">{L(locale, 'Needs costing', 'يحتاج تسعير')}</StockPill> : <StockPill tone="good">OK</StockPill>, L(locale, 'Post purchase invoices with prices', 'رحّل فواتير شراء بأسعار')], [L(locale, 'Negative stock rows', 'أرصدة سالبة'), `${negativeStock.length}`, negativeStock.length ? <StockPill tone="bad">{L(locale, 'Blocked control', 'خلل رقابي')}</StockPill> : <StockPill tone="good">OK</StockPill>, L(locale, 'Review sales/production/transfer source store', 'راجع مصدر المبيعات/الإنتاج/التحويلات')]]}/></Card></div>}
    {tab === 'ledger' && <Card title={L(locale, 'Stock movement audit ledger', 'دفتر تدقيق حركة المخزون')} icon={<ListChecks/>} action={<button onClick={exportLedger}><Download size={16}/>{L(locale, 'Export ledger', 'تصدير الدفتر')}</button>}><Table headers={[L(locale, 'Date', 'التاريخ'), L(locale, 'Ref', 'المرجع'), L(locale, 'Type', 'النوع'), L(locale, 'Store', 'المخزن'), L(locale, 'Item', 'الصنف'), L(locale, 'In', 'داخل'), L(locale, 'Out', 'خارج'), L(locale, 'Batch No.', 'رقم الدفعة'), L(locale, 'Bin', 'الموقع'), L(locale, 'Unit Cost', 'تكلفة الوحدة'), L(locale, 'Value', 'القيمة'), L(locale, 'Note', 'ملاحظة')]} rows={state.stockMovements.slice().reverse().map((m) => [m.date, m.ref, m.type, storeName(state, m.storeId, locale), itemName(state, m.itemId, locale), m.direction === 'in' ? qty(m.qty) : '—', m.direction === 'out' ? qty(m.qty) : '—', m.lotNo || '—', m.binCode || '—', money(m.unitCost, locale), money(m.qty * m.unitCost, locale), m.note])}/></Card>}
  </div>;
}


type PurchaseDocumentOption = { key: string; label: string; kind: string; ref: string; html: string; meta: Array<[string, string]> };
function safeHtml(text: string) { return String(text ?? '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch] ?? ch)); }
function purchaseDocumentHtml(title: string, rows: Array<[string, string]>, tableRows: Array<Record<string, string | number>>, locale: Locale) {
  const header = rows.map(([k, v]) => `<div class="meta"><strong>${safeHtml(k)}</strong><span>${safeHtml(v)}</span></div>`).join('');
  const keys = tableRows.length ? Object.keys(tableRows[0]) : [];
  const table = keys.length ? `<table><thead><tr>${keys.map((k) => `<th>${safeHtml(k)}</th>`).join('')}</tr></thead><tbody>${tableRows.map((row) => `<tr>${keys.map((k) => `<td>${safeHtml(String(row[k] ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';
  return `<!doctype html><html dir="${locale === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${safeHtml(title)}</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#111827}.head{display:flex;justify-content:space-between;border-bottom:2px solid #111827;padding-bottom:14px;margin-bottom:18px}.brand{font-size:22px;font-weight:800}.doc{font-size:18px;font-weight:700}.meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0}.meta{border:1px solid #d1d5db;padding:10px;border-radius:10px}.meta strong{display:block;color:#374151;font-size:12px}.meta span{font-size:14px}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #d1d5db;padding:9px;text-align:start}th{background:#f3f4f6}.sign{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:44px}.sig{border-top:1px solid #111827;padding-top:8px}.foot{margin-top:30px;font-size:12px;color:#6b7280}</style></head><body><div class="head"><div class="brand">Restaurant ERP</div><div class="doc">${safeHtml(title)}</div></div><div class="meta-grid">${header}</div>${table}<div class="sign"><div class="sig">Prepared by</div><div class="sig">Reviewed by</div><div class="sig">Approved by</div></div><div class="foot">Generated from local trial mode. Production version will store immutable PDF/attachments in Supabase storage.</div></body></html>`;
}
function purchaseDocumentOptions(state: ERPState, locale: Locale): PurchaseDocumentOption[] {
  const poDocs = state.purchaseOrders.map((po) => {
    const rows: Array<[string, string]> = [[L(locale, 'Document', 'المستند'), L(locale, 'Purchase Order', 'أمر شراء')], [L(locale, 'Reference', 'المرجع'), po.ref], [L(locale, 'Supplier', 'المورد'), supplierName(state, po.supplierId)], [L(locale, 'Status', 'الحالة'), po.status], [L(locale, 'ETA', 'التسليم المتوقع'), po.eta]];
    const table = po.lines.map((l) => ({ SKU: state.items.find((i) => i.id === l.itemId)?.sku ?? '', Item: itemName(state, l.itemId, locale), Qty: l.qty, UnitCost: l.unitCost, Net: l.qty * l.unitCost, Received: l.receivedQty, Backorder: Math.max(0, l.qty - l.receivedQty) }));
    return { key: `po:${po.id}`, label: `${L(locale, 'PO', 'أمر شراء')} ${po.ref}`, kind: 'PO', ref: po.ref, meta: rows, html: purchaseDocumentHtml(`${L(locale, 'Purchase Order', 'أمر شراء')} ${po.ref}`, rows, table, locale) };
  });
  const grnDocs = state.goodsReceipts.map((g) => {
    const po = state.purchaseOrders.find((o) => o.id === g.poId);
    const rows: Array<[string, string]> = [[L(locale, 'Document', 'المستند'), L(locale, 'Goods Receipt Note', 'إشعار استلام')], [L(locale, 'Reference', 'المرجع'), g.ref], [L(locale, 'PO', 'أمر الشراء'), po?.ref ?? '—'], [L(locale, 'Supplier', 'المورد'), supplierName(state, g.supplierId)], [L(locale, 'Status', 'الحالة'), g.status]];
    const table = g.lines.map((l) => ({ SKU: state.items.find((i) => i.id === l.itemId)?.sku ?? '', Item: itemName(state, l.itemId, locale), Qty: l.qty, UnitCost: l.unitCost, Lot: l.lotNo, Bin: l.binCode, Expiry: l.expiryDate }));
    return { key: `grn:${g.id}`, label: `${L(locale, 'GRN', 'استلام')} ${g.ref}`, kind: 'GRN', ref: g.ref, meta: rows, html: purchaseDocumentHtml(`${L(locale, 'Goods Receipt Note', 'إشعار استلام')} ${g.ref}`, rows, table, locale) };
  });
  const invDocs = state.purchaseInvoices.map((inv) => {
    const t = invoiceTotals(inv);
    const rows: Array<[string, string]> = [[L(locale, 'Document', 'المستند'), L(locale, 'Supplier Invoice Match', 'مطابقة فاتورة مورد')], [L(locale, 'Reference', 'المرجع'), inv.ref], [L(locale, 'Invoice No.', 'رقم الفاتورة'), inv.invoiceNo], [L(locale, 'Supplier', 'المورد'), supplierName(state, inv.supplierId)], [L(locale, 'Total', 'الإجمالي'), money(t.total, locale)]];
    const table = inv.lines.map((l) => ({ SKU: state.items.find((i) => i.id === l.itemId)?.sku ?? '', Item: itemName(state, l.itemId, locale), Qty: l.qty, UnitCost: l.unitCost, VAT: l.vatRate, Net: invoiceLineTotals(l).net, Total: invoiceLineTotals(l).total }));
    return { key: `inv:${inv.id}`, label: `${L(locale, 'Invoice', 'فاتورة')} ${inv.ref}`, kind: 'Invoice', ref: inv.ref, meta: rows, html: purchaseDocumentHtml(`${L(locale, 'Supplier Invoice Match', 'مطابقة فاتورة مورد')} ${inv.ref}`, rows, table, locale) };
  });
  const payDocs = state.supplierPayments.map((p) => {
    const rows: Array<[string, string]> = [[L(locale, 'Document', 'المستند'), L(locale, 'Payment Voucher', 'سند صرف')], [L(locale, 'Reference', 'المرجع'), p.ref], [L(locale, 'Supplier', 'المورد'), supplierName(state, p.supplierId)], [L(locale, 'Invoice', 'الفاتورة'), p.invoiceRef ?? '—'], [L(locale, 'Amount', 'المبلغ'), money(p.amount, locale)], [L(locale, 'Method', 'الطريقة'), p.method]];
    return { key: `pay:${p.id}`, label: `${L(locale, 'Payment', 'سداد')} ${p.ref}`, kind: 'Payment', ref: p.ref, meta: rows, html: purchaseDocumentHtml(`${L(locale, 'Payment Voucher', 'سند صرف')} ${p.ref}`, rows, [{ Account: p.accountCode, Amount: p.amount, Method: p.method, Invoice: p.invoiceRef ?? '' }], locale) };
  });
  return [...poDocs, ...grnDocs, ...invDocs, ...payDocs];
}
function purchaseLifecycleTimeline(status: string, locale: Locale) {
  const steps = ['draft', 'submitted', 'approved', 'posted', 'closed'];
  const statusIndex = Math.max(0, steps.indexOf(status));
  return <div className="steps compact-steps">{steps.map((step, index) => <div className={`step ${index <= statusIndex ? 'done' : ''}`} key={step}><strong>{index + 1}</strong>{L(locale, step, step)}</div>)}</div>;
}
function supplierStatementRows(state: ERPState, supplierId: string) {
  const invoices = state.purchaseInvoices.filter((i) => !supplierId || i.supplierId === supplierId).map((i) => ({ date: i.invoiceDate, ref: i.ref, supplierId: i.supplierId, description: `Invoice ${i.invoiceNo}`, debit: 0, credit: invoiceTotals(i).total }));
  const payments = state.supplierPayments.filter((p) => p.status === 'posted' && (!supplierId || p.supplierId === supplierId)).map((p) => ({ date: p.date, ref: p.ref, supplierId: p.supplierId, description: `Payment ${p.invoiceRef ?? ''}`, debit: p.amount, credit: 0 }));
  let balance = 0;
  return [...invoices, ...payments].sort((a,b)=>a.date.localeCompare(b.date)).map((r) => { balance += r.credit - r.debit; return { ...r, balance }; });
}

function PurchasingPage({ state, update, locale }: { state: ERPState; update: (fn: (s: ERPState) => ERPState, success?: string) => void; locale: Locale }) {
  const [tab, setTab] = useState<PurchasingTab>('control');
  const blankRequest: MaterialRequest = { id: '', ref: '', date: today(), branchId: '', storeId: '', requestedBy: 'Local Admin', neededBy: today(), status: 'draft', lines: [], note: '' };
  const blankPo: PurchaseOrder = { id: '', ref: '', date: today(), supplierId: '', branchId: '', storeId: '', requestRef: '', eta: today(), status: 'draft', lines: [], note: '' };
  const blankGrn: GoodsReceipt = { id: '', ref: '', date: today(), poId: '', supplierId: '', storeId: '', status: 'draft', lines: [] };
  const [request, setRequest] = useState<MaterialRequest>(blankRequest);
  const [requestLine, setRequestLine] = useState<MaterialRequestLine>({ id: '', itemId: '', qty: 1, note: '' });
  const [po, setPo] = useState<PurchaseOrder>(blankPo);
  const [poLine, setPoLine] = useState<PurchaseOrderLine>({ id: '', itemId: '', qty: 1, unitCost: 0, vatRate: 15, receivedQty: 0, invoicedQty: 0 });
  const [grn, setGrn] = useState<GoodsReceipt>(blankGrn);
  const [invoiceFromPoId, setInvoiceFromPoId] = useState('');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [payment, setPayment] = useState<SupplierPayment>({ id: '', ref: '', date: today(), supplierId: '', amount: 0, method: 'bank', accountCode: '1020', status: 'draft', note: '' });
  const [documentKey, setDocumentKey] = useState('');
  const paymentOpenInvoices = supplierOpenInvoices(state, payment.supplierId);
  const purchaseDocs = purchaseDocumentOptions(state, locale);
  const selectedPurchaseDoc = purchaseDocs.find((d) => d.key === documentKey) ?? purchaseDocs[0];
  const selectedPaymentInvoice = state.purchaseInvoices.find((inv) => inv.ref === payment.invoiceRef);
  const selectedInvoiceBalance = selectedPaymentInvoice ? supplierInvoiceBalance(state, selectedPaymentInvoice) : 0;
  const openRequests = state.materialRequests.filter((r) => ['submitted','approved'].includes(r.status));
  const openOrders = state.purchaseOrders.filter((o) => !['closed','cancelled'].includes(o.status));
  const postedGrns = state.goodsReceipts.filter((g) => g.status === 'posted');
  const poForGrn = state.purchaseOrders.find((o) => o.id === grn.poId);
  const invoicePo = state.purchaseOrders.find((o) => o.id === invoiceFromPoId);
  const invoiceTotalsFromPo = invoicePo ? invoiceTotals({ id: '', ref: '', invoiceNo: supplierInvoiceNo, supplierId: invoicePo.supplierId, branchId: invoicePo.branchId, storeId: invoicePo.storeId, invoiceDate: today(), deliveryDate: today(), paymentType: 'credit', paidAmount: 0, status: 'draft', lines: invoicePo.lines.map((l) => ({ id: l.id, itemId: l.itemId, qty: l.receivedQty || l.qty, unitCost: l.unitCost, vatRate: l.vatRate, discount: 0 })) }) : { net: 0, vat: 0, total: 0 };
  const apBalance = supplierAgingRows(state).reduce((sum, row) => sum + row.balance, 0);
  const grniBalance = accountTotal(state, '2110');
  const addRequestLine = () => requestLine.itemId && requestLine.qty > 0 && setRequest({ ...request, lines: [...request.lines, { ...requestLine, id: id('MRL') }] });
  const submitRequest = () => { if (!request.branchId || !request.storeId || request.lines.length === 0) return; update((s) => { const ref = request.ref || `MR-${String(s.materialRequests.length + 1).padStart(5, '0')}`; const doc: MaterialRequest = { ...request, id: request.id || id('MR'), ref, status: 'submitted' }; return addAudit({ ...s, materialRequests: upsert(s.materialRequests, doc) }, 'submit', 'material_request', ref, 'Material request submitted for approval'); }, L(locale, 'Material request submitted', 'تم إرسال طلب المواد')); setRequest(blankRequest); };
  const approveRequest = (doc: MaterialRequest) => { if (!canPerform(state, 'purchasing.po.approve', { branchId: doc.branchId, storeId: doc.storeId })) return; update((s) => addAudit({ ...s, materialRequests: s.materialRequests.map((r) => r.id === doc.id ? { ...r, status: 'approved' } : r) }, 'approve', 'material_request', doc.ref, 'Material request approved'), L(locale, 'Request approved', 'تم اعتماد الطلب')); };
  const rejectRequest = (doc: MaterialRequest) => { if (['converted','closed'].includes(doc.status)) return; update((s) => addAudit({ ...s, materialRequests: s.materialRequests.map((r) => r.id === doc.id ? { ...r, status: 'rejected', note: `${r.note ? `${r.note} · ` : ''}Rejected by manager` } : r) }, 'reject', 'material_request', doc.ref, 'Material request rejected'), L(locale, 'Request refused', 'تم رفض الطلب')); };
  const deleteRequest = (doc: MaterialRequest) => { if (doc.status === 'converted') return; if (typeof window !== 'undefined' && !window.confirm(L(locale, `Delete ${doc.ref}?`, `حذف ${doc.ref}؟`))) return; update((s) => addAudit({ ...s, materialRequests: s.materialRequests.filter((r) => r.id !== doc.id) }, 'delete', 'material_request', doc.ref, 'Material request deleted'), L(locale, 'Request deleted', 'تم حذف الطلب')); };
  const requestCoverage = (doc: MaterialRequest, sourceState: ERPState = state) => {
    const rows = doc.lines.map((line) => {
      const reservedForRequest = requestReservedQty(sourceState, doc.id, line.id);
      const issuedForRequest = requestIssuedQty(sourceState, doc.id, line.id);
      const freeInRequestStore = getFreeStock(sourceState, doc.storeId, line.itemId, doc.id);
      const freeInOtherStores = sourceState.stores
        .filter((store) => store.id !== doc.storeId)
        .reduce((sum, store) => sum + getFreeStock(sourceState, store.id, line.itemId, doc.id), 0);
      const totalFree = freeInRequestStore + freeInOtherStores;
      const covered = reservedForRequest + issuedForRequest + totalFree;
      const shortage = Math.max(0, line.qty - covered);
      return { line, freeInRequestStore, freeInOtherStores, totalFree, reservedForRequest, issuedForRequest, covered, shortage };
    });
    const shortage = rows.reduce((sum, row) => sum + row.shortage, 0);
    const reserved = rows.reduce((sum, row) => sum + row.reservedForRequest, 0);
    const issued = rows.reduce((sum, row) => sum + row.issuedForRequest, 0);
    const requested = rows.reduce((sum, row) => sum + row.line.qty, 0);
    return {
      rows,
      requested,
      reserved,
      issued,
      shortage,
      canReserveFromStock: rows.some((row) => row.totalFree > 0.0001 && row.reservedForRequest + row.issuedForRequest < row.line.qty),
      canIssueReserved: reserved > 0.0001,
      canFulfillFromStock: rows.every((row) => row.shortage <= 0.0001),
    };
  };
  const inferSupplierForItem = (sourceState: ERPState, itemId: string) => {
    const recentPo = [...sourceState.purchaseOrders].reverse().find((order) => order.supplierId && order.lines.some((line) => line.itemId === itemId));
    const recentInvoice = [...sourceState.purchaseInvoices].reverse().find((invoice) => invoice.supplierId && invoice.lines.some((line) => line.itemId === itemId));
    return recentPo?.supplierId || recentInvoice?.supplierId || sourceState.suppliers[0]?.id || '';
  };
  const reserveRequestStock = (doc: MaterialRequest) => { if (!['submitted','approved'].includes(doc.status)) return; update((s) => {
    const newReservations: InventoryReservation[] = [];
    const releasedExisting = (s.inventoryReservations ?? []).map((r) => r.requestId === doc.id && r.status === 'reserved' ? { ...r, status: 'released' as InventoryReservationStatus, note: `${r.note ? `${r.note} · ` : ''}Released before recalculation.` } : r);
    doc.lines.forEach((line) => {
      const alreadyIssued = requestIssuedQty(s, doc.id, line.id);
      let remaining = Math.max(0, line.qty - alreadyIssued);
      const stores = [
        ...s.stores.filter((store) => store.id === doc.storeId),
        ...s.stores.filter((store) => store.id !== doc.storeId),
      ];
      stores.forEach((store) => {
        if (remaining <= 0.0001) return;
        const free = getFreeStock({ ...s, inventoryReservations: releasedExisting }, store.id, line.itemId, doc.id);
        if (free <= 0.0001) return;
        const reserveQty = Math.min(remaining, free);
        newReservations.push({ id: id('RSV'), ref: `RSV-${String((s.inventoryReservations ?? []).length + newReservations.length + 1).padStart(5, '0')}`, date: today(), requestId: doc.id, requestRef: doc.ref, requestLineId: line.id, storeId: store.id, itemId: line.itemId, qty: reserveQty, status: 'reserved', reservedBy: currentUser(s)?.name ?? 'local-admin', note: store.id === doc.storeId ? `Reserved in requesting store for ${doc.ref}` : `Reserved from ${storeName(s, store.id, 'en')} for ${doc.ref}` });
        remaining -= reserveQty;
      });
    });
    const nextState = { ...s, inventoryReservations: [...releasedExisting, ...newReservations], materialRequests: s.materialRequests.map((r) => r.id === doc.id ? { ...r, status: 'approved' as WorkflowStatus, note: `${r.note ? `${r.note} · ` : ''}Stock reservation recalculated: ${newReservations.length} reservation line(s).` } : r) };
    return addAudit(nextState, 'reserve', 'material_request', doc.ref, `Reserved stock for material request: ${newReservations.reduce((sum, r) => sum + r.qty, 0)} units`);
  }, L(locale, 'Stock reserved for request', 'تم حجز المخزون للطلب')); };

  const createTransferOrIssueReservedStock = (doc: MaterialRequest) => { if (!['approved','submitted'].includes(doc.status)) return; update((s) => {
    const activeReservations = (s.inventoryReservations ?? []).filter((r) => r.requestId === doc.id && r.status === 'reserved');
    if (!activeReservations.length) return s;
    const movements: StockMovement[] = [];
    const issues: InternalStockIssue[] = [];
    const transfers: TransferDoc[] = [];
    activeReservations.forEach((reservation) => {
      const unitCost = getAveragePurchaseCost(s, reservation.itemId);
      let movementOutId: string | undefined;
      let movementInId: string | undefined;
      let transferId: string | undefined;
      const isStoreTransfer = reservation.storeId !== doc.storeId;
      const ref = isStoreTransfer
        ? `TR-MR-${String((s.transfers ?? []).length + transfers.length + 1).padStart(4, '0')}`
        : `ISS-MR-${String((s.internalStockIssues ?? []).length + issues.length + 1).padStart(4, '0')}`;

      movementOutId = id('MOV');
      movements.push({
        id: movementOutId,
        date: today(),
        type: isStoreTransfer ? 'material_request_transfer_out' : 'material_request_internal_issue',
        storeId: reservation.storeId,
        itemId: reservation.itemId,
        direction: 'out',
        qty: reservation.qty,
        unitCost,
        ref,
        note: isStoreTransfer
          ? `Material request transfer dispatch to ${storeName(s, doc.storeId, 'en')} for ${doc.ref}`
          : `Material request internal issue / consumption for ${doc.ref}`,
      });

      if (isStoreTransfer) {
        movementInId = id('MOV');
        transferId = id('TR');
        movements.push({
          id: movementInId,
          date: today(),
          type: 'material_request_transfer_in',
          storeId: doc.storeId,
          itemId: reservation.itemId,
          direction: 'in',
          qty: reservation.qty,
          unitCost,
          ref,
          note: `Material request transfer receipt from ${storeName(s, reservation.storeId, 'en')} for ${doc.ref}`,
        });
        transfers.push({
          id: transferId,
          date: today(),
          ref,
          fromStoreId: reservation.storeId,
          toStoreId: doc.storeId,
          itemId: reservation.itemId,
          qty: reservation.qty,
          posted: true,
        });
      }

      issues.push({
        id: id('ISS'),
        ref,
        date: today(),
        requestId: doc.id,
        requestRef: doc.ref,
        fromStoreId: reservation.storeId,
        toStoreId: doc.storeId,
        itemId: reservation.itemId,
        qty: reservation.qty,
        status: 'posted',
        fulfillmentMode: isStoreTransfer ? 'store_transfer' : 'internal_issue',
        transferId,
        movementOutId,
        movementInId,
        note: isStoreTransfer
          ? 'Reserved stock moved by store transfer to the requesting store.'
          : 'Reserved stock issued to immediate use / cost center consumption from the requesting store.',
      });
    });
    const updatedReservations = (s.inventoryReservations ?? []).map((r) => r.requestId === doc.id && r.status === 'reserved' ? { ...r, status: 'issued' as InventoryReservationStatus, issuedAt: new Date().toISOString(), note: `${r.note ? `${r.note} · ` : ''}${r.storeId === doc.storeId ? 'Issued to use / consumption.' : 'Transferred to requesting store.'}` } : r);
    const tempState = { ...s, inventoryReservations: updatedReservations, stockMovements: [...s.stockMovements, ...movements], transfers: [...(s.transfers ?? []), ...transfers], internalStockIssues: [...(s.internalStockIssues ?? []), ...issues] };
    const coverageAfter = requestCoverage(doc, tempState);
    const nextStatus: WorkflowStatus = coverageAfter.rows.every((row) => row.issuedForRequest >= row.line.qty - 0.0001) ? 'closed' : 'approved';
    const transferCount = transfers.length;
    const issueCount = issues.length - transferCount;
    const nextState = { ...tempState, materialRequests: tempState.materialRequests.map((r) => r.id === doc.id ? { ...r, status: nextStatus, note: `${r.note ? `${r.note} · ` : ''}Fulfilled reserved stock: ${transferCount} transfer(s), ${issueCount} internal issue(s). Remaining shortage: ${qty(coverageAfter.shortage)}.` } : r) };
    return addAudit(nextState, 'transfer_or_issue_reserved_stock', 'material_request', doc.ref, `Material request fulfilled with ${transferCount} transfer(s), ${issueCount} issue(s); remaining shortage ${coverageAfter.shortage}`);
  }, L(locale, 'Reserved stock transferred / issued', 'تم تحويل أو صرف المخزون المحجوز')); };

  const issueRequestFromStock = (doc: MaterialRequest) => { if (!['submitted','approved'].includes(doc.status)) return; const coverage = requestCoverage(doc); if (!coverage.canFulfillFromStock && coverage.reserved <= 0.0001) return; reserveRequestStock(doc); };
  const createShortagePosFromRequest = (doc: MaterialRequest) => { if (!['submitted','approved'].includes(doc.status)) return; update((s) => {
    const groups = new Map<string, PurchaseOrderLine[]>();
    doc.lines.forEach((line) => {
      const reservedForRequest = requestReservedQty(s, doc.id, line.id) + requestIssuedQty(s, doc.id, line.id);
      const totalFree = s.stores.reduce((sum, store) => sum + getFreeStock(s, store.id, line.itemId, doc.id), 0);
      const shortageQty = Math.max(0, line.qty - reservedForRequest - totalFree);
      if (shortageQty <= 0.0001) return;
      const supplierId = inferSupplierForItem(s, line.itemId);
      if (!supplierId) return;
      const rows = groups.get(supplierId) ?? [];
      rows.push({ id: id('POL'), itemId: line.itemId, qty: shortageQty, unitCost: getAveragePurchaseCost(s, line.itemId), vatRate: 15, receivedQty: 0, invoicedQty: 0 });
      groups.set(supplierId, rows);
    });
    if (!groups.size) {
      const shortageTotal = doc.lines.reduce((sum, line) => sum + Math.max(0, line.qty - requestReservedQty(s, doc.id, line.id) - requestIssuedQty(s, doc.id, line.id) - s.stores.reduce((storeSum, store) => storeSum + getFreeStock(s, store.id, line.itemId, doc.id), 0)), 0);
      if (shortageTotal > 0.0001) return addAudit({ ...s, materialRequests: s.materialRequests.map((r) => r.id === doc.id ? { ...r, status: 'approved', note: `${r.note ? `${r.note} · ` : ''}Shortage exists but no supplier is configured for one or more items.` } : r) }, 'block', 'material_request', doc.ref, 'Shortage PO blocked because no supplier is available');
      return addAudit({ ...s, materialRequests: s.materialRequests.map((r) => r.id === doc.id ? { ...r, status: 'closed', note: `${r.note ? `${r.note} · ` : ''}No PO created because available stock covers the request.` } : r) }, 'close', 'material_request', doc.ref, 'Request closed because stock covers all requested items');
    }
    const base = s.purchaseOrders.length;
    const newOrders: PurchaseOrder[] = Array.from(groups.entries()).map(([supplierId, lines], index) => ({ ...blankPo, id: id('PO'), ref: `PO-${String(base + index + 1).padStart(5, '0')}`, date: today(), supplierId, branchId: doc.branchId, storeId: doc.storeId, requestRef: doc.ref, eta: doc.neededBy || today(), status: 'approved', lines, note: `Auto-split from ${doc.ref}; shortage quantities only.` }));
    return addAudit({ ...s, materialRequests: s.materialRequests.map((r) => r.id === doc.id ? { ...r, status: 'converted', note: `${r.note ? `${r.note} · ` : ''}Converted to ${newOrders.length} supplier PO(s) for shortage only.` } : r), purchaseOrders: [...s.purchaseOrders, ...newOrders] }, 'convert', 'material_request', doc.ref, `Material request split into ${newOrders.length} supplier PO(s)`);
  }, L(locale, 'Shortage PO(s) created by supplier', 'تم إنشاء أوامر شراء للنواقص حسب المورد')); };
  const createPoFromRequest = (doc: MaterialRequest) => { setTab('orders'); setPo({ ...blankPo, branchId: doc.branchId, storeId: doc.storeId, requestRef: doc.ref, lines: doc.lines.map((l) => ({ id: id('POL'), itemId: l.itemId, qty: l.qty, unitCost: getAveragePurchaseCost(state, l.itemId), vatRate: 15, receivedQty: 0, invoicedQty: 0 })) }); };
  const addPoLine = () => poLine.itemId && poLine.qty > 0 && setPo({ ...po, lines: [...po.lines, { ...poLine, id: id('POL') }] });
  const savePo = () => { if (!po.supplierId || !po.branchId || !po.storeId || po.lines.length === 0 || !canPerform(state, 'purchasing.po.approve', { branchId: po.branchId, storeId: po.storeId })) return; update((s) => { const ref = po.ref || `PO-${String(s.purchaseOrders.length + 1).padStart(5, '0')}`; const doc: PurchaseOrder = { ...po, id: po.id || id('PO'), ref, status: 'approved' }; const requests = po.requestRef ? s.materialRequests.map((r) => r.ref === po.requestRef ? { ...r, status: 'converted' as WorkflowStatus } : r) : s.materialRequests; return addAudit({ ...s, materialRequests: requests, purchaseOrders: upsert(s.purchaseOrders, doc) }, 'approve', 'purchase_order', ref, 'Purchase order approved and supplier commitment created'); }, L(locale, 'Purchase order approved', 'تم اعتماد أمر الشراء')); setPo(blankPo); };
  const cancelPo = (doc: PurchaseOrder) => { if (['received','closed'].includes(doc.status)) return; update((s) => addAudit({ ...s, purchaseOrders: s.purchaseOrders.map((o) => o.id === doc.id ? { ...o, status: 'cancelled', note: `${o.note ? `${o.note} · ` : ''}Cancelled / refused before receipt.` } : o) }, 'cancel', 'purchase_order', doc.ref, 'Purchase order cancelled before receipt'), L(locale, 'PO cancelled', 'تم إلغاء أمر الشراء')); };
  const deletePo = (doc: PurchaseOrder) => { const hasReceipt = state.goodsReceipts.some((g) => g.poId === doc.id); if (hasReceipt || !['draft','cancelled'].includes(doc.status)) return; if (typeof window !== 'undefined' && !window.confirm(L(locale, `Delete ${doc.ref}?`, `حذف ${doc.ref}؟`))) return; update((s) => addAudit({ ...s, purchaseOrders: s.purchaseOrders.filter((o) => o.id !== doc.id) }, 'delete', 'purchase_order', doc.ref, 'Purchase order deleted'), L(locale, 'PO deleted', 'تم حذف أمر الشراء')); };
  const loadPoToGrn = (poId: string) => { const order = state.purchaseOrders.find((o) => o.id === poId); if (!order) return; setGrn({ ...blankGrn, poId, supplierId: order.supplierId, storeId: order.storeId, lines: order.lines.map((l) => ({ id: id('GRNL'), itemId: l.itemId, qty: Math.max(l.qty - l.receivedQty, 0), unitCost: l.unitCost, lotNo: '', batchNo: '', binCode: 'RECEIVING', expiryDate: '' })) }); };
  const postGrn = () => { if (!poForGrn || grn.lines.length === 0 || isDateLocked(state, grn.date) || !canPerform(state, 'purchasing.grn.post', { branchId: poForGrn.branchId, storeId: poForGrn.storeId })) return; update((s) => { const ref = grn.ref || `GRN-${String(s.goodsReceipts.length + 1).padStart(5, '0')}`; const doc: GoodsReceipt = { ...grn, id: id('GRN'), ref, status: 'posted', supplierId: poForGrn.supplierId, storeId: poForGrn.storeId };
    const moves: StockMovement[] = doc.lines.filter((l) => l.qty > 0).map((l, idx) => ({ id: id('MOV'), date: doc.date, type: 'goods_receipt', storeId: doc.storeId, itemId: l.itemId, direction: 'in' as Direction, qty: l.qty, unitCost: l.unitCost, ref, note: poForGrn.ref, lotNo: l.batchNo || l.lotNo || `${ref}-B${idx + 1}`, binCode: l.binCode || 'RECEIVING', expiryDate: l.expiryDate, supplierId: doc.supplierId }));
    const lots: InventoryLot[] = doc.lines.filter((l) => l.qty > 0).map((l, idx) => ({ id: id('LOT'), storeId: doc.storeId, itemId: l.itemId, lotNo: l.batchNo || l.lotNo || `${ref}-B${idx + 1}`, batchNo: l.batchNo || `${ref}-B${idx + 1}`, binCode: l.binCode || 'RECEIVING', receivedDate: doc.date, expiryDate: l.expiryDate || '', qty: l.qty, unitCost: l.unitCost, status: 'available', sourceRef: ref, supplierId: doc.supplierId, note: 'Goods received against PO' }));
    const net = doc.lines.reduce((sum, l) => sum + l.qty * l.unitCost, 0); const branchId = poForGrn.branchId;
    const journal: JournalEntry = { id: id('JE'), date: doc.date, ref, source: 'goods_receipt', description: `GRN against ${poForGrn.ref}`, status: 'posted', lines: [ { id: id('JL'), accountCode: '1300', debit: net, credit: 0, branchId, costCenterId: 'company', memo: 'Inventory received before invoice' }, { id: id('JL'), accountCode: '2110', debit: 0, credit: net, branchId, costCenterId: 'company', memo: 'GRNI liability' } ] };
    const updatedOrders = s.purchaseOrders.map((o) => o.id === poForGrn.id ? { ...o, status: doc.lines.some((ln) => (o.lines.find((ol) => ol.itemId === ln.itemId)?.receivedQty ?? 0) + ln.qty < (o.lines.find((ol) => ol.itemId === ln.itemId)?.qty ?? 0)) ? 'partially_received' as const : 'received' as const, lines: o.lines.map((ol) => { const received = doc.lines.filter((ln) => ln.itemId === ol.itemId).reduce((sum, ln) => sum + ln.qty, 0); return { ...ol, receivedQty: ol.receivedQty + received }; }) } : o);
    return addAudit({ ...s, purchaseOrders: updatedOrders, goodsReceipts: [...s.goodsReceipts, doc], stockMovements: [...s.stockMovements, ...moves], inventoryLots: [...s.inventoryLots, ...lots], journals: [...s.journals, journal] }, 'post', 'goods_receipt', ref, 'GRN posted with stock, lots, GRNI accounting and audit trail'); }, L(locale, 'GRN posted', 'تم ترحيل الاستلام')); setGrn(blankGrn); };
  const postInvoiceFromPo = () => { if (!invoicePo || !supplierInvoiceNo || isDateLocked(state, today()) || !canPerform(state, 'purchasing.invoice.post', { branchId: invoicePo.branchId, storeId: invoicePo.storeId })) return; update((s) => { const ref = `PINV-${String(s.purchaseInvoices.length + 1).padStart(5, '0')}`; const inv: PurchaseInvoice = { id: id('PI'), ref, invoiceNo: supplierInvoiceNo, supplierId: invoicePo.supplierId, branchId: invoicePo.branchId, storeId: invoicePo.storeId, costCenterId: 'company', invoiceDate: today(), deliveryDate: today(), paymentType: 'credit', paidAmount: 0, status: 'posted', lines: invoicePo.lines.map((l) => ({ id: id('PIL'), itemId: l.itemId, qty: l.receivedQty || l.qty, unitCost: l.unitCost, vatRate: l.vatRate, discount: 0 })) };
    const t = invoiceTotals(inv); const journal: JournalEntry = { id: id('JE'), date: inv.invoiceDate, ref, source: 'supplier_invoice_match', description: `Supplier invoice ${supplierInvoiceNo} matched to ${invoicePo.ref}`, status: 'posted', lines: [ { id: id('JL'), accountCode: '2110', debit: t.net, credit: 0, branchId: invoicePo.branchId, costCenterId: 'company', memo: 'Clear GRNI' }, { id: id('JL'), accountCode: '1420', debit: t.vat, credit: 0, branchId: invoicePo.branchId, costCenterId: 'company', memo: 'VAT input on invoice' }, { id: id('JL'), accountCode: '2100', debit: 0, credit: t.total, branchId: invoicePo.branchId, costCenterId: 'company', memo: supplierName(s, invoicePo.supplierId) } ] };
    return addAudit({ ...s, purchaseInvoices: [...s.purchaseInvoices, inv], purchaseOrders: s.purchaseOrders.map((o) => o.id === invoicePo.id ? { ...o, status: 'closed', lines: o.lines.map((l) => ({ ...l, invoicedQty: l.receivedQty || l.qty })) } : o), journals: [...s.journals, journal] }, 'post', 'supplier_invoice', ref, 'Supplier invoice matched to GRN and PO; AP recognized'); }, L(locale, 'Supplier invoice matched and posted', 'تم مطابقة وترحيل فاتورة المورد')); setInvoiceFromPoId(''); setSupplierInvoiceNo(''); };
  const postSupplierPayment = () => {
    if (!payment.supplierId || !payment.invoiceRef || payment.amount <= 0) return;
    const inv = state.purchaseInvoices.find((i) => i.ref === payment.invoiceRef);
    if (!inv || payment.amount > supplierInvoiceBalance(state, inv) + 0.01 || isDateLocked(state, payment.date) || !canPerform(state, 'purchasing.payment.post')) return;
    update((s) => { const ref = `PAY-${String(s.supplierPayments.length + 1).padStart(5, '0')}`; const pay: SupplierPayment = { ...payment, id: id('PAY'), ref, status: 'posted' }; const journal: JournalEntry = { id: id('JE'), date: pay.date, ref, source: 'supplier_payment', description: `Supplier payment ${supplierName(s, pay.supplierId)} allocated to ${pay.invoiceRef}`, status: 'posted', lines: [ { id: id('JL'), accountCode: '2100', debit: pay.amount, credit: 0, branchId: inv.branchId, costCenterId: 'company', memo: `${supplierName(s, pay.supplierId)} · ${pay.invoiceRef}` }, { id: id('JL'), accountCode: pay.accountCode, debit: 0, credit: pay.amount, branchId: inv.branchId, costCenterId: 'company', memo: pay.method } ] }; return addAudit({ ...s, supplierPayments: [...s.supplierPayments, pay], journals: [...s.journals, journal] }, 'post', 'supplier_payment', ref, `Payment voucher allocated to invoice ${pay.invoiceRef}`); }, L(locale, 'Supplier payment posted and allocated', 'تم ترحيل وتخصيص سداد المورد')); setPayment({ id: '', ref: '', date: today(), supplierId: '', amount: 0, method: 'bank', accountCode: '1020', status: 'draft', note: '', invoiceRef: '' }); };
  const cycleScore = Math.max(0, 100 - openRequests.length * 4 - openOrders.filter((o) => o.status !== 'closed').length * 5 - Math.abs(grniBalance) / 1000 * 2);
  return <div className="page-grid purchasing-workspace">
    <Card title={L(locale, 'Purchasing control workspace', 'مساحة رقابة المشتريات')} icon={<ShoppingCart/>}>
      <div className="notice">{L(locale, 'Professional cycle is now separated: Material Request → PO → GRN → Supplier Invoice → Payment. Stock is recognized at GRN, VAT/AP at invoice, and cash/bank at payment.', 'أصبحت الدورة مفصولة مهنياً: طلب مواد ← أمر شراء ← استلام ← فاتورة مورد ← سداد. المخزون يثبت عند الاستلام، الضريبة والذمم عند الفاتورة، والنقدية/البنك عند السداد.')}</div>
      <div className="finance-tab-grid">{(['control','requests','orders','receiving','invoices','payments','register','documents'] as PurchasingTab[]).map((t) => <button key={t} className={tab === t ? 'active-tab' : ''} onClick={() => setTab(t)}>{t === 'control' ? <LayoutDashboard size={16}/> : t === 'requests' ? <ClipboardCheck size={16}/> : t === 'orders' ? <FileText size={16}/> : t === 'receiving' ? <PackageCheck size={16}/> : t === 'invoices' ? <ReceiptText size={16}/> : t === 'payments' ? <Wallet size={16}/> : t === 'documents' ? <FileText size={16}/> : <Database size={16}/>}{{ control: L(locale, 'Control', 'الرقابة'), requests: L(locale, 'Material Requests', 'طلبات المواد'), orders: L(locale, 'Purchase Orders', 'أوامر الشراء'), receiving: L(locale, 'GRN Receiving', 'استلام البضائع'), invoices: L(locale, 'Invoice Matching', 'مطابقة الفواتير'), payments: L(locale, 'Payments', 'السداد'), register: L(locale, 'Registers', 'السجلات'), documents: L(locale, 'Document Pack', 'حزمة المستندات') }[t]}</button>)}</div>
    </Card>
    {tab === 'control' && <div className="page-grid"><div className="kpi-grid"><KPI label={L(locale, 'Cycle score', 'درجة الدورة')} value={`${cycleScore.toFixed(0)}%`} hint={L(locale, 'Open docs and GRNI control', 'المستندات المفتوحة ورقابة GRNI')} icon={<ShieldCheck/>}/><KPI label={L(locale, 'Open requests', 'طلبات مفتوحة')} value={`${openRequests.length}`} hint={L(locale, 'Need PO decision', 'تحتاج أمر شراء')} icon={<ClipboardCheck/>}/><KPI label={L(locale, 'Open POs', 'أوامر مفتوحة')} value={`${openOrders.filter((o) => o.status !== 'closed').length}`} hint={L(locale, 'Awaiting receipt/invoice', 'بانتظار استلام/فاتورة')} icon={<FileText/>}/><KPI label="GRNI" value={money(grniBalance, locale)} hint={L(locale, 'Goods received not invoiced', 'بضائع مستلمة غير مفوترة')} icon={<PackageCheck/>}/><KPI label="AP" value={money(apBalance, locale)} hint={L(locale, 'Supplier balance after payments', 'رصيد الموردين بعد السداد')} icon={<Wallet/>}/></div><Card title={L(locale, 'Cycle exceptions', 'استثناءات الدورة')} icon={<ListChecks/>}><Table headers={[L(locale, 'Control', 'البند الرقابي'), L(locale, 'Count / Value', 'العدد / القيمة'), L(locale, 'Action', 'الإجراء')]} rows={[[L(locale, 'Requests not converted to PO', 'طلبات لم تتحول إلى أوامر شراء'), `${openRequests.length}`, L(locale, 'Review requests tab', 'راجع تبويب الطلبات')], [L(locale, 'Goods received but not invoiced', 'استلامات غير مفوترة'), money(grniBalance, locale), L(locale, 'Match supplier invoices', 'طابق فواتير الموردين')], [L(locale, 'Supplier balance', 'رصيد الموردين'), money(apBalance, locale), L(locale, 'Schedule payment run', 'جدولة السداد')]]}/></Card></div>}
    {tab === 'requests' && <Card title={L(locale, 'Material request', 'طلب مواد')} icon={<ClipboardCheck/>}><div className="notice">{L(locale, 'Manager can approve, refuse, delete, reserve stock, then create a store transfer or internal issue. Available stock is reserved before fulfillment so two requests cannot consume the same quantity.', 'يمكن للمدير الاعتماد أو الرفض أو الحذف أو حجز المخزون ثم إنشاء تحويل مخزني أو صرف داخلي. يتم حجز الكمية قبل التنفيذ لمنع استخدام نفس المخزون لطلبين.')}</div><div className="form-grid"><Field label={L(locale, 'Branch', 'الفرع')}><select value={request.branchId} onChange={(e) => setRequest({ ...request, branchId: e.target.value })}><option value="">—</option>{state.branches.map((b) => <option key={b.id} value={b.id}>{L(locale, b.nameEn, b.nameAr)}</option>)}</select></Field><Field label={L(locale, 'Requesting store', 'المخزن الطالب')}><select value={request.storeId} onChange={(e) => setRequest({ ...request, storeId: e.target.value })}><option value="">—</option>{state.stores.map((s) => <option key={s.id} value={s.id}>{L(locale, s.nameEn, s.nameAr)}</option>)}</select></Field><Field label={L(locale, 'Needed by', 'تاريخ الحاجة')}><input type="date" value={request.neededBy} onChange={(e) => setRequest({ ...request, neededBy: e.target.value })}/></Field><Field label={L(locale, 'Note', 'ملاحظة')}><input value={request.note} onChange={(e) => setRequest({ ...request, note: e.target.value })}/></Field></div><div className="subcard"><strong>{L(locale, 'Request line', 'بند الطلب')}</strong><div className="form-grid"><Field label={L(locale, 'Item', 'الصنف')}><select value={requestLine.itemId} onChange={(e) => setRequestLine({ ...requestLine, itemId: e.target.value })}><option value="">—</option>{state.items.map((i) => <option key={i.id} value={i.id}>{i.sku} - {L(locale, i.nameEn, i.nameAr)}</option>)}</select></Field><Field label={L(locale, 'Qty', 'الكمية')}><input type="number" value={requestLine.qty} onChange={(e) => setRequestLine({ ...requestLine, qty: Number(e.target.value) })}/></Field><Field label={L(locale, 'Line note', 'ملاحظة البند')}><input value={requestLine.note} onChange={(e) => setRequestLine({ ...requestLine, note: e.target.value })}/></Field></div><button onClick={addRequestLine}><Plus size={16}/>{L(locale, 'Add Line', 'إضافة بند')}</button></div><Table headers={[L(locale, 'Item', 'الصنف'), L(locale, 'Qty', 'الكمية'), L(locale, 'Free in store', 'المتاح الحر بالمخزن'), L(locale, 'Free all stores', 'المتاح الحر بكل المخازن'), L(locale, 'Reserved', 'المحجوز'), L(locale, 'Shortage', 'النقص'), L(locale, 'Note', 'ملاحظة')]} rows={request.lines.map((l) => { const freeInStore = request.storeId ? getFreeStock(state, request.storeId, l.itemId) : 0; const totalFree = state.stores.reduce((sum, store) => sum + getFreeStock(state, store.id, l.itemId), 0); const reserved = request.id ? requestReservedQty(state, request.id, l.id) : 0; const shortage = Math.max(0, l.qty - totalFree - reserved); return [itemName(state, l.itemId, locale), qty(l.qty), qty(freeInStore), qty(totalFree), qty(reserved), shortage > 0 ? <StockPill tone="warn">{qty(shortage)}</StockPill> : <StockPill tone="good">0</StockPill>, l.note]; })}/><button onClick={submitRequest}><Save size={16}/>{L(locale, 'Submit Request', 'إرسال الطلب')}</button><Table headers={[L(locale, 'Ref', 'المرجع'), L(locale, 'Branch', 'الفرع'), L(locale, 'Store', 'المخزن'), L(locale, 'Lines', 'البنود'), L(locale, 'Status', 'الحالة'), L(locale, 'Stock decision', 'قرار المخزون'), L(locale, 'Actions', 'إجراءات')]} rows={state.materialRequests.map((r) => { const coverage = requestCoverage(r); return [r.ref, branchName(state, r.branchId, locale), storeName(state, r.storeId, locale), `${r.lines.length}`, r.status, <div className="stack"><span>{coverage.reserved > 0 ? L(locale, `Reserved ${qty(coverage.reserved)}`, `محجوز ${qty(coverage.reserved)}`) : L(locale, 'No reservation', 'لا يوجد حجز')}</span>{coverage.shortage > 0 ? <StockPill tone="warn">{L(locale, `Shortage ${qty(coverage.shortage)}`, `نقص ${qty(coverage.shortage)}`)}</StockPill> : <StockPill tone="good">{L(locale, 'Covered', 'مغطى')}</StockPill>}</div>, <div className="button-row compact"><button onClick={() => approveRequest(r)} disabled={r.status !== 'submitted'}>{L(locale, 'Approve', 'اعتماد')}</button><button onClick={() => rejectRequest(r)} disabled={!['submitted','approved'].includes(r.status)}>{L(locale, 'Refuse', 'رفض')}</button><button onClick={() => reserveRequestStock(r)} disabled={!['submitted','approved'].includes(r.status) || !coverage.canReserveFromStock}>{L(locale, 'Reserve Stock', 'حجز مخزون')}</button><button onClick={() => createTransferOrIssueReservedStock(r)} disabled={!['submitted','approved'].includes(r.status) || !coverage.canIssueReserved}>{L(locale, 'Create Transfer / Issue', 'إنشاء تحويل / صرف')}</button><button onClick={() => createShortagePosFromRequest(r)} disabled={!['approved','submitted'].includes(r.status) || coverage.shortage <= 0}>{L(locale, 'Create Shortage PO', 'أمر للنواقص')}</button><button onClick={() => deleteRequest(r)} disabled={r.status === 'converted'}>{L(locale, 'Delete', 'حذف')}</button></div>]; })}/></Card>}
    {tab === 'orders' && <Card title={L(locale, 'Purchase order', 'أمر شراء')} icon={<FileText/>}><div className="notice">{L(locale, 'One purchase order belongs to one supplier. If a material request contains items from multiple suppliers, use Create Shortage PO from the request screen; the system will split supplier POs automatically.', 'كل أمر شراء يكون لمورد واحد. إذا كان طلب المواد يحتوي أصنافاً من عدة موردين استخدم إنشاء أمر للنواقص من شاشة الطلب؛ وسيقسم النظام أوامر الشراء حسب المورد تلقائياً.')}</div><div className="form-grid"><Field label={L(locale, 'Supplier', 'المورد')}><select value={po.supplierId} onChange={(e) => setPo({ ...po, supplierId: e.target.value })}><option value="">—</option>{state.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Field label={L(locale, 'Branch', 'الفرع')}><select value={po.branchId} onChange={(e) => setPo({ ...po, branchId: e.target.value })}><option value="">—</option>{state.branches.map((b) => <option key={b.id} value={b.id}>{L(locale, b.nameEn, b.nameAr)}</option>)}</select></Field><Field label={L(locale, 'Receiving store', 'مخزن الاستلام')}><select value={po.storeId} onChange={(e) => setPo({ ...po, storeId: e.target.value })}><option value="">—</option>{state.stores.map((s) => <option key={s.id} value={s.id}>{L(locale, s.nameEn, s.nameAr)}</option>)}</select></Field><Field label={L(locale, 'ETA', 'تاريخ التسليم المتوقع')}><input type="date" value={po.eta} onChange={(e) => setPo({ ...po, eta: e.target.value })}/></Field><Field label={L(locale, 'Request ref', 'مرجع الطلب')}><input value={po.requestRef || ''} onChange={(e) => setPo({ ...po, requestRef: e.target.value })}/></Field></div><div className="subcard"><strong>{L(locale, 'PO line', 'بند أمر الشراء')}</strong><div className="form-grid"><Field label={L(locale, 'Item', 'الصنف')}><select value={poLine.itemId} onChange={(e) => setPoLine({ ...poLine, itemId: e.target.value })}><option value="">—</option>{state.items.map((i) => <option key={i.id} value={i.id}>{i.sku} - {L(locale, i.nameEn, i.nameAr)}</option>)}</select></Field><Field label={L(locale, 'Qty', 'الكمية')}><input type="number" value={poLine.qty} onChange={(e) => setPoLine({ ...poLine, qty: Number(e.target.value) })}/></Field><Field label={L(locale, 'Expected unit price', 'سعر الوحدة المتوقع')}><input type="number" value={poLine.unitCost} onChange={(e) => setPoLine({ ...poLine, unitCost: Number(e.target.value) })}/></Field><Field label="VAT %"><input type="number" value={poLine.vatRate} onChange={(e) => setPoLine({ ...poLine, vatRate: Number(e.target.value) })}/></Field></div><button onClick={addPoLine}><Plus size={16}/>{L(locale, 'Add PO Line', 'إضافة بند')}</button></div><Table headers={[L(locale, 'Item', 'الصنف'), L(locale, 'Qty', 'الكمية'), L(locale, 'Unit price', 'سعر الوحدة'), L(locale, 'Net', 'الصافي')]} rows={po.lines.map((l) => [itemName(state, l.itemId, locale), qty(l.qty), money(l.unitCost, locale), money(l.qty * l.unitCost, locale)])}/><button onClick={savePo}><Save size={16}/>{L(locale, 'Approve PO', 'اعتماد أمر الشراء')}</button><Table headers={[L(locale, 'PO', 'أمر الشراء'), L(locale, 'Supplier', 'المورد'), L(locale, 'Status', 'الحالة'), L(locale, 'ETA', 'التسليم المتوقع'), L(locale, 'Net value', 'القيمة الصافية'), L(locale, 'Actions', 'إجراءات')]} rows={state.purchaseOrders.map((o) => { const hasReceipt = state.goodsReceipts.some((g) => g.poId === o.id); return [o.ref, supplierName(state, o.supplierId), o.status, o.eta, money(o.lines.reduce((s, l) => s + l.qty * l.unitCost, 0), locale), <div className="button-row compact"><button onClick={() => cancelPo(o)} disabled={['received','closed','cancelled'].includes(o.status)}>{L(locale, 'Cancel / Refuse', 'إلغاء / رفض')}</button><button onClick={() => deletePo(o)} disabled={hasReceipt || !['draft','cancelled'].includes(o.status)}>{L(locale, 'Delete', 'حذف')}</button></div>]; })}/></Card>}
    {tab === 'receiving' && <Card title={L(locale, 'Goods receipt note', 'إشعار استلام البضائع')} icon={<PackageCheck/>}><div className="form-grid"><Field label={L(locale, 'Purchase order', 'أمر الشراء')}><select value={grn.poId} onChange={(e) => loadPoToGrn(e.target.value)}><option value="">—</option>{state.purchaseOrders.filter((o) => ['approved','partially_received'].includes(o.status)).map((o) => <option key={o.id} value={o.id}>{o.ref} — {supplierName(state, o.supplierId)}</option>)}</select></Field><Field label={L(locale, 'GRN date', 'تاريخ الاستلام')}><input type="date" value={grn.date} onChange={(e) => setGrn({ ...grn, date: e.target.value })}/></Field></div><Table headers={[L(locale, 'Item', 'الصنف'), L(locale, 'Receive qty', 'كمية الاستلام'), L(locale, 'Unit cost', 'تكلفة الوحدة'), L(locale, 'Batch No.', 'رقم الدفعة'), L(locale, 'Bin', 'موقع'), L(locale, 'Expiry', 'صلاحية')]} rows={grn.lines.map((l, idx) => [itemName(state, l.itemId, locale), <input type="number" value={l.qty} onChange={(e) => setGrn({ ...grn, lines: grn.lines.map((x, i) => i === idx ? { ...x, qty: Number(e.target.value) } : x) })}/>, money(l.unitCost, locale), <input value={l.batchNo || l.lotNo} placeholder={L(locale, 'Batch No.', 'رقم الدفعة')} onChange={(e) => setGrn({ ...grn, lines: grn.lines.map((x, i) => i === idx ? { ...x, batchNo: e.target.value, lotNo: e.target.value } : x) })}/>, <input value={l.binCode} onChange={(e) => setGrn({ ...grn, lines: grn.lines.map((x, i) => i === idx ? { ...x, binCode: e.target.value } : x) })}/>, <input type="date" value={l.expiryDate} onChange={(e) => setGrn({ ...grn, lines: grn.lines.map((x, i) => i === idx ? { ...x, expiryDate: e.target.value } : x) })}/>])}/><button disabled={!poForGrn} onClick={postGrn}><PackageCheck size={16}/>{L(locale, 'Post GRN', 'ترحيل الاستلام')}</button><Table headers={[L(locale, 'GRN', 'الاستلام'), L(locale, 'PO', 'أمر الشراء'), L(locale, 'Supplier', 'المورد'), L(locale, 'Lines', 'البنود'), L(locale, 'Net value', 'القيمة')]} rows={postedGrns.map((g) => [g.ref, state.purchaseOrders.find((o) => o.id === g.poId)?.ref ?? '—', supplierName(state, g.supplierId), `${g.lines.length}`, money(g.lines.reduce((sum, l) => sum + l.qty * l.unitCost, 0), locale)])}/></Card>}
    {tab === 'invoices' && <Card title={L(locale, 'Three-way invoice matching', 'مطابقة الفاتورة الثلاثية')} icon={<ReceiptText/>}><div className="notice">{L(locale, 'Invoice matching clears GRNI and recognizes VAT/AP. Quantity and price variances are highlighted against the PO/GRN trail.', 'مطابقة الفاتورة تقفل البضائع غير المفوترة وتثبت الضريبة والذمم. يتم إظهار فروقات الكمية والسعر مقابل أمر الشراء والاستلام.')}</div><div className="form-grid"><Field label={L(locale, 'Received PO', 'أمر مستلم')}><select value={invoiceFromPoId} onChange={(e) => setInvoiceFromPoId(e.target.value)}><option value="">—</option>{state.purchaseOrders.filter((o) => ['received','partially_received'].includes(o.status)).map((o) => <option key={o.id} value={o.id}>{o.ref} — {supplierName(state, o.supplierId)}</option>)}</select></Field><Field label={L(locale, 'Supplier invoice no.', 'رقم فاتورة المورد')}><input value={supplierInvoiceNo} onChange={(e) => setSupplierInvoiceNo(e.target.value)}/></Field></div><div className="kpi-grid"><KPI label={L(locale, 'Net matched', 'الصافي المطابق')} value={money(invoiceTotalsFromPo.net, locale)} hint="PO/GRN" icon={<Calculator/>}/><KPI label={L(locale, 'VAT input', 'ضريبة المدخلات')} value={money(invoiceTotalsFromPo.vat, locale)} hint="VAT" icon={<ReceiptText/>}/><KPI label={L(locale, 'AP recognized', 'ذمم مثبتة')} value={money(invoiceTotalsFromPo.total, locale)} hint="AP" icon={<Wallet/>}/></div><button onClick={postInvoiceFromPo} disabled={!invoicePo || !supplierInvoiceNo}><Save size={16}/>{L(locale, 'Post Matched Invoice', 'ترحيل الفاتورة المطابقة')}</button><Table headers={[L(locale, 'Invoice', 'الفاتورة'), L(locale, 'Supplier', 'المورد'), L(locale, 'Lines', 'البنود'), L(locale, 'Total', 'الإجمالي')]} rows={state.purchaseInvoices.map((p) => [p.ref, supplierName(state, p.supplierId), `${p.lines.length}`, money(invoiceTotals(p).total, locale)])}/></Card>}
    {tab === 'payments' && <Card title={L(locale, 'Supplier payment allocation voucher', 'سند سداد مورد مع تخصيص فاتورة')} icon={<Wallet/>}>
      <div className="notice">{L(locale, 'Payments are now allocated to a specific posted supplier invoice. The system blocks overpayment and locked fiscal periods.', 'أصبح السداد مخصصاً على فاتورة مورد مرحلة محددة. يمنع النظام السداد الزائد والفترات المالية المقفلة.')}</div>
      <div className="form-grid"><Field label={L(locale, 'Supplier', 'المورد')}><select value={payment.supplierId} onChange={(e) => setPayment({ ...payment, supplierId: e.target.value, invoiceRef: '', amount: 0 })}><option value="">—</option>{state.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Field label={L(locale, 'Open invoice', 'فاتورة مفتوحة')}><select value={payment.invoiceRef ?? ''} onChange={(e) => { const inv = state.purchaseInvoices.find((x) => x.ref === e.target.value); setPayment({ ...payment, invoiceRef: e.target.value, amount: inv ? supplierInvoiceBalance(state, inv) : 0 }); }}><option value="">—</option>{paymentOpenInvoices.map((inv) => <option key={inv.ref} value={inv.ref}>{inv.ref} · {inv.invoiceNo} · {money(supplierInvoiceBalance(state, inv), locale)}</option>)}</select></Field><Field label={L(locale, 'Amount', 'المبلغ')}><input type="number" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: Number(e.target.value) })}/></Field><Field label={L(locale, 'Open balance', 'الرصيد المفتوح')}><input readOnly value={money(selectedInvoiceBalance, locale)}/></Field><Field label={L(locale, 'Method', 'الطريقة')}><select value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value as SupplierPayment['method'], accountCode: e.target.value === 'cash' ? '1010' : '1020' })}><option value="bank">{L(locale, 'Bank', 'بنك')}</option><option value="cash">{L(locale, 'Cash', 'نقد')}</option></select></Field><Field label={L(locale, 'Date', 'التاريخ')}><input type="date" value={payment.date} onChange={(e) => setPayment({ ...payment, date: e.target.value })}/></Field><Field label={L(locale, 'Note', 'ملاحظة')}><input value={payment.note} onChange={(e) => setPayment({ ...payment, note: e.target.value })}/></Field></div>
      {isDateLocked(state, payment.date) && <div className="warning-box">{L(locale, 'Payment date is in a locked/closed period.', 'تاريخ السداد ضمن فترة مقفلة/مغلقة.')}</div>}{payment.amount > selectedInvoiceBalance && <div className="warning-box">{L(locale, 'Payment amount exceeds selected invoice balance.', 'مبلغ السداد يتجاوز رصيد الفاتورة المحددة.')}</div>}
      <button onClick={postSupplierPayment} disabled={!payment.invoiceRef || payment.amount <= 0 || payment.amount > selectedInvoiceBalance || isDateLocked(state, payment.date) || !canPerform(state, 'purchasing.payment.post')}><Wallet size={16}/>{L(locale, 'Post Allocated Payment', 'ترحيل السداد المخصص')}</button>
      <Table headers={[L(locale, 'Ref', 'المرجع'), L(locale, 'Supplier', 'المورد'), L(locale, 'Invoice', 'الفاتورة'), L(locale, 'Amount', 'المبلغ'), L(locale, 'Method', 'الطريقة')]} rows={state.supplierPayments.map((p) => [p.ref, supplierName(state, p.supplierId), p.invoiceRef ?? '—', money(p.amount, locale), p.method])}/>
    </Card>}
    {tab === 'documents' && <div className="page-grid two">
      <Card title={L(locale, 'Purchasing printable document pack', 'حزمة مستندات المشتريات المطبوعة')} icon={<FileText/>}>
        <div className="notice">{L(locale, 'This creates professional HTML print previews for PO, GRN, invoice match, and payment voucher. In production these will become immutable PDF files with attachments.', 'ينشئ هذا معاينات HTML احترافية لأمر الشراء والاستلام ومطابقة الفاتورة وسند الصرف. في الإنتاج ستتحول إلى PDF ثابت مع مرفقات.')}</div>
        <div className="form-grid"><Field label={L(locale, 'Document', 'المستند')}><select value={selectedPurchaseDoc?.key ?? ''} onChange={(e) => setDocumentKey(e.target.value)}><option value="">—</option>{purchaseDocs.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}</select></Field></div>
        {selectedPurchaseDoc ? <><Table headers={[L(locale, 'Field', 'الحقل'), L(locale, 'Value', 'القيمة')]} rows={selectedPurchaseDoc.meta.map(([k, v]) => [k, v])}/><div className="button-row"><button onClick={() => saveFile(`${selectedPurchaseDoc.ref}-${selectedPurchaseDoc.kind}.html`, selectedPurchaseDoc.html, 'text/html;charset=utf-8')}><Download size={16}/>{L(locale, 'Download Print HTML', 'تحميل نسخة الطباعة HTML')}</button><button onClick={() => saveFile(`${selectedPurchaseDoc.ref}-audit-card.csv`, rowsToCsv(selectedPurchaseDoc.meta.map(([field, value]) => ({ field, value }))), 'text/csv;charset=utf-8')}><FileSpreadsheet size={16}/>{L(locale, 'Export Audit Card', 'تصدير بطاقة التدقيق')}</button></div></> : <div className="warning-box">{L(locale, 'No purchasing documents yet. Load the fast trial scenario or create PO/GRN/invoice/payment first.', 'لا توجد مستندات مشتريات بعد. حمّل سيناريو التجربة أو أنشئ أمر شراء/استلام/فاتورة/سداد أولاً.')}</div>}
      </Card>
      <Card title={L(locale, 'Document control timeline', 'خط الرقابة على المستند')} icon={<ClipboardCheck/>}>
        {selectedPurchaseDoc ? purchaseLifecycleTimeline(state.purchaseOrders.find((p) => p.ref === selectedPurchaseDoc.ref)?.status ?? state.goodsReceipts.find((g) => g.ref === selectedPurchaseDoc.ref)?.status ?? state.purchaseInvoices.find((i) => i.ref === selectedPurchaseDoc.ref)?.status ?? state.supplierPayments.find((p) => p.ref === selectedPurchaseDoc.ref)?.status ?? 'posted', locale) : <div className="notice">{L(locale, 'Select a document to see the lifecycle.', 'اختر مستنداً لعرض دورة حياته.')}</div>}
        <Table headers={[L(locale, 'Control', 'الرقابة'), L(locale, 'Local status', 'الحالة المحلية'), L(locale, 'Production requirement', 'متطلب الإنتاج')]} rows={[
          [L(locale, 'Attachment placeholder', 'مكان المرفقات'), <StockPill tone="warn">Designed</StockPill>, L(locale, 'Quotation, delivery note, invoice image, payment proof', 'عرض سعر، إشعار تسليم، صورة فاتورة، إثبات دفع')],
          [L(locale, 'Print/PDF', 'طباعة/PDF'), <StockPill tone="good">HTML now</StockPill>, L(locale, 'Server-side immutable PDF later', 'PDF ثابت من الخادم لاحقاً')],
          [L(locale, 'Audit timeline', 'خط التدقيق'), <StockPill tone="good">Audit log</StockPill>, L(locale, 'Record-level before/after values later', 'قيم قبل/بعد على مستوى السجل لاحقاً')],
          [L(locale, 'Approval comments', 'تعليقات الاعتماد'), <StockPill tone="warn">Next</StockPill>, L(locale, 'Needs persistent approval-comments table', 'يحتاج جدول تعليقات اعتماد دائم')]
        ]}/>
      </Card>
    </div>}

    {tab === 'register' && <div className="page-grid"><Card title={L(locale, 'Purchasing document register', 'سجل مستندات المشتريات')} icon={<Database/>}><Table headers={[L(locale, 'Type', 'النوع'), L(locale, 'Ref', 'المرجع'), L(locale, 'Status', 'الحالة'), L(locale, 'Value / Lines', 'القيمة / البنود')]} rows={[...state.materialRequests.map((r) => [L(locale, 'MR', 'طلب مواد'), r.ref, r.status, `${r.lines.length}`]), ...state.purchaseOrders.map((o) => [L(locale, 'PO', 'أمر شراء'), o.ref, o.status, money(o.lines.reduce((s, l) => s + l.qty * l.unitCost, 0), locale)]), ...state.goodsReceipts.map((g) => [L(locale, 'GRN', 'استلام'), g.ref, g.status, money(g.lines.reduce((s, l) => s + l.qty * l.unitCost, 0), locale)]), ...state.purchaseInvoices.map((i) => [L(locale, 'Invoice', 'فاتورة'), i.ref, i.status, money(invoiceTotals(i).total, locale)]), ...state.supplierPayments.map((p) => [L(locale, 'Payment', 'سداد'), p.ref, p.status, money(p.amount, locale)]), ...(state.inventoryReservations ?? []).map((r) => [L(locale, 'Reservation', 'حجز'), r.ref, r.status, `${qty(r.qty)} · ${itemName(state, r.itemId, locale)}`]), ...(state.transfers ?? []).filter((t) => String(t.ref).startsWith('TR-MR-')).map((t) => [L(locale, 'Store Transfer', 'تحويل مخزني'), t.ref, t.posted ? 'posted' : 'draft', `${qty(t.qty)} · ${itemName(state, t.itemId, locale)} · ${storeName(state, t.fromStoreId, locale)} → ${storeName(state, t.toStoreId, locale)}`]), ...(state.internalStockIssues ?? []).map((i) => [i.fulfillmentMode === 'store_transfer' ? L(locale, 'MR Transfer Evidence', 'إثبات تحويل الطلب') : L(locale, 'Internal Issue', 'صرف داخلي'), i.ref, i.status, `${qty(i.qty)} · ${itemName(state, i.itemId, locale)} · ${i.fulfillmentMode === 'store_transfer' ? L(locale, 'Transfer', 'تحويل') : L(locale, 'Issue', 'صرف')}`])]}/></Card></div>}
  </div>;
}



function ProductionPage({ state, update, locale }: { state: ERPState; update: (fn: (s: ERPState) => ERPState, success?: string) => void; locale: Locale }) {
  const [tab, setTab] = useState<'recipes' | 'batch' | 'register' | 'costing'>('recipes');
  const blankRecipe: ProductionRecipe = { id: '', code: '', nameEn: '', nameAr: '', outputItemId: '', baseOutputQty: 1, outputUnit: 'KG', defaultExpiryDays: 2, active: true, lines: [] };
  const blankLine: ProductionRecipeLine = { id: '', itemId: '', qty: 0, unit: 'KG', wastagePct: 0 };
  const [recipeDraft, setRecipeDraft] = useState<ProductionRecipe>(blankRecipe);
  const [recipeLine, setRecipeLine] = useState<ProductionRecipeLine>(blankLine);
  const [doc, setDoc] = useState<ProductionDoc>({ id: '', date: today(), ref: '', recipeId: '', sourceStoreId: '', destinationStoreId: '', outputItemId: '', plannedOutputQty: 0, actualOutputQty: 0, expiryDate: '', status: 'draft', lines: [] });
  const selectedRecipe = state.productionRecipes.find((r) => r.id === doc.recipeId);
  const chosenOutputQty = doc.actualOutputQty || doc.plannedOutputQty || selectedRecipe?.baseOutputQty || 0;
  const selectedCost = productionRecipeCost(state, selectedRecipe, chosenOutputQty);
  const linesWithAvailability = selectedCost.scaledLines.map((x) => ({ ...x, availableQty: getBalance(state, doc.sourceStoreId, x.line.itemId) }));
  const productionBlocked = !doc.sourceStoreId || !doc.destinationStoreId || !selectedRecipe || chosenOutputQty <= 0 || linesWithAvailability.some((x) => x.availableQty < x.actualQty);
  const yieldPct = doc.plannedOutputQty ? (doc.actualOutputQty / doc.plannedOutputQty) * 100 : 0;
  const addRecipeLine = () => recipeLine.itemId && recipeLine.qty > 0 && setRecipeDraft({ ...recipeDraft, lines: [...recipeDraft.lines, { ...recipeLine, id: id('PRL') }] });
  const saveRecipe = () => recipeDraft.code && recipeDraft.outputItemId && recipeDraft.baseOutputQty > 0 && recipeDraft.lines.length > 0 && update((s) => addAudit({ ...s, productionRecipes: upsert(s.productionRecipes, { ...recipeDraft, id: recipeDraft.id || id('PREC') }) }, recipeDraft.id ? 'edit' : 'create', 'production_recipe', recipeDraft.code, 'Production recipe saved'), L(locale, 'Production recipe saved', 'تم حفظ وصفة الإنتاج'));
  const applyRecipe = (recipeId: string) => {
    const recipe = state.productionRecipes.find((r) => r.id === recipeId);
    setDoc({ ...doc, recipeId, outputItemId: recipe?.outputItemId ?? '', plannedOutputQty: recipe?.baseOutputQty ?? 0, actualOutputQty: recipe?.baseOutputQty ?? 0, expiryDate: recipe ? expiryFromDays(doc.date, recipe.defaultExpiryDays) : '' });
  };
  const post = () => {
    if (productionBlocked || !selectedRecipe) return;
    update((s) => {
      const recipe = s.productionRecipes.find((r) => r.id === doc.recipeId);
      const qtyOut = doc.actualOutputQty || doc.plannedOutputQty || recipe?.baseOutputQty || 0;
      const costing = productionRecipeCost(s, recipe, qtyOut);
      const ref = `PROD-${String(s.productions.length + 1).padStart(5, '0')}`;
      const postedLines: ProductionLine[] = costing.scaledLines.map((x) => ({ id: id('PL'), itemId: x.line.itemId, plannedQty: x.line.qty * ((doc.plannedOutputQty || qtyOut) / Math.max(recipe?.baseOutputQty || 1, 1)), actualQty: x.actualQty, unit: x.line.unit, wastagePct: x.line.wastagePct }));
      const posted: ProductionDoc = { ...doc, id: id('PROD'), ref, outputItemId: recipe?.outputItemId ?? doc.outputItemId, actualOutputQty: qtyOut, plannedOutputQty: doc.plannedOutputQty || qtyOut, expiryDate: doc.expiryDate || expiryFromDays(doc.date, recipe?.defaultExpiryDays || 0), lines: postedLines, status: 'posted' };
      const outs: StockMovement[] = costing.scaledLines.map((x) => ({ id: id('MOV'), date: doc.date, type: 'production', storeId: doc.sourceStoreId, itemId: x.line.itemId, direction: 'out', qty: x.actualQty, unitCost: getAveragePurchaseCost(s, x.line.itemId), ref, note: `Production recipe ${recipe?.code ?? ''}` }));
      const inn: StockMovement = { id: id('MOV'), date: doc.date, type: 'production', storeId: doc.destinationStoreId, itemId: recipe?.outputItemId ?? doc.outputItemId, direction: 'in', qty: qtyOut, unitCost: costing.unitCost, ref, note: `Semi-finished output; expires ${posted.expiryDate || '—'}` };
      const journal: JournalEntry = { id: id('JE'), date: doc.date, ref, source: 'production', description: `Production batch ${recipe?.code ?? ''}`, status: 'posted', lines: [
        { id: id('JL'), accountCode: '1310', debit: costing.inputCost, credit: 0, branchId: 'company', costCenterId: 'company', memo: recipe?.nameEn ?? 'Semi-finished output' },
        { id: id('JL'), accountCode: '1300', debit: 0, credit: costing.inputCost, branchId: 'company', costCenterId: 'company', memo: 'Raw material consumed' },
      ] };
      return addAudit({ ...s, productions: [...s.productions, posted], stockMovements: [...s.stockMovements, ...outs, inn], journals: [...s.journals, journal] }, 'post', 'production', ref, 'Production batch posted from recipe');
    }, L(locale, 'Production batch posted', 'تم ترحيل دفعة الإنتاج'));
  };
  const registerRows = productionRegisterRows(state);
  return <div className="page-grid">
    <Card title={L(locale, 'Production / Prep Kitchen Control Center', 'مركز التحكم في الإنتاج والتحضير')} icon={<Factory/>}>
      <div className="tab-row"><TabButton active={tab} value="recipes" onClick={setTab}>{L(locale, 'Production Recipes', 'وصفات الإنتاج')}</TabButton><TabButton active={tab} value="batch" onClick={setTab}>{L(locale, 'Create Batch', 'إنشاء دفعة')}</TabButton><TabButton active={tab} value="register" onClick={setTab}>{L(locale, 'Batch Register', 'سجل الدفعات')}</TabButton><TabButton active={tab} value="costing" onClick={setTab}>{L(locale, 'Costing & Variance', 'التكلفة والانحرافات')}</TabButton></div>
    </Card>
    {tab === 'recipes' && <Card title={L(locale, 'Production recipe master', 'بطاقة وصفة الإنتاج')} icon={<BookOpen/>} action={<button onClick={() => setRecipeDraft(blankRecipe)}><X size={16}/>{L(locale, 'Clear', 'مسح')}</button>}>
      <div className="notice">{L(locale, 'Use this for semi-finished items such as pizza dough, sauces, marinades, and bakery batches. These recipes create inventory; they do not post food cost until the final sale.', 'استخدمها للأصناف نصف المصنعة مثل عجينة البيتزا والصلصات والتتبيلات. هذه الوصفات تُنشئ مخزوناً ولا تُسجل تكلفة الغذاء إلا عند البيع النهائي.')}</div>
      <div className="form-grid"><Field label={L(locale, 'Code', 'الكود')}><input value={recipeDraft.code} onChange={(e) => setRecipeDraft({ ...recipeDraft, code: e.target.value })}/></Field><Field label={L(locale, 'Name EN', 'الاسم إنجليزي')}><input value={recipeDraft.nameEn} onChange={(e) => setRecipeDraft({ ...recipeDraft, nameEn: e.target.value })}/></Field><Field label={L(locale, 'Name AR', 'الاسم عربي')}><input value={recipeDraft.nameAr} onChange={(e) => setRecipeDraft({ ...recipeDraft, nameAr: e.target.value })}/></Field><Field label={L(locale, 'Output item', 'الصنف الناتج')}><select value={recipeDraft.outputItemId} onChange={(e) => setRecipeDraft({ ...recipeDraft, outputItemId: e.target.value })}><option value="">—</option>{state.items.filter((i) => i.isSemiFinished).map((i) => <option key={i.id} value={i.id}>{i.sku} - {L(locale, i.nameEn, i.nameAr)}</option>)}</select></Field><Field label={L(locale, 'Base output qty', 'كمية الإنتاج القياسية')}><input type="number" value={recipeDraft.baseOutputQty} onChange={(e) => setRecipeDraft({ ...recipeDraft, baseOutputQty: Number(e.target.value) })}/></Field><Field label={L(locale, 'Output unit', 'وحدة الإنتاج')}><input value={recipeDraft.outputUnit} onChange={(e) => setRecipeDraft({ ...recipeDraft, outputUnit: e.target.value })}/></Field><Field label={L(locale, 'Default expiry days', 'أيام الصلاحية الافتراضية')}><input type="number" value={recipeDraft.defaultExpiryDays} onChange={(e) => setRecipeDraft({ ...recipeDraft, defaultExpiryDays: Number(e.target.value) })}/></Field></div>
      <div className="subcard"><strong>{L(locale, 'Add ingredient line', 'إضافة مكون')}</strong><div className="form-grid"><Field label={L(locale, 'Ingredient', 'المكون')}><select value={recipeLine.itemId} onChange={(e) => setRecipeLine({ ...recipeLine, itemId: e.target.value })}><option value="">—</option>{state.items.filter((i) => !i.isSemiFinished).map((i) => <option key={i.id} value={i.id}>{i.sku} - {L(locale, i.nameEn, i.nameAr)}</option>)}</select></Field><Field label={L(locale, 'Qty for base output', 'الكمية للإنتاج القياسي')}><input type="number" value={recipeLine.qty} onChange={(e) => setRecipeLine({ ...recipeLine, qty: Number(e.target.value) })}/></Field><Field label={L(locale, 'Unit', 'الوحدة')}><input value={recipeLine.unit} onChange={(e) => setRecipeLine({ ...recipeLine, unit: e.target.value })}/></Field><Field label={L(locale, 'Wastage %', 'الهدر %')}><input type="number" value={recipeLine.wastagePct} onChange={(e) => setRecipeLine({ ...recipeLine, wastagePct: Number(e.target.value) })}/></Field></div><button onClick={addRecipeLine}><Plus size={16}/>{L(locale, 'Add Ingredient', 'إضافة مكون')}</button></div>
      <Table headers={[L(locale, 'Ingredient', 'المكون'), L(locale, 'Qty', 'الكمية'), L(locale, 'Wastage', 'الهدر'), L(locale, 'Avg cost', 'متوسط التكلفة'), L(locale, 'Line cost', 'تكلفة البند'), L(locale, 'Actions', 'إجراءات')]} rows={recipeDraft.lines.map((ln) => [itemName(state, ln.itemId, locale), qty(ln.qty, ln.unit), `${ln.wastagePct}%`, money(getAveragePurchaseCost(state, ln.itemId), locale), money(ln.qty * (1 + ln.wastagePct / 100) * getAveragePurchaseCost(state, ln.itemId), locale), <button className="danger" onClick={() => setRecipeDraft({ ...recipeDraft, lines: recipeDraft.lines.filter((x) => x.id !== ln.id) })}><Trash2 size={14}/>{L(locale, 'Remove', 'حذف')}</button>])}/>
      <button onClick={saveRecipe}><Save size={16}/>{L(locale, 'Save Production Recipe', 'حفظ وصفة الإنتاج')}</button>
      <Card title={L(locale, 'Existing production recipes', 'وصفات الإنتاج الحالية')} icon={<ListChecks/>}><Table headers={[L(locale, 'Code', 'الكود'), L(locale, 'Name', 'الاسم'), L(locale, 'Output', 'الناتج'), L(locale, 'Base Qty', 'الكمية القياسية'), L(locale, 'Lines', 'البنود'), L(locale, 'Current Unit Cost', 'تكلفة الوحدة الحالية'), L(locale, 'Actions', 'إجراءات')]} rows={state.productionRecipes.map((r) => { const c = productionRecipeCost(state, r, r.baseOutputQty); return [r.code, L(locale, r.nameEn, r.nameAr), itemName(state, r.outputItemId, locale), qty(r.baseOutputQty, r.outputUnit), `${r.lines.length}`, money(c.unitCost, locale), actionButtons(() => setRecipeDraft(r), () => update((s) => addAudit({ ...s, productionRecipes: s.productionRecipes.map((x) => x.id === r.id ? { ...x, active: false } : x) }, 'delete', 'production_recipe', r.code, 'Production recipe deleted'), L(locale, 'Production recipe deleted', 'تم حذف وصفة الإنتاج')), locale)]; })}/></Card>
    </Card>}
    {tab === 'batch' && <Card title={L(locale, 'Create production batch from recipe', 'إنشاء دفعة إنتاج من وصفة')} icon={<Factory/>}>
      <div className="form-grid"><Field label={L(locale, 'Production recipe', 'وصفة الإنتاج')}><select value={doc.recipeId ?? ''} onChange={(e) => applyRecipe(e.target.value)}><option value="">—</option>{state.productionRecipes.map((r) => <option key={r.id} value={r.id}>{r.code} - {L(locale, r.nameEn, r.nameAr)}</option>)}</select></Field><Field label={L(locale, 'Source store', 'مخزن المواد')}><select value={doc.sourceStoreId} onChange={(e) => setDoc({ ...doc, sourceStoreId: e.target.value })}><option value="">—</option>{state.stores.map((s) => <option key={s.id} value={s.id}>{L(locale, s.nameEn, s.nameAr)}</option>)}</select></Field><Field label={L(locale, 'Destination store', 'مخزن المنتج')}><select value={doc.destinationStoreId} onChange={(e) => setDoc({ ...doc, destinationStoreId: e.target.value })}><option value="">—</option>{state.stores.map((s) => <option key={s.id} value={s.id}>{L(locale, s.nameEn, s.nameAr)}</option>)}</select></Field><Field label={L(locale, 'Planned output qty', 'الإنتاج المخطط')}><input type="number" value={doc.plannedOutputQty} onChange={(e) => setDoc({ ...doc, plannedOutputQty: Number(e.target.value) })}/></Field><Field label={L(locale, 'Actual output qty', 'الإنتاج الفعلي')}><input type="number" value={doc.actualOutputQty} onChange={(e) => setDoc({ ...doc, actualOutputQty: Number(e.target.value) })}/></Field><Field label={L(locale, 'Expiry date', 'تاريخ الانتهاء')}><input type="date" value={doc.expiryDate} onChange={(e) => setDoc({ ...doc, expiryDate: e.target.value })}/></Field></div>
      {productionBlocked && <div className="notice warning">{L(locale, 'Batch cannot be posted until recipe, stores, output quantity, and sufficient stock are valid.', 'لا يمكن ترحيل الدفعة حتى تكون الوصفة والمخازن والكمية وكفاية الرصيد صحيحة.')}</div>}
      <div className="kpi-grid"><KPI label={L(locale, 'Input cost', 'تكلفة المدخلات')} value={money(selectedCost.inputCost, locale)} hint={L(locale, 'At average cost', 'بمتوسط التكلفة')} icon={<Archive/>}/><KPI label={L(locale, 'Output unit cost', 'تكلفة وحدة الناتج')} value={money(selectedCost.unitCost, locale)} hint={L(locale, 'Input / actual output', 'المدخلات / الناتج الفعلي')} icon={<Calculator/>}/><KPI label={L(locale, 'Yield %', 'نسبة العائد')} value={`${yieldPct ? yieldPct.toFixed(1) : '0.0'}%`} hint={L(locale, 'Actual vs planned', 'فعلي مقابل المخطط')} icon={<BarChart3/>}/><KPI label={L(locale, 'Expiry', 'الصلاحية')} value={doc.expiryDate || '—'} hint={L(locale, 'Batch expiry date', 'تاريخ انتهاء الدفعة')} icon={<ClipboardCheck/>}/></div>
      <Table headers={[L(locale, 'Ingredient', 'المكون'), L(locale, 'Required actual', 'المطلوب فعلياً'), L(locale, 'Available', 'المتاح'), L(locale, 'Avg cost', 'متوسط التكلفة'), L(locale, 'Line cost', 'القيمة'), L(locale, 'Status', 'الحالة')]} rows={linesWithAvailability.map((x) => [itemName(state, x.line.itemId, locale), qty(x.actualQty, x.line.unit), qty(x.availableQty, x.line.unit), money(x.unitCost, locale), money(x.lineCost, locale), x.availableQty >= x.actualQty ? L(locale, 'OK', 'سليم') : L(locale, 'Short', 'عجز')])}/>
      <button onClick={post} disabled={productionBlocked}><Factory size={16}/>{L(locale, 'Post Production Batch', 'ترحيل دفعة الإنتاج')}</button>
    </Card>}
    {tab === 'register' && <Card title={L(locale, 'Production batch register', 'سجل دفعات الإنتاج')} icon={<FileText/>}><Table headers={[L(locale, 'Ref', 'المرجع'), L(locale, 'Date', 'التاريخ'), L(locale, 'Recipe', 'الوصفة'), L(locale, 'Output', 'الناتج'), L(locale, 'Planned', 'المخطط'), L(locale, 'Actual', 'الفعلي'), L(locale, 'Variance', 'الانحراف'), L(locale, 'Unit cost', 'تكلفة الوحدة'), L(locale, 'Expiry', 'الصلاحية')]} rows={registerRows.map((r) => { const recipe = state.productionRecipes.find((x) => x.id === r.doc.recipeId); return [r.doc.ref, r.doc.date, recipe ? L(locale, recipe.nameEn, recipe.nameAr) : '—', itemName(state, r.doc.outputItemId, locale), qty(r.doc.plannedOutputQty), qty(r.doc.actualOutputQty), qty(r.plannedVariance), money(r.outputCost, locale), r.doc.expiryDate || '—']; })}/></Card>}
    {tab === 'costing' && <div className="page-grid"><Card title={L(locale, 'Production costing control', 'رقابة تكلفة الإنتاج')} icon={<Calculator/>}><Table headers={[L(locale, 'Recipe', 'الوصفة'), L(locale, 'Output item', 'الصنف الناتج'), L(locale, 'Base output', 'الإنتاج القياسي'), L(locale, 'Current batch cost', 'تكلفة الدفعة الحالية'), L(locale, 'Current unit cost', 'تكلفة الوحدة الحالية'), L(locale, 'Ingredient lines', 'بنود المكونات')]} rows={state.productionRecipes.map((r) => { const c = productionRecipeCost(state, r, r.baseOutputQty); return [L(locale, r.nameEn, r.nameAr), itemName(state, r.outputItemId, locale), qty(r.baseOutputQty, r.outputUnit), money(c.inputCost, locale), money(c.unitCost, locale), `${r.lines.length}`]; })}/></Card><Card title={L(locale, 'Semi-finished inventory balances', 'أرصدة الأصناف نصف المصنعة')} icon={<Layers/>}><Table headers={[L(locale, 'Store', 'المخزن'), L(locale, 'Item', 'الصنف'), L(locale, 'Qty', 'الكمية'), L(locale, 'Avg cost', 'متوسط التكلفة'), L(locale, 'Value', 'القيمة')]} rows={state.stores.flatMap((store) => state.items.filter((item) => item.isSemiFinished).map((item) => { const bal = getBalance(state, store.id, item.id); const cost = getAveragePurchaseCost(state, item.id); return [L(locale, store.nameEn, store.nameAr), L(locale, item.nameEn, item.nameAr), qty(bal, item.purchaseUnit), money(cost, locale), money(bal * cost, locale)]; }))}/></Card></div>}
  </div>;
}


function SalesPage({ state, update, locale }: { state: ERPState; update: (fn: (s: ERPState) => ERPState, success?: string) => void; locale: Locale }) {
  return <ModuleSuspense label={L(locale, 'Loading sales workspace', 'تحميل مساحة المبيعات')}><FoodicsSalesPage state={state} update={update as any} locale={locale} /></ModuleSuspense>;
}

function ledgerLines(state: ERPState) {
  return state.journals
    .filter((j) => j.status === 'posted')
    .flatMap((j) => j.lines.map((line) => ({ journal: j, line })))
    .sort((a, b) => `${a.journal.date}-${a.journal.ref}`.localeCompare(`${b.journal.date}-${b.journal.ref}`));
}
function naturalTrialSide(acc: ChartAccount, balance: number) {
  const debitNature = acc.type === 'asset' || acc.type === 'expense' || acc.type === 'cogs' || acc.type === 'other_expense';
  if (debitNature) return { debit: Math.max(balance, 0), credit: Math.max(-balance, 0) };
  return { debit: Math.max(-balance, 0), credit: Math.max(balance, 0) };
}
function statementGroup(state: ERPState, types: AccountType[]) {
  return accountBalances(state).filter((b) => types.includes(b.acc.type) && Math.abs(b.balance) > 0.004);
}
function accountTypeLabel(type: AccountType, locale: Locale) {
  const labels: Record<AccountType, [string, string]> = {
    asset: ['Asset', 'أصل'], liability: ['Liability', 'التزام'], equity: ['Equity', 'حقوق ملكية'], revenue: ['Revenue', 'إيراد'],
    cogs: ['COGS', 'تكلفة مبيعات'], expense: ['Expense', 'مصروف'], other_income: ['Other Income', 'إيراد آخر'], other_expense: ['Other Expense', 'مصروف آخر'],
  };
  return L(locale, labels[type][0], labels[type][1]);
}
function supplierAgingRows(state: ERPState) {
  const todayTime = new Date(today()).getTime();
  return state.suppliers.map((sup) => {
    const invoices = state.purchaseInvoices.filter((p) => p.supplierId === sup.id && p.status !== 'cancelled');
    const invTotal = invoices.reduce((s, p) => s + invoiceTotals(p).total, 0);
    const paid = invoices.reduce((s, p) => s + (p.paymentType === 'credit' ? 0 : p.paymentType === 'partial' ? p.paidAmount : invoiceTotals(p).total), 0) + state.supplierPayments.filter((p) => p.supplierId === sup.id && p.status === 'posted').reduce((s, p) => s + p.amount, 0);
    const buckets = { current: 0, d30: 0, d60: 0, d90: 0 };
    invoices.forEach((p) => {
      const balance = invoiceTotals(p).total - (p.paymentType === 'credit' ? 0 : p.paymentType === 'partial' ? p.paidAmount : invoiceTotals(p).total);
      const ageDays = Math.max(0, Math.floor((todayTime - new Date(p.invoiceDate).getTime()) / 86400000));
      if (ageDays <= 30) buckets.current += balance; else if (ageDays <= 60) buckets.d30 += balance; else if (ageDays <= 90) buckets.d60 += balance; else buckets.d90 += balance;
    });
    return { sup, invTotal, paid, balance: invTotal - paid, ...buckets };
  }).filter((r) => Math.abs(r.invTotal) > 0.004 || Math.abs(r.balance) > 0.004);
}
function customerAgingRows(state: ERPState) {
  const todayTime = new Date(today()).getTime();
  return state.arInvoices.map((a) => {
    const balance = a.amount - a.paidAmount;
    const ageDays = Math.max(0, Math.floor((todayTime - new Date(a.date).getTime()) / 86400000));
    return { invoice: a, balance, current: ageDays <= 30 ? balance : 0, d30: ageDays > 30 && ageDays <= 60 ? balance : 0, d60: ageDays > 60 && ageDays <= 90 ? balance : 0, d90: ageDays > 90 ? balance : 0 };
  }).filter((r) => Math.abs(r.invoice.amount) > 0.004 || Math.abs(r.balance) > 0.004);
}
function branchFinancialRows(state: ERPState) {
  return state.branches.map((branch) => {
    const lines = ledgerLines(state).filter(({ line }) => line.branchId === branch.id);
    const byType = (types: AccountType[]) => lines.filter(({ line }) => types.includes(state.chartAccounts.find((a) => a.code === line.accountCode)?.type ?? 'asset')).reduce((sum, { line }) => {
      const acc = state.chartAccounts.find((a) => a.code === line.accountCode);
      return sum + signedAmount(acc, line.debit, line.credit);
    }, 0);
    const revenue = byType(['revenue', 'other_income']);
    const cogsValue = byType(['cogs']);
    const expense = byType(['expense', 'other_expense']);
    return { branch, revenue, cogs: cogsValue, expense, profit: revenue - cogsValue - expense };
  });
}
function costCenterFinancialRows(state: ERPState) {
  return state.costCenters.map((cc) => {
    const lines = ledgerLines(state).filter(({ line }) => line.costCenterId === cc.id);
    const byType = (types: AccountType[]) => lines.filter(({ line }) => types.includes(state.chartAccounts.find((a) => a.code === line.accountCode)?.type ?? 'asset')).reduce((sum, { line }) => {
      const acc = state.chartAccounts.find((a) => a.code === line.accountCode);
      return sum + signedAmount(acc, line.debit, line.credit);
    }, 0);
    const revenue = byType(['revenue', 'other_income']);
    const cogsValue = byType(['cogs']);
    const expense = byType(['expense', 'other_expense']);
    return { cc, revenue, cogs: cogsValue, expense, variance: cc.budget - expense, profit: revenue - cogsValue - expense };
  });
}

type ControlStatus = 'ok' | 'warning' | 'critical';
type ControlCheck = { area: string; check: string; status: ControlStatus; detail: string; action: string };
type LifecycleRow = { module: string; ref: string; status: string; amount: number; nextStep: string; owner: string; tone: 'neutral' | 'good' | 'warn' | 'bad' | 'info' };

function statusTone(status: string): 'neutral' | 'good' | 'warn' | 'bad' | 'info' {
  const s = status.toLowerCase();
  if (['posted', 'paid', 'closed', 'matched', 'converted'].some((x) => s.includes(x))) return 'good';
  if (['approved', 'received', 'partially_received', 'submitted'].some((x) => s.includes(x))) return 'info';
  if (['draft', 'pending', 'open'].some((x) => s.includes(x))) return 'warn';
  if (['rejected', 'cancelled', 'reversed', 'blocked'].some((x) => s.includes(x))) return 'bad';
  return 'neutral';
}
function journalIntegrity(state: ERPState) { return state.journals.map((j) => ({ journal: j, ...journalBalance(j) })); }
function documentLifecycleRows(state: ERPState, locale: Locale): LifecycleRow[] {
  const rows: LifecycleRow[] = [];
  state.materialRequests.forEach((doc) => rows.push({ module: L(locale, 'Material Request', 'طلب مواد'), ref: doc.ref, status: doc.status, amount: 0, nextStep: doc.status === 'submitted' ? L(locale, 'Approve or reject request', 'اعتماد أو رفض الطلب') : doc.status === 'approved' ? L(locale, 'Convert to purchase order', 'تحويل إلى أمر شراء') : doc.status === 'converted' ? L(locale, 'Already converted', 'تم التحويل') : L(locale, 'Submit request', 'إرسال الطلب'), owner: doc.requestedBy || '—', tone: statusTone(doc.status) }));
  state.purchaseOrders.forEach((doc) => rows.push({ module: L(locale, 'Purchase Order', 'أمر شراء'), ref: doc.ref, status: doc.status, amount: doc.lines.reduce((sum, l) => sum + l.qty * l.unitCost, 0), nextStep: doc.status === 'approved' ? L(locale, 'Receive goods / GRN', 'استلام البضائع') : doc.status === 'received' ? L(locale, 'Match supplier invoice', 'مطابقة فاتورة المورد') : doc.status === 'closed' ? L(locale, 'Closed', 'مغلق') : L(locale, 'Approve PO', 'اعتماد أمر الشراء'), owner: supplierName(state, doc.supplierId), tone: statusTone(doc.status) }));
  state.goodsReceipts.forEach((doc) => rows.push({ module: L(locale, 'Goods Receipt', 'استلام بضائع'), ref: doc.ref, status: doc.status, amount: doc.lines.reduce((sum, l) => sum + l.qty * l.unitCost, 0), nextStep: doc.status === 'posted' ? L(locale, 'Await supplier invoice matching', 'بانتظار مطابقة فاتورة المورد') : L(locale, 'Post GRN', 'ترحيل الاستلام'), owner: supplierName(state, doc.supplierId), tone: statusTone(doc.status) }));
  state.purchaseInvoices.forEach((doc) => rows.push({ module: L(locale, 'Supplier Invoice', 'فاتورة مورد'), ref: doc.ref, status: doc.status, amount: invoiceTotals(doc).total, nextStep: doc.status === 'posted' ? L(locale, 'Schedule payment', 'جدولة السداد') : L(locale, 'Match and post', 'مطابقة وترحيل'), owner: supplierName(state, doc.supplierId), tone: statusTone(doc.status) }));
  state.supplierPayments.forEach((doc) => rows.push({ module: L(locale, 'Supplier Payment', 'سداد مورد'), ref: doc.ref, status: doc.status, amount: doc.amount, nextStep: doc.status === 'posted' ? L(locale, 'Reconcile bank', 'مطابقة البنك') : L(locale, 'Post payment voucher', 'ترحيل سند السداد'), owner: supplierName(state, doc.supplierId), tone: statusTone(doc.status) }));
  state.productions.forEach((doc) => rows.push({ module: L(locale, 'Production Batch', 'دفعة إنتاج'), ref: doc.ref, status: doc.status, amount: doc.lines.reduce((sum, l) => sum + l.actualQty * getAveragePurchaseCost(state, l.itemId), 0), nextStep: doc.status === 'posted' ? L(locale, 'Consume through sales recipe', 'الاستهلاك عبر وصفة البيع') : L(locale, 'Approve and post production', 'اعتماد وترحيل الإنتاج'), owner: storeName(state, doc.destinationStoreId, locale), tone: statusTone(doc.status) }));
  state.sales.forEach((doc) => rows.push({ module: L(locale, 'Sales / POS Batch', 'دفعة مبيعات / كاشير'), ref: doc.ref, status: doc.posted ? 'posted' : 'draft', amount: calculateSalesAmounts(state.menuItems.find((m) => m.id === doc.menuItemId), doc.qty).grossSales, nextStep: doc.posted ? L(locale, 'Reconcile cash/card', 'مطابقة النقد/البطاقات') : L(locale, 'Validate and post', 'تحقق وترحيل'), owner: branchName(state, doc.branchId, locale), tone: doc.posted ? 'good' : 'warn' }));
  state.journals.forEach((doc) => rows.push({ module: L(locale, 'Journal Entry', 'قيد يومية'), ref: doc.ref, status: doc.status, amount: journalBalance(doc).debit, nextStep: doc.status === 'draft' ? L(locale, 'Review and post', 'مراجعة وترحيل') : doc.status === 'posted' ? L(locale, 'Available for reversal/period close', 'متاح للعكس/قفل الفترة') : L(locale, 'Reversed', 'معكوس'), owner: doc.source, tone: statusTone(doc.status) }));
  return rows.sort((a, b) => a.module.localeCompare(b.module) || a.ref.localeCompare(b.ref));
}
function coreControlChecks(state: ERPState, totals: Totals, locale: Locale): ControlCheck[] {
  const badJournals = journalIntegrity(state).filter((r) => !r.balanced);
  const postedBad = badJournals.filter((r) => r.journal.status === 'posted');
  const lockedPosted = state.journals.filter((j) => j.status === 'posted' && isDateLocked(state, j.date));
  const grni = accountTotal(state, '2110');
  const ap = accountTotal(state, '2100');
  const invSub = getStockValue(state);
  const invGL = accountTotal(state, '1300') + accountTotal(state, '1310');
  const available = availableRows(state);
  const zeroCost = available.filter((r) => r.onHand > 0 && r.cost <= 0.0001);
  const negative = available.filter((r) => r.available < -0.0001 || r.onHand < -0.0001);
  const missingRecipe = state.menuItems.filter((m) => !state.recipeLines.some((r) => r.menuItemId === m.id));
  const unmatchedSales = state.sales.filter((sale) => sale.posted && !state.journals.some((j) => j.ref === sale.ref));
  const unmatchedPurchases = state.purchaseInvoices.filter((inv) => inv.status === 'posted' && !state.journals.some((j) => j.ref === inv.ref));
  const grnNotInvoiced = Math.max(0, state.goodsReceipts.filter((g) => g.status === 'posted').length - state.purchaseInvoices.filter((i) => i.status === 'posted').length);
  return [
    { area: L(locale, 'Accounting', 'المحاسبة'), check: L(locale, 'All journal entries are balanced', 'جميع القيود متوازنة'), status: postedBad.length ? 'critical' : badJournals.length ? 'warning' : 'ok', detail: `${postedBad.length} posted / ${badJournals.length} total`, action: L(locale, 'Review Journal Register', 'راجع سجل القيود') },
    { area: L(locale, 'Accounting', 'المحاسبة'), check: L(locale, 'Locked period protection', 'حماية الفترات المقفلة'), status: lockedPosted.length ? 'warning' : 'ok', detail: `${lockedPosted.length} entries inside locked periods`, action: L(locale, 'Use reversal after lock', 'استخدم القيود العكسية بعد القفل') },
    { area: L(locale, 'Purchasing', 'المشتريات'), check: L(locale, 'GRNI under control', 'رقابة البضائع غير المفوترة'), status: Math.abs(grni) > 10000 ? 'warning' : 'ok', detail: money(grni, locale), action: L(locale, 'Match supplier invoices to GRNs', 'طابق فواتير الموردين مع الاستلام') },
    { area: L(locale, 'Purchasing', 'المشتريات'), check: L(locale, 'Supplier AP balance visible', 'رصيد الموردين ظاهر'), status: ap < -0.01 ? 'critical' : 'ok', detail: money(ap, locale), action: L(locale, 'Run AP aging and payments', 'راجع أعمار الذمم ودفعات الموردين') },
    { area: L(locale, 'Inventory', 'المخزون'), check: L(locale, 'Inventory subledger vs GL', 'مطابقة دفتر المخزون مع الأستاذ'), status: Math.abs(invSub - invGL) > 5 ? 'warning' : 'ok', detail: `${money(invSub, locale)} / ${money(invGL, locale)}`, action: L(locale, 'Use Inventory → Reconciliation', 'استخدم المخزون ← المطابقة') },
    { area: L(locale, 'Inventory', 'المخزون'), check: L(locale, 'No zero-cost stock after purchases', 'لا توجد أرصدة بدون تكلفة بعد الشراء'), status: zeroCost.length ? 'warning' : 'ok', detail: `${zeroCost.length} rows`, action: L(locale, 'Post purchase prices or investigate opening stock', 'رحّل أسعار الشراء أو راجع الافتتاحي') },
    { area: L(locale, 'Inventory', 'المخزون'), check: L(locale, 'Available stock is not negative', 'الرصيد المتاح غير سالب'), status: negative.length ? 'critical' : 'ok', detail: `${negative.length} rows`, action: L(locale, 'Review source store and reservations', 'راجع مخزن المصدر والحجوزات') },
    { area: L(locale, 'Recipes', 'الوصفات'), check: L(locale, 'All menu items have recipes', 'كل أصناف البيع لها وصفات'), status: missingRecipe.length ? 'warning' : 'ok', detail: `${missingRecipe.length} menu items`, action: L(locale, 'Open Setup → Recipes', 'افتح الإعداد ← الوصفات') },
    { area: L(locale, 'Sales', 'المبيعات'), check: L(locale, 'Posted sales have accounting journals', 'المبيعات المرحلة لها قيود'), status: unmatchedSales.length ? 'critical' : 'ok', detail: `${unmatchedSales.length} sales batches`, action: L(locale, 'Repair links or reverse/repost', 'إصلاح الربط أو عكس/إعادة الترحيل') },
    { area: L(locale, 'Purchasing', 'المشتريات'), check: L(locale, 'Posted invoices have accounting journals', 'الفواتير المرحلة لها قيود'), status: unmatchedPurchases.length ? 'critical' : 'ok', detail: `${unmatchedPurchases.length} invoices`, action: L(locale, 'Repair links or reverse/repost', 'إصلاح الربط أو عكس/إعادة الترحيل') },
    { area: L(locale, 'Purchasing', 'المشتريات'), check: L(locale, 'Open GRNs awaiting invoice', 'استلامات مفتوحة بانتظار الفاتورة'), status: grnNotInvoiced > 3 ? 'warning' : 'ok', detail: `${grnNotInvoiced} documents`, action: L(locale, 'Use Invoice Matching', 'استخدم مطابقة الفواتير') },
    { area: L(locale, 'Finance', 'المالية'), check: L(locale, 'Business remains solvent in trial data', 'السيولة إيجابية في بيانات التجربة'), status: totals.cash < 0 ? 'critical' : totals.cash < totals.ap * 0.1 ? 'warning' : 'ok', detail: `${money(totals.cash, locale)} cash / ${money(totals.ap, locale)} AP`, action: L(locale, 'Review Banking and AP payment run', 'راجع البنوك ودفعات الموردين') },
  ];
}
function controlScoreFromChecks(checks: ControlCheck[]) { const max = checks.length * 10; const lost = checks.reduce((sum, c) => sum + (c.status === 'critical' ? 10 : c.status === 'warning' ? 4 : 0), 0); return Math.max(0, Math.round(((max - lost) / Math.max(max, 1)) * 100)); }
function repairCoreLinks(state: ERPState): ERPState {
  let next = { ...state };
  const journals = [...next.journals];
  next.purchaseInvoices.filter((inv) => inv.status === 'posted' && !journals.some((j) => j.ref === inv.ref)).forEach((inv) => journals.push(buildPurchaseJournal(next, inv)));
  next.sales.filter((sale) => sale.posted && !journals.some((j) => j.ref === sale.ref)).forEach((sale) => {
    const recipeLines = next.recipeLines.filter((line) => line.menuItemId === sale.menuItemId);
    const existingMoves = next.stockMovements.some((m) => m.ref === sale.ref && m.type === 'sales_consumption');
    let foodCost = 0;
    if (!existingMoves) {
      const moves = recipeLines.map((r) => { const cost = getAveragePurchaseCost(next, r.itemId); foodCost += r.qty * sale.qty * cost; return { id: id('MOV'), date: sale.date, type: 'sales_consumption', storeId: sale.storeId, itemId: r.itemId, direction: 'out' as Direction, qty: r.qty * sale.qty, unitCost: cost, ref: sale.ref, note: 'Auto-repaired recipe consumption' }; });
      next = { ...next, stockMovements: [...next.stockMovements, ...moves] };
    } else { foodCost = next.stockMovements.filter((m) => m.ref === sale.ref && m.type === 'sales_consumption').reduce((sum, m) => sum + m.qty * m.unitCost, 0); }
    journals.push(buildSalesJournal(next, sale, foodCost));
  });
  next.supplierPayments.filter((pay) => pay.status === 'posted' && !journals.some((j) => j.ref === pay.ref)).forEach((pay) => journals.push({ id: id('JE'), date: pay.date, ref: pay.ref, source: 'supplier_payment', description: `Supplier payment ${supplierName(next, pay.supplierId)}`, status: 'posted', lines: [ { id: id('JL'), accountCode: '2100', debit: pay.amount, credit: 0, branchId: 'company', costCenterId: 'company', memo: supplierName(next, pay.supplierId) }, { id: id('JL'), accountCode: pay.accountCode, debit: 0, credit: pay.amount, branchId: 'company', costCenterId: 'company', memo: pay.method } ] }));
  next.productions.filter((doc) => doc.status === 'posted' && !journals.some((j) => j.ref === doc.ref)).forEach((doc) => { const inputCost = doc.lines.reduce((sum, line) => sum + line.actualQty * getAveragePurchaseCost(next, line.itemId), 0); journals.push({ id: id('JE'), date: doc.date, ref: doc.ref, source: 'production', description: `Production batch ${doc.ref}`, status: 'posted', lines: [ { id: id('JL'), accountCode: '1310', debit: inputCost, credit: 0, branchId: state.stores.find((s) => s.id === doc.destinationStoreId)?.branchId ?? 'company', costCenterId: 'company', memo: 'Semi-finished inventory' }, { id: id('JL'), accountCode: '1300', debit: 0, credit: inputCost, branchId: state.stores.find((s) => s.id === doc.sourceStoreId)?.branchId ?? 'company', costCenterId: 'company', memo: 'Raw material inventory consumed' } ] }); });
  next = { ...next, journals };
  return addAudit(next, 'repair', 'control_center', 'V20-REPAIR', 'Control Center rebuilt missing local trial accounting/stock links where safe');
}
function makeReversalJournal(journal: JournalEntry): JournalEntry {
  return {
    id: id('JE'), date: today(), ref: `REV-${journal.ref}`, source: 'reversal', description: `Reversal of ${journal.ref}: ${journal.description}`, status: 'posted',
    lines: journal.lines.map((line) => ({ ...line, id: id('JL'), debit: line.credit, credit: line.debit, memo: `Reverse: ${line.memo}` })),
  };
}


type EnterpriseHardeningRow = { area: string; control: string; status: 'ready' | 'partial' | 'missing'; detail: string; nextStep: string };
function hardeningRows(state: ERPState, totals: Totals, locale: Locale): EnterpriseHardeningRow[] {
  const lifecycle = documentLifecycleRows(state, locale);
  const permissionProtected = permissionCatalog.filter((p) => p.key.includes('post') || p.key.includes('approve') || p.key.includes('lock') || p.key.includes('manage')).length;
  const activeProfiles = state.importProfiles.length;
  const balanced = journalIntegrity(state).filter((r) => !r.balanced).length === 0;
  const available = availableRows(state);
  const negative = available.filter((r) => r.available < -0.0001).length;
  const zeroCost = available.filter((r) => r.onHand > 0 && r.cost <= 0.0001).length;
  const hasPeriods = state.fiscalPeriods.length > 0;
  const statementsReady = state.chartAccounts.length > 20 && state.journals.some((j) => j.status === 'posted');
  return [
    { area: L(locale, 'Security', 'الأمن'), control: L(locale, 'Permission catalog for sensitive actions', 'كتالوج صلاحيات للإجراءات الحساسة'), status: permissionProtected >= 12 ? 'ready' : 'partial', detail: `${permissionProtected} guarded permission keys`, nextStep: L(locale, 'Keep enforcing every post/approve/reverse/deactivate button', 'استمر بفرض الصلاحية على كل زر ترحيل/اعتماد/عكس/تعطيل') },
    { area: L(locale, 'Accounting', 'المحاسبة'), control: L(locale, 'Balanced ledger', 'أستاذ متوازن'), status: balanced ? 'ready' : 'missing', detail: balanced ? L(locale, 'No unbalanced journals detected', 'لا توجد قيود غير متوازنة') : L(locale, 'Unbalanced journals detected', 'توجد قيود غير متوازنة'), nextStep: L(locale, 'Use Finance → Journal Register', 'استخدم المالية ← سجل القيود') },
    { area: L(locale, 'Accounting', 'المحاسبة'), control: L(locale, 'Fiscal periods and locks', 'الفترات والأقفال المالية'), status: hasPeriods ? 'ready' : 'missing', detail: `${state.fiscalPeriods.length} periods`, nextStep: L(locale, 'Create periods before real posting', 'أنشئ الفترات قبل الترحيل الحقيقي') },
    { area: L(locale, 'Accounting', 'المحاسبة'), control: L(locale, 'Financial statement pack', 'حزمة القوائم المالية'), status: statementsReady ? 'ready' : 'partial', detail: L(locale, 'Trial balance, P&L, balance sheet, cash flow summary', 'ميزان مراجعة، دخل، مركز مالي، تدفقات نقدية مختصرة'), nextStep: L(locale, 'Add comparative periods and Excel/PDF export', 'أضف فترات مقارنة وتصدير Excel/PDF') },
    { area: L(locale, 'Inventory', 'المخزون'), control: L(locale, 'Available stock discipline', 'انضباط الرصيد المتاح'), status: negative ? 'missing' : 'ready', detail: `${negative} negative available rows`, nextStep: L(locale, 'Block negative issue/transfer before production use', 'امنع الصرف/التحويل السالب قبل الاستخدام') },
    { area: L(locale, 'Inventory', 'المخزون'), control: L(locale, 'Average cost from purchases', 'متوسط تكلفة من الشراء'), status: zeroCost ? 'partial' : 'ready', detail: `${zeroCost} zero-cost rows`, nextStep: L(locale, 'Post purchase prices or classify opening stock', 'رحّل أسعار الشراء أو صنف المخزون الافتتاحي') },
    { area: L(locale, 'Purchasing', 'المشتريات'), control: L(locale, 'Document lifecycle coverage', 'تغطية دورة حياة المستند'), status: lifecycle.length ? 'ready' : 'partial', detail: `${lifecycle.length} documents tracked`, nextStep: L(locale, 'Add partial receiving, backorders, variance approvals', 'أضف الاستلام الجزئي والمرتجعات واعتمادات الفروقات') },
    { area: L(locale, 'Import', 'الاستيراد'), control: L(locale, 'Saved mapping profiles', 'خرائط استيراد محفوظة'), status: activeProfiles ? 'ready' : 'partial', detail: `${activeProfiles} profiles`, nextStep: L(locale, 'Connect XLSX parser and rollback once backend exists', 'اربط محلل XLSX والتراجع بعد وجود الخلفية') },
    { area: L(locale, 'Backend', 'الخلفية'), control: L(locale, 'Production persistence', 'استمرارية تشغيلية'), status: 'missing', detail: L(locale, 'Local browser storage only', 'تخزين متصفح محلي فقط'), nextStep: L(locale, 'Move posting engines to Supabase RPC/Edge Functions', 'انقل محركات الترحيل إلى Supabase RPC/Edge Functions') },
    { area: L(locale, 'UX', 'واجهة المستخدم'), control: L(locale, 'Document preview and print pack', 'معاينة وطباعة المستندات'), status: 'partial', detail: L(locale, 'Printable pack designed in Control Center', 'تم تصميم حزمة الطباعة في مركز الرقابة'), nextStep: L(locale, 'Generate real PDF/print layouts for PO/GRN/invoice/vouchers', 'إنشاء قوالب PDF/طباعة لأمر الشراء والاستلام والفواتير والسندات') },
  ];
}
function hardeningScore(rows: EnterpriseHardeningRow[]) {
  const weights: number[] = rows.map((r) => r.status === 'ready' ? 10 : r.status === 'partial' ? 5 : 0);
  return Math.round(weights.reduce((s, v) => s + v, 0) / Math.max(rows.length * 10, 1) * 100);
}
function supplierSpendRows(state: ERPState) {
  return state.suppliers.map((sup) => {
    const invoices = state.purchaseInvoices.filter((i) => i.supplierId === sup.id);
    const spend = invoices.reduce((s, inv) => s + invoiceTotals(inv).total, 0);
    const paid = state.supplierPayments.filter((p) => p.supplierId === sup.id && p.status === 'posted').reduce((s, p) => s + p.amount, 0);
    return { sup, invoices: invoices.length, spend, paid, balance: Math.max(0, spend - paid) };
  }).filter((r) => r.invoices || r.spend || r.paid).sort((a, b) => b.spend - a.spend);
}
function recipeProfitabilityRows(state: ERPState, locale: Locale) {
  return state.menuItems.map((menu) => {
    const cost = recipeCost(state, menu.id);
    const amounts = calculateSalesAmounts(menu, 1);
    const margin = amounts.netSales - cost;
    const foodCostPct = amounts.netSales ? cost / amounts.netSales * 100 : 0;
    return { menu, cost, netSales: amounts.netSales, margin, foodCostPct, label: `${menu.code} - ${L(locale, menu.nameEn, menu.nameAr)}` };
  }).sort((a, b) => b.margin - a.margin);
}
function documentPackRows(locale: Locale) {
  return [
    { doc: L(locale, 'Purchase Order', 'أمر شراء'), status: L(locale, 'Designed', 'مصمم'), controls: L(locale, 'supplier, lines, VAT, approval, terms, signatures', 'مورد، بنود، ضريبة، اعتماد، شروط، توقيعات') },
    { doc: L(locale, 'GRN / Goods Receipt', 'استلام بضائع'), status: L(locale, 'Designed', 'مصمم'), controls: L(locale, 'PO link, lot, bin, expiry, receiving user', 'ربط أمر شراء، تشغيلة، موقع، صلاحية، مستخدم الاستلام') },
    { doc: L(locale, 'Supplier Invoice Match', 'مطابقة فاتورة مورد'), status: L(locale, 'Designed', 'مصمم'), controls: L(locale, 'PO vs GRN vs invoice value and VAT', 'أمر شراء مقابل استلام مقابل فاتورة وقيمة وضريبة') },
    { doc: L(locale, 'Payment Voucher', 'سند صرف'), status: L(locale, 'Designed', 'مصمم'), controls: L(locale, 'invoice allocation, bank/cash, approval, receipt reference', 'تخصيص فاتورة، بنك/نقد، اعتماد، مرجع إيصال') },
    { doc: L(locale, 'Manual Journal Voucher', 'سند قيد يومية'), status: L(locale, 'Designed', 'مصمم'), controls: L(locale, 'balanced lines, attachments, reviewer, reversal reason', 'بنود متوازنة، مرفقات، مراجع، سبب عكس') },
    { doc: L(locale, 'Stock Count Variance', 'فرق جرد'), status: L(locale, 'Designed', 'مصمم'), controls: L(locale, 'system qty, counted qty, variance, approval, cost center', 'كمية نظامية، كمية معدودة، فرق، اعتماد، مركز تكلفة') },
  ];
}
function backendMigrationRows(locale: Locale) {
  return [
    [L(locale, 'Auth', 'المصادقة'), L(locale, 'Supabase auth + profile bootstrap + custom roles', 'مصادقة Supabase + تهيئة ملف مستخدم + أدوار مخصصة')],
    [L(locale, 'Database', 'قاعدة البيانات'), L(locale, 'PostgreSQL tables for every document + status + audit', 'جداول PostgreSQL لكل مستند + حالة + تدقيق')],
    [L(locale, 'RLS', 'أمان الصفوف'), L(locale, 'Branch/store/cost-center scoped policies', 'سياسات حسب الفرع/المخزن/مركز التكلفة')],
    [L(locale, 'Posting', 'الترحيل'), L(locale, 'RPC functions for journals, inventory cost, GRN, sales, production', 'دوال RPC للقيود وتكلفة المخزون والاستلام والمبيعات والإنتاج')],
    [L(locale, 'Files', 'الملفات'), L(locale, 'Storage buckets for invoices, delivery notes, vouchers, HR documents', 'مخازن ملفات للفواتير والإشعارات والسندات ومستندات الموظفين')],
    [L(locale, 'Imports', 'الاستيراد'), L(locale, 'Edge Function XLSX parser + validation + rollback', 'Edge Function لتحليل XLSX والتحقق والتراجع')],
    [L(locale, 'Audit', 'التدقيق'), L(locale, 'DB triggers for immutable audit events', 'مشغلات قاعدة بيانات لأحداث تدقيق غير قابلة للتعديل')],
    [L(locale, 'Backup', 'النسخ الاحتياطي'), L(locale, 'scheduled exports + restore drills', 'تصدير مجدول + اختبارات استعادة')],
  ];
}

function FinancePage({ state, totals, update, locale }: { state: ERPState; totals: Totals; update: (fn: (s: ERPState) => ERPState, success?: string) => void; locale: Locale }) {
  const [tab, setTab] = useState<FinanceTab>('dashboard');
  const tabIcons: Record<string, ReactNode> = {
    dashboard: <LayoutDashboard size={16}/>, book: <BookOpen size={16}/>, edit: <Edit3 size={16}/>, file: <FileText size={16}/>, database: <Database size={16}/>, calculator: <Calculator size={16}/>, pie: <PieChart size={16}/>, landmark: <Landmark size={16}/>, banknote: <Banknote size={16}/>, wallet: <Wallet size={16}/>, coins: <Coins size={16}/>, creditCard: <CreditCard size={16}/>, shield: <ShieldCheck size={16}/>, building: <Building2 size={16}/>, refresh: <RefreshCw size={16}/>, receipt: <ReceiptText size={16}/>, store: <Store size={16}/>, layers: <Layers size={16}/>, plus: <Plus size={16}/>, clipboard: <ClipboardCheck size={16}/>, checks: <ListChecks size={16}/>,
  };
  return <div className="page-grid finance-workspace">
    <Card title={L(locale, 'Enterprise accounting workspace', 'مساحة المحاسبة المؤسسية')} icon={<Landmark/>}>
      <div className="notice">{L(locale, 'Finance is now treated as the ERP posting truth engine: every source module must post through a contract, validation batch, and reconciled ledger line before it becomes trusted financial data.', 'أصبحت المالية طبقة الحقيقة للترحيل: كل موديول مصدر يجب أن يمر بعقد ترحيل ودفعة تحقق وسطر أستاذ مطابق قبل اعتباره بيانات مالية موثوقة.')}</div>
      <div className="finance-tab-grid">{financeTabDefinitions.map((t) => <button key={t.key} className={tab === t.key ? 'active-tab' : ''} onClick={() => setTab(t.key)}>{tabIcons[t.icon]}{L(locale, t.en, t.ar)}</button>)}</div>
    </Card>
    <FinanceTruthLayerPanel state={state} locale={locale} />
    {tab === 'dashboard' && <AccountingDashboard state={state} totals={totals} locale={locale}/>}
    {tab === 'coa' && <ChartAccountsPage state={state} update={update} locale={locale}/>}
    {tab === 'manual' && <ManualJournalPage state={state} update={update} locale={locale}/>}
    {tab === 'journals' && <JournalRegisterPage state={state} update={update} locale={locale}/>}
    {tab === 'gl' && <GeneralLedgerPage state={state} locale={locale}/>}
    {tab === 'trial' && <TrialBalancePage state={state} locale={locale}/>}
    {tab === 'income' && <IncomeStatementPage state={state} totals={totals} locale={locale}/>}
    {tab === 'balance' && <BalanceSheetPage state={state} totals={totals} locale={locale}/>}
    {tab === 'cashflow' && <CashFlowPage state={state} locale={locale}/>}
    {tab === 'ap' && <APPage state={state} locale={locale}/>}
    {tab === 'paymentRun' && <APPaymentRunPage state={state} update={update} locale={locale}/>}
    {tab === 'supplierStatement' && <SupplierStatementPage state={state} locale={locale}/>}
    {tab === 'ar' && <ARPage state={state} update={update} locale={locale}/>}
    {tab === 'banking' && <BankingPage state={state} totals={totals} locale={locale}/>}
    {tab === 'reconciliation' && <BankReconciliationPage state={state} update={update} locale={locale}/>}
    {tab === 'assets' && <AssetsPage state={state} update={update} locale={locale}/>}
    {tab === 'depreciation' && <DepreciationRunPage state={state} update={update} locale={locale}/>}
    {tab === 'vat' && <VATPage state={state} totals={totals} locale={locale}/>}
    {tab === 'branchPnl' && <BranchPnlPage state={state} locale={locale}/>}
    {tab === 'costCenter' && <CostCenterFinancePage state={state} locale={locale}/>}
    {tab === 'opening' && <OpeningBalancesPage state={state} update={update} locale={locale}/>}
    {tab === 'periods' && <PeriodsPage state={state} update={update} locale={locale}/>}
    {tab === 'controls' && <FinanceControlsPage state={state} locale={locale}/>}
    {tab === 'postingRules' && <PostingRulesPage locale={locale}/>}
  </div>;
}


function FinanceTruthLayerPanel({ state, locale }: { state: ERPState; locale: Locale }) {
  const truth = evaluateFinanceTruthLayer(state);
  return <div className="two-col truth-layer-grid">
    <Card title={L(locale, 'Finance Truth Layer', 'طبقة الحقيقة المالية')} icon={<ShieldCheck/>}>
      <div className="kpi-grid compact-kpis">
        <KPI label={L(locale, 'Truth score', 'درجة الحقيقة')} value={`${truth.truthScore}%`} hint={L(locale, 'Ledger + source contract confidence', 'ثقة الأستاذ وعقود المصدر')} icon={<ClipboardCheck/>}/>
        <KPI label={L(locale, 'Balanced posted batches', 'دفعات مرحلة متوازنة')} value={`${truth.balancedJournals}/${truth.postedJournals}`} hint={L(locale, 'Debits equal credits', 'المدين يساوي الدائن')} icon={<Calculator/>}/>
        <KPI label={L(locale, 'Source coverage', 'تغطية المصادر')} value={`${truth.sourceCoveragePct}%`} hint={L(locale, 'Finance, POS, purchase, inventory, production, bank', 'المالية والكاشير والمشتريات والمخزون والإنتاج والبنك')} icon={<Database/>}/>
      </div>
      <Table headers={[L(locale, 'Severity', 'الخطورة'), L(locale, 'Area', 'المجال'), L(locale, 'Finding', 'الملاحظة'), L(locale, 'Required action', 'الإجراء المطلوب')]} rows={truth.findings.map((finding) => [<StockPill tone={finding.severity === 'critical' ? 'bad' : finding.severity === 'warning' ? 'warn' : 'good'}>{finding.severity}</StockPill>, finding.area, finding.issue, finding.action])}/>
    </Card>
    <Card title={L(locale, 'Posting contracts registered', 'عقود الترحيل المسجلة')} icon={<ListChecks/>}>
      <Table headers={[L(locale, 'Contract', 'العقد'), L(locale, 'Source module', 'الموديول المصدر'), L(locale, 'Risk', 'المخاطر'), L(locale, 'Controls', 'الضوابط')]} rows={FINANCE_POSTING_CONTRACTS.map((contract) => [contract.key.replace(/_/g, ' '), contract.sourceModule, <StockPill tone={contract.riskLevel === 'critical' ? 'bad' : contract.riskLevel === 'high' ? 'warn' : 'info'}>{contract.riskLevel}</StockPill>, contract.requiredControls.join(', ')])}/>
    </Card>
  </div>;
}

function AccountingDashboard({ state, totals, locale }: { state: ERPState; totals: Totals; locale: Locale }) {
  const posted = state.journals.filter((j) => j.status === 'posted');
  const draft = state.journals.filter((j) => j.status === 'draft');
  const unbalanced = state.journals.filter((j) => !journalBalance(j).balanced);
  const currentRatio = totals.liabilities ? totals.assets / totals.liabilities : 0;
  const gpPct = totals.salesNet ? (totals.grossProfit / totals.salesNet) * 100 : 0;
  return <div className="page-grid">
    <div className="kpi-grid">
      <KPI label={L(locale, 'Posted journals', 'قيود مرحلة')} value={`${posted.length}`} hint={L(locale, 'All sources', 'جميع المصادر')} icon={<FileText/>}/>
      <KPI label={L(locale, 'Draft journals', 'قيود مسودة')} value={`${draft.length}`} hint={L(locale, 'Need review/posting', 'تحتاج مراجعة/ترحيل')} icon={<Edit3/>}/>
      <KPI label={L(locale, 'Current ratio', 'نسبة التداول')} value={currentRatio ? `${currentRatio.toFixed(2)}x` : '—'} hint={L(locale, 'Assets / liabilities', 'الأصول / الالتزامات')} icon={<Calculator/>}/>
      <KPI label={L(locale, 'Gross margin', 'هامش مجمل الربح')} value={`${gpPct.toFixed(1)}%`} hint={L(locale, 'Gross profit / sales', 'مجمل الربح / المبيعات')} icon={<PieChart/>}/>
      <KPI label={L(locale, 'Cash & banks', 'النقد والبنوك')} value={money(totals.cash, locale)} hint={L(locale, 'From posted ledger', 'من الأستاذ المرحل')} icon={<Banknote/>}/>
      <KPI label={L(locale, 'Supplier exposure', 'التزامات الموردين')} value={money(totals.ap, locale)} hint={L(locale, 'AP subledger', 'دفتر الذمم الدائنة')} icon={<Wallet/>}/>
      <KPI label={L(locale, 'VAT payable', 'ضريبة مستحقة')} value={money(totals.vatPayable, locale)} hint={L(locale, 'Output - input', 'مخرجات - مدخلات')} icon={<ReceiptText/>}/>
      <KPI label={L(locale, 'Control exceptions', 'ملاحظات رقابية')} value={`${unbalanced.length}`} hint={L(locale, 'Unbalanced journals', 'قيود غير متوازنة')} icon={<ShieldCheck/>}/>
    </div>
    <Card title={L(locale, 'Finance close readiness', 'جاهزية الإقفال المالي')} icon={<ClipboardCheck/>}>
      <div className="health-grid">
        <div className={`health ${state.chartAccounts.length > 20 ? 'ok' : 'bad'}`}>● {L(locale, 'Chart of accounts configured', 'دليل الحسابات مهيأ')}</div>
        <div className={`health ${unbalanced.length === 0 ? 'ok' : 'bad'}`}>● {L(locale, 'No unbalanced journals', 'لا توجد قيود غير متوازنة')}</div>
        <div className={`health ${draft.length === 0 ? 'ok' : 'bad'}`}>● {L(locale, 'No draft journals pending', 'لا توجد قيود مسودة معلقة')}</div>
        <div className={`health ${state.costCenters.length > 0 ? 'ok' : 'bad'}`}>● {L(locale, 'Cost centers available', 'مراكز التكلفة متوفرة')}</div>
      </div>
    </Card>
  </div>;
}

function ChartAccountsPage({ state, update, locale }: { state: ERPState; update: (fn: (s: ERPState) => ERPState, success?: string) => void; locale: Locale }) {
  const [acc, setAcc] = useState<ChartAccount>({ id: '', code: '', nameEn: '', nameAr: '', type: 'expense', active: true, requireCostCenter: false });
  const [filter, setFilter] = useState('');
  const rows = state.chartAccounts.filter((a) => `${a.code} ${a.nameEn} ${a.nameAr} ${a.type}`.toLowerCase().includes(filter.toLowerCase())).sort((a,b) => a.code.localeCompare(b.code));
  const save = () => acc.code && acc.nameEn && update((s) => addAudit({ ...s, chartAccounts: upsert(s.chartAccounts, { ...acc, id: acc.id || id('ACC'), active: true }) }, acc.id ? 'edit' : 'create', 'account', acc.code, 'Chart account saved'), L(locale, 'Account saved', 'تم حفظ الحساب'));
  return <div className="page-grid">
    <Card title={L(locale, 'Chart of accounts', 'دليل الحسابات')} icon={<BookOpen/>} action={<button onClick={() => update((s) => addAudit({ ...s, chartAccounts: defaultChartAccounts() }, 'load', 'coa', 'DEFAULT', 'Default restaurant COA loaded'), L(locale, 'Default COA loaded', 'تم تحميل دليل الحسابات الافتراضي'))}><RefreshCw size={16}/>{L(locale, 'Load restaurant COA', 'تحميل دليل مطاعم')}</button>}>
      <div className="form-grid">
        <Field label={L(locale, 'Code', 'الكود')}><input value={acc.code} onChange={(e) => setAcc({ ...acc, code: e.target.value })}/></Field>
        <Field label={L(locale, 'Name EN', 'الاسم إنجليزي')}><input value={acc.nameEn} onChange={(e) => setAcc({ ...acc, nameEn: e.target.value })}/></Field>
        <Field label={L(locale, 'Name AR', 'الاسم عربي')}><input value={acc.nameAr} onChange={(e) => setAcc({ ...acc, nameAr: e.target.value })}/></Field>
        <Field label={L(locale, 'Type', 'النوع')}><select value={acc.type} onChange={(e) => setAcc({ ...acc, type: e.target.value as AccountType })}>{['asset','liability','equity','revenue','cogs','expense','other_income','other_expense'].map((t) => <option key={t} value={t}>{accountTypeLabel(t as AccountType, locale)}</option>)}</select></Field>
        <label className="check"><input type="checkbox" checked={Boolean(acc.requireCostCenter)} onChange={(e) => setAcc({ ...acc, requireCostCenter: e.target.checked })}/>{L(locale, 'Require cost center', 'يتطلب مركز تكلفة')}</label>
      </div>
      <div className="button-row"><button onClick={save}><Save size={16}/>{L(locale, 'Save Account', 'حفظ الحساب')}</button><button onClick={() => setAcc({ id: '', code: '', nameEn: '', nameAr: '', type: 'expense', active: true, requireCostCenter: false })}><Plus size={16}/>{L(locale, 'New', 'جديد')}</button></div>
    </Card>
    <Card title={L(locale, 'Account list', 'قائمة الحسابات')} icon={<Search/>} action={<input className="mini-input" placeholder={L(locale, 'Search accounts...', 'بحث في الحسابات...')} value={filter} onChange={(e) => setFilter(e.target.value)}/>}>
      <Table headers={[L(locale, 'Code', 'الكود'), L(locale, 'Name', 'الاسم'), L(locale, 'Type', 'النوع'), L(locale, 'Cost Center', 'مركز تكلفة'), L(locale, 'Actions', 'إجراءات')]} rows={rows.map((a) => [a.code, L(locale, a.nameEn, a.nameAr), accountTypeLabel(a.type, locale), a.requireCostCenter ? L(locale, 'Required', 'مطلوب') : '—', actionButtons(() => setAcc(a), () => update((s) => addAudit({ ...s, chartAccounts: s.chartAccounts.map((x) => x.id === a.id ? { ...x, active: false } : x) }, 'delete', 'account', a.code, 'Account deleted'), L(locale, 'Account deleted', 'تم حذف الحساب')), locale)])}/>
    </Card>
  </div>;
}

function ManualJournalPage({ state, update, locale }: { state: ERPState; update: (fn: (s: ERPState) => ERPState, success?: string) => void; locale: Locale }) {
  const makeBlankJournal = (): JournalEntry => ({ id: '', date: today(), ref: `MAN-${String(state.journals.length + 1).padStart(5, '0')}`, source: 'manual', description: '', status: 'draft', lines: [makeJournalLine(), makeJournalLine()] });
  const [journal, setJournal] = useState<JournalEntry>(makeBlankJournal());
  const bal = journalBalance(journal);
  const missing = journal.lines.some((l) => !l.accountCode || (!l.debit && !l.credit));
  const postBlocked = requirePermission(state, 'finance.journal.post', undefined, locale) || (isDateLocked(state, journal.date) ? L(locale, 'Blocked: selected fiscal period is locked.', 'محجوب: الفترة المالية المختارة مقفلة.') : '');
  const addLine = () => setJournal({ ...journal, lines: [...journal.lines, makeJournalLine()] });
  const removeLine = (lineId: string) => setJournal({ ...journal, lines: journal.lines.length > 2 ? journal.lines.filter((l) => l.id !== lineId) : journal.lines });
  const save = (status: JournalStatus) => {
    if (!journal.ref || missing || !bal.balanced || (status === 'posted' && postBlocked)) return;
    update((s) => addAudit({ ...s, journals: upsert(s.journals, { ...journal, id: journal.id || id('JE'), status }) }, status === 'posted' ? 'post' : 'save', 'manual_journal', journal.ref, `Manual journal ${status}`), status === 'posted' ? L(locale, 'Manual journal posted', 'تم ترحيل القيد اليدوي') : L(locale, 'Manual journal saved as draft', 'تم حفظ القيد كمسودة'));
    setJournal(makeBlankJournal());
  };
  return <div className="page-grid">
    <Card title={L(locale, 'Manual journal entry', 'قيد يومية يدوي')} icon={<Edit3/>}>
      <div className="form-grid">
        <Field label={L(locale, 'Date', 'التاريخ')}><input type="date" value={journal.date} onChange={(e) => setJournal({ ...journal, date: e.target.value })}/></Field>
        <Field label={L(locale, 'Reference', 'المرجع')}><input value={journal.ref} onChange={(e) => setJournal({ ...journal, ref: e.target.value })}/></Field>
        <Field label={L(locale, 'Description', 'البيان')}><input value={journal.description} onChange={(e) => setJournal({ ...journal, description: e.target.value })}/></Field>
      </div>
      <Table headers={[L(locale, 'Account', 'الحساب'), L(locale, 'Debit', 'مدين'), L(locale, 'Credit', 'دائن'), L(locale, 'Branch', 'الفرع'), L(locale, 'Cost Center', 'مركز التكلفة'), L(locale, 'Memo', 'ملاحظة'), '']} rows={journal.lines.map((ln) => [
        <select value={ln.accountCode} onChange={(e) => setJournal({ ...journal, lines: journal.lines.map((x) => x.id === ln.id ? { ...x, accountCode: e.target.value } : x) })}><option value="">—</option>{state.chartAccounts.map((a) => <option key={a.code} value={a.code}>{a.code} - {L(locale, a.nameEn, a.nameAr)}</option>)}</select>,
        <input type="number" value={ln.debit} onChange={(e) => setJournal({ ...journal, lines: journal.lines.map((x) => x.id === ln.id ? { ...x, debit: Number(e.target.value), credit: Number(e.target.value) > 0 ? 0 : x.credit } : x) })}/>,
        <input type="number" value={ln.credit} onChange={(e) => setJournal({ ...journal, lines: journal.lines.map((x) => x.id === ln.id ? { ...x, credit: Number(e.target.value), debit: Number(e.target.value) > 0 ? 0 : x.debit } : x) })}/>,
        <select value={ln.branchId ?? 'company'} onChange={(e) => setJournal({ ...journal, lines: journal.lines.map((x) => x.id === ln.id ? { ...x, branchId: e.target.value } : x) })}><option value="company">{L(locale, 'Company', 'الشركة')}</option>{state.branches.map((b) => <option key={b.id} value={b.id}>{L(locale, b.nameEn, b.nameAr)}</option>)}</select>,
        <select value={ln.costCenterId ?? 'company'} onChange={(e) => setJournal({ ...journal, lines: journal.lines.map((x) => x.id === ln.id ? { ...x, costCenterId: e.target.value } : x) })}><option value="company">{L(locale, 'Company', 'الشركة')}</option>{state.costCenters.map((c) => <option key={c.id} value={c.id}>{L(locale, c.nameEn, c.nameAr)}</option>)}</select>,
        <input value={ln.memo} onChange={(e) => setJournal({ ...journal, lines: journal.lines.map((x) => x.id === ln.id ? { ...x, memo: e.target.value } : x) })}/>,
        <button className="danger" onClick={() => removeLine(ln.id)}><X size={14}/></button>
      ])}/>
      <div className={`notice ${bal.balanced && !missing ? '' : 'warning'}`}>{L(locale, 'Debit', 'مدين')}: {money(bal.debit, locale)} | {L(locale, 'Credit', 'دائن')}: {money(bal.credit, locale)} | {L(locale, 'Difference', 'الفرق')}: {money(bal.diff, locale)}</div>
      {postBlocked && <div className="warning-box">{postBlocked}</div>}
      <div className="button-row"><button onClick={addLine}><Plus size={16}/>{L(locale, 'Add Line', 'إضافة سطر')}</button><button disabled={missing || !bal.balanced} onClick={() => save('draft')}><Save size={16}/>{L(locale, 'Save Draft', 'حفظ مسودة')}</button><button disabled={missing || !bal.balanced || Boolean(postBlocked)} onClick={() => save('posted')}><ClipboardCheck size={16}/>{L(locale, 'Post Journal', 'ترحيل القيد')}</button></div>
    </Card>
  </div>;
}

function JournalRegisterPage({ state, update, locale }: { state: ERPState; update: (fn: (s: ERPState) => ERPState, success?: string) => void; locale: Locale }) {
  const reverse = (j: JournalEntry) => { if (!canPerform(state, 'finance.journal.post') || isDateLocked(state, j.date)) return; update((s) => addAudit({ ...s, journals: [...s.journals, makeReversalJournal(j)] }, 'reverse', 'journal', j.ref, 'Reversal journal posted'), L(locale, 'Reversal journal posted', 'تم ترحيل قيد عكسي')); };
  const postDraft = (j: JournalEntry) => { if (!canPerform(state, 'finance.journal.post') || isDateLocked(state, j.date)) return; update((s) => addAudit({ ...s, journals: s.journals.map((x) => x.id === j.id ? { ...x, status: 'posted' } : x) }, 'post', 'journal', j.ref, 'Draft journal posted'), L(locale, 'Journal posted', 'تم ترحيل القيد')); };
  return <Card title={L(locale, 'Journal register', 'سجل قيود اليومية')} icon={<FileText/>}>
    <Table headers={[L(locale, 'Date', 'التاريخ'), L(locale, 'Ref', 'المرجع'), L(locale, 'Source', 'المصدر'), L(locale, 'Description', 'البيان'), L(locale, 'Debit', 'مدين'), L(locale, 'Credit', 'دائن'), L(locale, 'Status', 'الحالة'), L(locale, 'Actions', 'إجراءات')]} rows={state.journals.slice().reverse().map((j) => {
      const b = journalBalance(j);
      return [j.date, j.ref, j.source, j.description, money(b.debit, locale), money(b.credit, locale), j.status, <div className="button-row compact">{j.status === 'draft' && <button disabled={!b.balanced || !canPerform(state, 'finance.journal.post') || isDateLocked(state, j.date)} onClick={() => postDraft(j)}>{L(locale, 'Post', 'ترحيل')}</button>}{j.status === 'posted' && <button disabled={!canPerform(state, 'finance.journal.post') || isDateLocked(state, j.date)} onClick={() => reverse(j)}>{L(locale, 'Reverse', 'عكس')}</button>}</div>];
    })}/>
  </Card>;
}

function GeneralLedgerPage({ state, locale }: { state: ERPState; locale: Locale }) {
  const [account, setAccount] = useState('');
  const lines = ledgerLines(state).filter(({ line }) => !account || line.accountCode === account);
  let running = 0;
  const rows = lines.map(({ journal, line }) => { const acc = state.chartAccounts.find((a) => a.code === line.accountCode); running += signedAmount(acc, line.debit, line.credit); return [journal.date, journal.ref, journal.source, accountName(state, line.accountCode, locale), line.memo, branchName(state, line.branchId, locale), costCenterName(state, line.costCenterId, locale), money(line.debit, locale), money(line.credit, locale), money(running, locale)]; });
  return <Card title={L(locale, 'General ledger', 'الأستاذ العام')} icon={<Database/>} action={<select value={account} onChange={(e) => setAccount(e.target.value)}><option value="">{L(locale, 'All accounts', 'كل الحسابات')}</option>{state.chartAccounts.map((a) => <option key={a.code} value={a.code}>{a.code} - {L(locale, a.nameEn, a.nameAr)}</option>)}</select>}>
    <Table headers={[L(locale, 'Date', 'التاريخ'), L(locale, 'Ref', 'المرجع'), L(locale, 'Source', 'المصدر'), L(locale, 'Account', 'الحساب'), L(locale, 'Memo', 'ملاحظة'), L(locale, 'Branch', 'الفرع'), L(locale, 'Cost Center', 'مركز التكلفة'), L(locale, 'Debit', 'مدين'), L(locale, 'Credit', 'دائن'), L(locale, 'Running', 'الرصيد المتحرك')]} rows={rows}/>
  </Card>;
}

function TrialBalancePage({ state, locale }: { state: ERPState; locale: Locale }) {
  const rows = accountBalances(state).map((b) => ({ ...b, side: naturalTrialSide(b.acc, b.balance) })).filter((r) => r.side.debit || r.side.credit);
  const totalDebit = rows.reduce((s, r) => s + r.side.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.side.credit, 0);
  return <Card title={L(locale, 'Trial balance', 'ميزان المراجعة')} icon={<Calculator/>}>
    <div className={`notice ${Math.abs(totalDebit - totalCredit) < 0.01 ? '' : 'warning'}`}>{L(locale, 'Total Debit', 'إجمالي المدين')}: {money(totalDebit, locale)} | {L(locale, 'Total Credit', 'إجمالي الدائن')}: {money(totalCredit, locale)} | {L(locale, 'Difference', 'الفرق')}: {money(totalDebit - totalCredit, locale)}</div>
    <Table headers={[L(locale, 'Code', 'الكود'), L(locale, 'Account', 'الحساب'), L(locale, 'Type', 'النوع'), L(locale, 'Debit balance', 'رصيد مدين'), L(locale, 'Credit balance', 'رصيد دائن')]} rows={rows.map((r) => [r.acc.code, L(locale, r.acc.nameEn, r.acc.nameAr), accountTypeLabel(r.acc.type, locale), money(r.side.debit, locale), money(r.side.credit, locale)])}/>
  </Card>;
}

function IncomeStatementPage({ state, totals, locale }: { state: ERPState; totals: Totals; locale: Locale }) {
  const revenueRows = statementGroup(state, ['revenue', 'other_income']);
  const cogsRows = statementGroup(state, ['cogs']);
  const expenseRows = statementGroup(state, ['expense', 'other_expense']);
  return <div className="page-grid">
    <div className="kpi-grid"><KPI label={L(locale, 'Net Sales', 'صافي المبيعات')} value={money(totals.salesNet, locale)} hint={L(locale, 'Revenue excluding VAT', 'الإيرادات بدون ضريبة')} icon={<BadgeDollarSign/>}/><KPI label={L(locale, 'COGS', 'تكلفة المبيعات')} value={money(totals.cogs, locale)} hint={L(locale, 'Inventory consumption', 'استهلاك المخزون')} icon={<Archive/>}/><KPI label={L(locale, 'Gross Profit', 'مجمل الربح')} value={money(totals.grossProfit, locale)} hint="Sales - COGS" icon={<PieChart/>}/><KPI label={L(locale, 'Net Income', 'صافي الربح')} value={money(totals.netIncome, locale)} hint={L(locale, 'After expenses', 'بعد المصاريف')} icon={<BarChart3/>}/></div>
    <Card title={L(locale, 'Income statement', 'قائمة الدخل')} icon={<PieChart/>}>
      <Table headers={[L(locale, 'Line', 'البند'), L(locale, 'Amount', 'المبلغ')]} rows={[[<strong>{L(locale, 'Revenue', 'الإيرادات')}</strong>, <strong>{money(totals.salesNet, locale)}</strong>], ...revenueRows.map((r) => [accountName(state, r.acc.code, locale), money(r.balance, locale)]), [<strong>{L(locale, 'Cost of Goods Sold', 'تكلفة المبيعات')}</strong>, <strong>{money(-totals.cogs, locale)}</strong>], ...cogsRows.map((r) => [accountName(state, r.acc.code, locale), money(-r.balance, locale)]), [<strong>{L(locale, 'Gross Profit', 'مجمل الربح')}</strong>, <strong>{money(totals.grossProfit, locale)}</strong>], [<strong>{L(locale, 'Operating Expenses', 'المصاريف التشغيلية')}</strong>, <strong>{money(-totals.expenses, locale)}</strong>], ...expenseRows.map((r) => [accountName(state, r.acc.code, locale), money(-r.balance, locale)]), [<strong>{L(locale, 'Net Income', 'صافي الربح')}</strong>, <strong>{money(totals.netIncome, locale)}</strong>]]}/>
    </Card>
  </div>;
}

function BalanceSheetPage({ state, totals, locale }: { state: ERPState; totals: Totals; locale: Locale }) {
  const assets = statementGroup(state, ['asset']);
  const liabilities = statementGroup(state, ['liability']);
  const equity = statementGroup(state, ['equity']);
  const check = totals.assets - (totals.liabilities + totals.equity + totals.netIncome);
  return <div className="page-grid">
    <div className={`notice ${Math.abs(check) < 0.01 ? '' : 'warning'}`}>{L(locale, 'Balance check', 'اختبار التوازن')}: {money(check, locale)} — {L(locale, 'Assets should equal liabilities + equity + current profit.', 'يجب أن تساوي الأصول الالتزامات + حقوق الملكية + ربح الفترة.')}</div>
    <div className="two-col">
      <Card title={L(locale, 'Assets', 'الأصول')} icon={<Archive/>}><Table headers={[L(locale, 'Account', 'الحساب'), L(locale, 'Amount', 'المبلغ')]} rows={[[<strong>{L(locale, 'Total Assets', 'إجمالي الأصول')}</strong>, <strong>{money(totals.assets, locale)}</strong>], ...assets.map((r) => [accountName(state, r.acc.code, locale), money(r.balance, locale)])]}/></Card>
      <Card title={L(locale, 'Liabilities and equity', 'الالتزامات وحقوق الملكية')} icon={<Landmark/>}><Table headers={[L(locale, 'Account', 'الحساب'), L(locale, 'Amount', 'المبلغ')]} rows={[[<strong>{L(locale, 'Liabilities', 'الالتزامات')}</strong>, <strong>{money(totals.liabilities, locale)}</strong>], ...liabilities.map((r) => [accountName(state, r.acc.code, locale), money(r.balance, locale)]), [<strong>{L(locale, 'Equity', 'حقوق الملكية')}</strong>, <strong>{money(totals.equity, locale)}</strong>], ...equity.map((r) => [accountName(state, r.acc.code, locale), money(r.balance, locale)]), [<strong>{L(locale, 'Current profit', 'ربح الفترة')}</strong>, <strong>{money(totals.netIncome, locale)}</strong>]]}/></Card>
    </div>
  </div>;
}

function CashFlowPage({ state, locale }: { state: ERPState; locale: Locale }) {
  const cashLines = ledgerLines(state).filter(({ line }) => ['1010','1020','1100'].includes(line.accountCode));
  const inflow = cashLines.reduce((s, { line }) => s + line.debit, 0);
  const outflow = cashLines.reduce((s, { line }) => s + line.credit, 0);
  return <div className="page-grid">
    <Card title={L(locale, 'Cash flow summary', 'ملخص التدفقات النقدية')} icon={<Banknote/>}>
      <Table headers={[L(locale, 'Line', 'البند'), L(locale, 'Amount', 'المبلغ')]} rows={[[L(locale, 'Cash inflows', 'التدفقات الداخلة'), money(inflow, locale)], [L(locale, 'Cash outflows', 'التدفقات الخارجة'), money(outflow, locale)], [<strong>{L(locale, 'Net cash movement', 'صافي الحركة النقدية')}</strong>, <strong>{money(inflow - outflow, locale)}</strong>]]}/>
    </Card>
    <Card title={L(locale, 'Cash movement detail', 'تفاصيل حركة النقد')} icon={<ListChecks/>}>
      <Table headers={[L(locale, 'Date', 'التاريخ'), L(locale, 'Ref', 'المرجع'), L(locale, 'Account', 'الحساب'), L(locale, 'In', 'داخل'), L(locale, 'Out', 'خارج'), L(locale, 'Memo', 'ملاحظة')]} rows={cashLines.map(({ journal, line }) => [journal.date, journal.ref, accountName(state, line.accountCode, locale), money(line.debit, locale), money(line.credit, locale), line.memo])}/>
    </Card>
  </div>;
}

function FinancialStatementsPage({ state, totals, locale }: { state: ERPState; totals: Totals; locale: Locale }) { return <div className="page-grid"><IncomeStatementPage state={state} totals={totals} locale={locale}/><BalanceSheetPage state={state} totals={totals} locale={locale}/><CashFlowPage state={state} locale={locale}/></div>; }


function APPaymentRunPage({ state, update, locale }: { state: ERPState; update: (fn: (s: ERPState) => ERPState, success?: string) => void; locale: Locale }) {
  const [supplierId, setSupplierId] = useState('');
  const [payDate, setPayDate] = useState(today());
  const openInvoices = supplierOpenInvoices(state, supplierId).sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate));
  const totalDue = openInvoices.reduce((sum, inv) => sum + supplierInvoiceBalance(state, inv), 0);
  const blocked = isDateLocked(state, payDate) || !canPerform(state, 'finance.payment_run.post');
  const postPaymentRun = () => {
    if (!openInvoices.length || blocked) return;
    update((s) => {
      const newPayments: SupplierPayment[] = openInvoices.map((inv, index) => ({ id: id('PAY'), ref: `PAYRUN-${String(s.supplierPayments.length + index + 1).padStart(5, '0')}`, date: payDate, supplierId: inv.supplierId, amount: supplierInvoiceBalance(s, inv), method: 'bank', accountCode: '1020', status: 'posted', note: 'AP payment run', invoiceRef: inv.ref }));
      const newJournals: JournalEntry[] = newPayments.map((p) => ({ id: id('JE'), date: p.date, ref: p.ref, source: 'ap_payment_run', description: `AP payment run ${supplierName(s, p.supplierId)} ${p.invoiceRef ?? ''}`, status: 'posted', lines: [
        { id: id('JL'), accountCode: '2100', debit: p.amount, credit: 0, branchId: 'company', costCenterId: 'company', memo: p.invoiceRef ?? '' },
        { id: id('JL'), accountCode: p.accountCode, debit: 0, credit: p.amount, branchId: 'company', costCenterId: 'company', memo: 'Bank payment run' },
      ] }));
      return addAudit({ ...s, supplierPayments: [...s.supplierPayments, ...newPayments], journals: [...s.journals, ...newJournals] }, 'post', 'ap_payment_run', `RUN-${payDate}`, `Posted ${newPayments.length} supplier payment allocations`);
    }, L(locale, 'AP payment run posted', 'تم ترحيل تشغيل سداد الموردين'));
  };
  return <div className="page-grid">
    <div className="kpi-grid"><KPI label={L(locale, 'Invoices selected', 'فواتير مختارة')} value={`${openInvoices.length}`} hint={L(locale, 'Open supplier invoices', 'فواتير موردين مفتوحة')} icon={<ReceiptText/>}/><KPI label={L(locale, 'Total due', 'الإجمالي المستحق')} value={money(totalDue, locale)} hint={L(locale, 'Invoice-allocated', 'مخصص على الفواتير')} icon={<Wallet/>}/><KPI label={L(locale, 'Payment date', 'تاريخ السداد')} value={payDate} hint={isDateLocked(state, payDate) ? L(locale, 'Locked period', 'فترة مقفلة') : L(locale, 'Open period', 'فترة مفتوحة')} icon={<ClipboardCheck/>}/></div>
    <Card title={L(locale, 'AP payment run', 'تشغيل سداد الموردين')} icon={<Coins/>}>
      <div className="notice">{L(locale, 'This accountant-friendly workbench selects open supplier invoices and posts one allocated payment voucher per invoice. It blocks locked periods and missing payment-run permission.', 'هذه مساحة عمل محاسبية تختار فواتير الموردين المفتوحة وترحل سند سداد مخصص لكل فاتورة. تمنع الفترات المقفلة والصلاحيات المفقودة.')}</div>
      <div className="form-grid"><Field label={L(locale, 'Supplier filter', 'تصفية المورد')}><select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">{L(locale, 'All suppliers', 'كل الموردين')}</option>{state.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Field label={L(locale, 'Payment date', 'تاريخ السداد')}><input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)}/></Field></div>
      {blocked && <div className="warning-box">{isDateLocked(state, payDate) ? L(locale, 'Selected payment date is locked/closed.', 'تاريخ السداد المحدد مقفل/مغلق.') : L(locale, 'Current user cannot post AP payment runs.', 'المستخدم الحالي لا يملك صلاحية ترحيل دفعات الموردين.')}</div>}
      <Table headers={[L(locale, 'Invoice', 'الفاتورة'), L(locale, 'Supplier', 'المورد'), L(locale, 'Date', 'التاريخ'), L(locale, 'Open balance', 'الرصيد المفتوح')]} rows={openInvoices.map((inv) => [inv.ref, supplierName(state, inv.supplierId), inv.invoiceDate, money(supplierInvoiceBalance(state, inv), locale)])}/>
      <div className="button-row"><button disabled={!openInvoices.length || blocked} onClick={postPaymentRun}><Wallet size={16}/>{L(locale, 'Post Payment Run', 'ترحيل تشغيل السداد')}</button><button onClick={() => saveFile(`ap-payment-run-${today()}.csv`, rowsToCsv(openInvoices.map((inv) => ({ invoice: inv.ref, supplier: supplierName(state, inv.supplierId), date: inv.invoiceDate, balance: supplierInvoiceBalance(state, inv) }))), 'text/csv;charset=utf-8')}><Download size={16}/>{L(locale, 'Export Payment Plan', 'تصدير خطة السداد')}</button></div>
    </Card>
  </div>;
}

function SupplierStatementPage({ state, locale }: { state: ERPState; locale: Locale }) {
  const [supplierId, setSupplierId] = useState('');
  const rows = supplierStatementRows(state, supplierId);
  return <div className="page-grid">
    <Card title={L(locale, 'Supplier statement', 'كشف حساب المورد')} icon={<FileText/>} action={<button onClick={() => saveFile(`supplier-statement-${supplierId || 'all'}-${today()}.csv`, rowsToCsv(rows.map((r) => ({ date: r.date, ref: r.ref, supplier: supplierName(state, r.supplierId), description: r.description, debit: r.debit, credit: r.credit, balance: r.balance }))), 'text/csv;charset=utf-8')}><Download size={16}/>{L(locale, 'Export Statement', 'تصدير الكشف')}</button>}>
      <div className="form-grid"><Field label={L(locale, 'Supplier', 'المورد')}><select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">{L(locale, 'All suppliers', 'كل الموردين')}</option>{state.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field></div>
      <Table headers={[L(locale, 'Date', 'التاريخ'), L(locale, 'Ref', 'المرجع'), L(locale, 'Supplier', 'المورد'), L(locale, 'Description', 'الوصف'), L(locale, 'Debit / Payment', 'مدين / سداد'), L(locale, 'Credit / Invoice', 'دائن / فاتورة'), L(locale, 'Running Balance', 'الرصيد المتحرك')]} rows={rows.map((r) => [r.date, r.ref, supplierName(state, r.supplierId), r.description, money(r.debit, locale), money(r.credit, locale), money(r.balance, locale)])}/>
    </Card>
  </div>;
}

function APPage({ state, locale }: { state: ERPState; locale: Locale }) {
  const rows = supplierAgingRows(state);
  return <div className="page-grid">
    <div className="kpi-grid"><KPI label={L(locale, 'Open suppliers', 'موردون مفتوحون')} value={`${rows.length}`} hint={L(locale, 'With balances or activity', 'لديهم أرصدة أو حركة')} icon={<Wallet/>}/><KPI label={L(locale, 'AP Balance', 'رصيد الذمم الدائنة')} value={money(rows.reduce((s,r)=>s+r.balance,0), locale)} hint={L(locale, 'Supplier outstanding', 'مستحق للموردين')} icon={<ReceiptText/>}/></div>
    <Card title={L(locale, 'Accounts payable aging', 'أعمار الذمم الدائنة')} icon={<Wallet/>}><Table headers={[L(locale, 'Supplier', 'المورد'), L(locale, 'Invoices', 'الفواتير'), L(locale, 'Paid', 'مدفوع'), L(locale, 'Balance', 'الرصيد'), '0-30', '31-60', '61-90', '90+', L(locale, 'Bank / IBAN', 'البنك / الآيبان')]} rows={rows.map((r) => [r.sup.name, money(r.invTotal, locale), money(r.paid, locale), money(r.balance, locale), money(r.current, locale), money(r.d30, locale), money(r.d60, locale), money(r.d90, locale), `${r.sup.bankName} ${r.sup.bankAccount}`])}/></Card>
    <Card title={L(locale, 'Supplier statement detail', 'كشف حساب المورد')} icon={<FileText/>}><Table headers={[L(locale, 'Supplier', 'المورد'), L(locale, 'Invoice', 'الفاتورة'), L(locale, 'Date', 'التاريخ'), L(locale, 'Amount', 'المبلغ'), L(locale, 'Payment Type', 'طريقة السداد'), L(locale, 'Status', 'الحالة')]} rows={state.purchaseInvoices.map((p) => [supplierName(state, p.supplierId), p.invoiceNo, p.invoiceDate, money(invoiceTotals(p).total, locale), p.paymentType, p.status])}/></Card>
  </div>;
}

function ARPage({ state, update, locale }: { state: ERPState; update: (fn: (s: ERPState) => ERPState, success?: string) => void; locale: Locale }) {
  const [inv, setInv] = useState<ARInvoice>({ id: '', ref: '', customer: '', date: today(), branchId: '', amount: 0, vatRate: 15, paidAmount: 0, status: 'open' });
  const postInvoice = () => inv.customer && inv.amount > 0 && update((s) => {
    const ref = inv.ref || `AR-${String(s.arInvoices.length + 1).padStart(5, '0')}`;
    const net = inv.amount;
    const vat = net * (inv.vatRate / 100);
    const gross = net + vat;
    const ar: ARInvoice = { ...inv, id: inv.id || id('AR'), ref, status: inv.paidAmount >= gross ? 'paid' : 'open' };
    const lines: JournalLine[] = [
      { id: id('JL'), accountCode: '1200', debit: gross, credit: 0, branchId: inv.branchId || 'company', costCenterId: 'company', memo: inv.customer },
      { id: id('JL'), accountCode: '4000', debit: 0, credit: net, branchId: inv.branchId || 'company', costCenterId: 'company', memo: inv.customer },
      { id: id('JL'), accountCode: '2150', debit: 0, credit: vat, branchId: inv.branchId || 'company', costCenterId: 'company', memo: inv.customer },
    ];
    if (inv.paidAmount > 0) { lines.push({ id: id('JL'), accountCode: '1020', debit: inv.paidAmount, credit: 0, branchId: inv.branchId || 'company', costCenterId: 'company', memo: 'Customer receipt' }, { id: id('JL'), accountCode: '1200', debit: 0, credit: inv.paidAmount, branchId: inv.branchId || 'company', costCenterId: 'company', memo: 'Customer receipt' }); }
    const j: JournalEntry = { id: id('JE'), date: inv.date, ref, source: 'ar_invoice', description: `AR invoice ${inv.customer}`, status: 'posted', lines };
    return addAudit({ ...s, arInvoices: [...s.arInvoices, ar], journals: [...s.journals, j] }, 'post', 'ar_invoice', ref, 'AR invoice posted');
  }, L(locale, 'AR invoice posted', 'تم ترحيل فاتورة العميل'));
  const rows = customerAgingRows(state);
  return <div className="page-grid">
    <Card title={L(locale, 'Post customer invoice / catering / delivery platform', 'ترحيل فاتورة عميل / تموين / منصة توصيل')} icon={<CreditCard/>}>
      <div className="form-grid">
        <Field label={L(locale, 'Customer', 'العميل')}><input value={inv.customer} onChange={(e) => setInv({ ...inv, customer: e.target.value })}/></Field>
        <Field label={L(locale, 'Branch', 'الفرع')}><select value={inv.branchId} onChange={(e) => setInv({ ...inv, branchId: e.target.value })}><option value="">—</option>{state.branches.map((b) => <option key={b.id} value={b.id}>{L(locale, b.nameEn, b.nameAr)}</option>)}</select></Field>
        <Field label={L(locale, 'Net amount before VAT', 'الصافي قبل الضريبة')}><input type="number" value={inv.amount} onChange={(e) => setInv({ ...inv, amount: Number(e.target.value) })}/></Field>
        <Field label={L(locale, 'VAT %', 'نسبة الضريبة')}><input type="number" value={inv.vatRate} onChange={(e) => setInv({ ...inv, vatRate: Number(e.target.value) })}/></Field>
        <Field label={L(locale, 'Receipt amount', 'المبلغ المحصل')}><input type="number" value={inv.paidAmount} onChange={(e) => setInv({ ...inv, paidAmount: Number(e.target.value) })}/></Field>
      </div>
      <button onClick={postInvoice}><ClipboardCheck size={16}/>{L(locale, 'Post AR Invoice', 'ترحيل فاتورة عميل')}</button>
    </Card>
    <Card title={L(locale, 'Accounts receivable aging', 'أعمار الذمم المدينة')} icon={<CreditCard/>}><Table headers={[L(locale, 'Ref', 'المرجع'), L(locale, 'Customer', 'العميل'), L(locale, 'Amount', 'المبلغ'), L(locale, 'Paid', 'مدفوع'), L(locale, 'Balance', 'الرصيد'), '0-30', '31-60', '61-90', '90+']} rows={rows.map((r) => [r.invoice.ref, r.invoice.customer, money(r.invoice.amount, locale), money(r.invoice.paidAmount, locale), money(r.balance, locale), money(r.current, locale), money(r.d30, locale), money(r.d60, locale), money(r.d90, locale)])}/></Card>
  </div>;
}

function BankingPage({ state, totals, locale }: { state: ERPState; totals: Totals; locale: Locale }) {
  const bankRows = ledgerLines(state).filter(({ line }) => ['1010','1020','1100'].includes(line.accountCode));
  return <div className="page-grid">
    <div className="kpi-grid"><KPI label={L(locale, 'Cash / Bank Control', 'رقابة النقد والبنوك')} value={money(totals.cash, locale)} hint={L(locale, 'GL controlled', 'مرتبطة بالأستاذ')} icon={<Banknote/>}/><KPI label={L(locale, 'Unreconciled design', 'مطابقة غير منفذة')} value={L(locale, 'Scaffold', 'مخطط')} hint={L(locale, 'Bank reconciliation next phase', 'مطابقة البنك في المرحلة التالية')} icon={<ClipboardCheck/>}/></div>
    <Card title={L(locale, 'Cash and bank ledger', 'دفتر النقد والبنوك')} icon={<Banknote/>}><Table headers={[L(locale, 'Date', 'التاريخ'), L(locale, 'Ref', 'المرجع'), L(locale, 'Account', 'الحساب'), L(locale, 'In', 'داخل'), L(locale, 'Out', 'خارج'), L(locale, 'Branch', 'الفرع'), L(locale, 'Memo', 'ملاحظة')]} rows={bankRows.map(({ journal, line }) => [journal.date, journal.ref, accountName(state, line.accountCode, locale), money(line.debit, locale), money(line.credit, locale), branchName(state, line.branchId, locale), line.memo])}/></Card>
  </div>;
}

function AssetsPage({ state, update, locale }: { state: ERPState; update: (fn: (s: ERPState) => ERPState, success?: string) => void; locale: Locale }) {
  const [asset, setAsset] = useState<FixedAsset>({ id: '', code: '', name: '', category: 'Kitchen Equipment', branchId: 'company', costCenterId: 'company', purchaseDate: today(), cost: 0, usefulLifeMonths: 60, salvageValue: 0, accumulatedDepreciation: 0, active: true });
  const save = () => asset.code && asset.name && update((s) => addAudit({ ...s, fixedAssets: upsert(s.fixedAssets, { ...asset, id: asset.id || id('FA') }) }, asset.id ? 'edit' : 'create', 'fixed_asset', asset.code, 'Fixed asset saved'), L(locale, 'Fixed asset saved', 'تم حفظ الأصل'));
  return <Card title={L(locale, 'Fixed asset register', 'سجل الأصول الثابتة')} icon={<Building2/>}>
    <div className="form-grid">
      <Field label={L(locale, 'Code', 'الكود')}><input value={asset.code} onChange={(e) => setAsset({ ...asset, code: e.target.value })}/></Field>
      <Field label={L(locale, 'Name', 'الاسم')}><input value={asset.name} onChange={(e) => setAsset({ ...asset, name: e.target.value })}/></Field>
      <Field label={L(locale, 'Category', 'الفئة')}><input value={asset.category} onChange={(e) => setAsset({ ...asset, category: e.target.value })}/></Field>
      <Field label={L(locale, 'Branch', 'الفرع')}><select value={asset.branchId} onChange={(e) => setAsset({ ...asset, branchId: e.target.value })}><option value="company">{L(locale, 'Company', 'الشركة')}</option>{state.branches.map((b) => <option key={b.id} value={b.id}>{L(locale, b.nameEn, b.nameAr)}</option>)}</select></Field>
      <Field label={L(locale, 'Cost Center', 'مركز التكلفة')}><select value={asset.costCenterId} onChange={(e) => setAsset({ ...asset, costCenterId: e.target.value })}><option value="company">{L(locale, 'Company', 'الشركة')}</option>{state.costCenters.map((c) => <option key={c.id} value={c.id}>{L(locale, c.nameEn, c.nameAr)}</option>)}</select></Field>
      <Field label={L(locale, 'Cost', 'التكلفة')}><input type="number" value={asset.cost} onChange={(e) => setAsset({ ...asset, cost: Number(e.target.value) })}/></Field>
      <Field label={L(locale, 'Useful life months', 'العمر بالأشهر')}><input type="number" value={asset.usefulLifeMonths} onChange={(e) => setAsset({ ...asset, usefulLifeMonths: Number(e.target.value) })}/></Field>
      <Field label={L(locale, 'Salvage', 'القيمة التخريدية')}><input type="number" value={asset.salvageValue} onChange={(e) => setAsset({ ...asset, salvageValue: Number(e.target.value) })}/></Field>
    </div>
    <div className="button-row"><button onClick={save}><Save size={16}/>{L(locale, 'Save Asset', 'حفظ الأصل')}</button><button onClick={() => setAsset({ id: '', code: '', name: '', category: 'Kitchen Equipment', branchId: 'company', costCenterId: 'company', purchaseDate: today(), cost: 0, usefulLifeMonths: 60, salvageValue: 0, accumulatedDepreciation: 0, active: true })}><Plus size={16}/>{L(locale, 'New', 'جديد')}</button></div>
    <Table headers={[L(locale, 'Code', 'الكود'), L(locale, 'Asset', 'الأصل'), L(locale, 'Branch', 'الفرع'), L(locale, 'Cost', 'التكلفة'), L(locale, 'Monthly Dep.', 'الإهلاك الشهري'), L(locale, 'Accumulated', 'مجمع الإهلاك'), L(locale, 'NBV', 'صافي القيمة'), L(locale, 'Actions', 'إجراءات')]} rows={state.fixedAssets.map((a) => [a.code, a.name, branchName(state, a.branchId, locale), money(a.cost, locale), money(assetMonthlyDep(a), locale), money(a.accumulatedDepreciation, locale), money(a.cost - a.accumulatedDepreciation, locale), actionButtons(() => setAsset(a), () => update((s) => addAudit({ ...s, fixedAssets: s.fixedAssets.map((x) => x.id === a.id ? { ...x, active: false } : x) }, 'delete', 'asset', a.code, 'Asset deleted'), L(locale, 'Asset deleted', 'تم حذف الأصل')), locale)])}/>
  </Card>;
}

function DepreciationRunPage({ state, update, locale }: { state: ERPState; update: (fn: (s: ERPState) => ERPState, success?: string) => void; locale: Locale }) {
  const postDep = (a: FixedAsset) => update((s) => {
    const amount = assetMonthlyDep(a);
    const j: JournalEntry = { id: id('JE'), date: today(), ref: `DEP-${a.code}-${today()}`, source: 'depreciation', description: `Monthly depreciation ${a.name}`, status: 'posted', lines: [{ id: id('JL'), accountCode: '6600', debit: amount, credit: 0, branchId: a.branchId, costCenterId: a.costCenterId, memo: a.name }, { id: id('JL'), accountCode: '1590', debit: 0, credit: amount, branchId: a.branchId, costCenterId: a.costCenterId, memo: a.name }] };
    return addAudit({ ...s, fixedAssets: s.fixedAssets.map((x) => x.id === a.id ? { ...x, accumulatedDepreciation: x.accumulatedDepreciation + amount } : x), journals: [...s.journals, j] }, 'post', 'depreciation', a.code, 'Depreciation posted');
  }, L(locale, 'Depreciation posted', 'تم ترحيل الإهلاك'));
  return <Card title={L(locale, 'Depreciation run', 'تشغيل الإهلاك')} icon={<RefreshCw/>}>
    <Table headers={[L(locale, 'Asset', 'الأصل'), L(locale, 'Monthly Depreciation', 'الإهلاك الشهري'), L(locale, 'Accumulated', 'مجمع الإهلاك'), L(locale, 'Post', 'ترحيل')]} rows={state.fixedAssets.map((a) => [a.name, money(assetMonthlyDep(a), locale), money(a.accumulatedDepreciation, locale), <button disabled={assetMonthlyDep(a) <= 0} onClick={() => postDep(a)}>{L(locale, 'Post Depreciation', 'ترحيل الإهلاك')}</button>])}/>
  </Card>;
}

function VATPage({ state, totals, locale }: { state: ERPState; totals: Totals; locale: Locale }) {
  const vatLines = ledgerLines(state).filter(({ line }) => ['1420','2150','2160'].includes(line.accountCode));
  return <div className="page-grid">
    <div className="kpi-grid"><KPI label={L(locale, 'VAT Input', 'ضريبة المدخلات')} value={money(totals.vatInput, locale)} hint={L(locale, 'Recoverable', 'قابلة للاسترداد')} icon={<ReceiptText/>}/><KPI label={L(locale, 'VAT Output', 'ضريبة المخرجات')} value={money(totals.vatOutput, locale)} hint={L(locale, 'Collected on sales', 'محصلة من المبيعات')} icon={<ReceiptText/>}/><KPI label={L(locale, 'VAT Payable', 'ضريبة مستحقة')} value={money(totals.vatPayable, locale)} hint={L(locale, 'Output - input', 'مخرجات - مدخلات')} icon={<Calculator/>}/></div>
    <Card title={L(locale, 'VAT transaction detail', 'تفاصيل حركات الضريبة')} icon={<ReceiptText/>}><Table headers={[L(locale, 'Date', 'التاريخ'), L(locale, 'Ref', 'المرجع'), L(locale, 'Account', 'الحساب'), L(locale, 'Debit', 'مدين'), L(locale, 'Credit', 'دائن'), L(locale, 'Source', 'المصدر')]} rows={vatLines.map(({ journal, line }) => [journal.date, journal.ref, accountName(state, line.accountCode, locale), money(line.debit, locale), money(line.credit, locale), journal.source])}/></Card>
  </div>;
}

function BranchPnlPage({ state, locale }: { state: ERPState; locale: Locale }) {
  const rows = branchFinancialRows(state);
  return <Card title={L(locale, 'Branch profit and loss', 'ربحية الفروع')} icon={<Store/>}><Table headers={[L(locale, 'Branch', 'الفرع'), L(locale, 'Revenue', 'الإيرادات'), L(locale, 'COGS', 'تكلفة المبيعات'), L(locale, 'Expenses', 'المصاريف'), L(locale, 'Profit', 'الربح')]} rows={rows.map((r) => [L(locale, r.branch.nameEn, r.branch.nameAr), money(r.revenue, locale), money(r.cogs, locale), money(r.expense, locale), money(r.profit, locale)])}/></Card>;
}

function CostCenterFinancePage({ state, locale }: { state: ERPState; locale: Locale }) {
  const rows = costCenterFinancialRows(state);
  return <Card title={L(locale, 'Cost center financial report', 'التقرير المالي لمراكز التكلفة')} icon={<Layers/>}><Table headers={[L(locale, 'Cost Center', 'مركز التكلفة'), L(locale, 'Budget', 'الميزانية'), L(locale, 'Revenue', 'الإيرادات'), L(locale, 'COGS', 'تكلفة المبيعات'), L(locale, 'Expenses', 'المصاريف'), L(locale, 'Budget remaining', 'المتبقي من الميزانية'), L(locale, 'Profit', 'الربح')]} rows={rows.map((r) => [L(locale, r.cc.nameEn, r.cc.nameAr), money(r.cc.budget, locale), money(r.revenue, locale), money(r.cogs, locale), money(r.expense, locale), money(r.variance, locale), money(r.profit, locale)])}/></Card>;
}

function OpeningBalancesPage({ state, update, locale }: { state: ERPState; update: (fn: (s: ERPState) => ERPState, success?: string) => void; locale: Locale }) {
  const [openingRef, setOpeningRef] = useState(`OPEN-${new Date().getFullYear()}`);
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState(L(locale, 'Opening balances batch', 'دفعة الأرصدة الافتتاحية'));
  const [lines, setLines] = useState<JournalLine[]>([makeJournalLine('', 0, 0, 'Opening balance'), makeJournalLine('', 0, 0, 'Opening balance')]);
  const blocked = requirePermission(state, 'finance.opening.post', undefined, locale) || (isDateLocked(state, date) ? L(locale, 'Blocked: selected fiscal period is locked or closed.', 'محجوب: الفترة المالية المختارة مقفلة أو مغلقة.') : '');
  const debit = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
  const credit = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
  const diff = debit - credit;
  const validLines = lines.filter((l) => l.accountCode && (Number(l.debit || 0) > 0 || Number(l.credit || 0) > 0));
  const lineErrors = validLines.filter((l) => { const account = state.chartAccounts.find((a) => a.code === l.accountCode); return account?.requireCostCenter && (!l.costCenterId || l.costCenterId === 'company'); });
  const canPost = !blocked && validLines.length >= 2 && Math.abs(diff) < 0.01 && lineErrors.length === 0;
  const updateLine = (idx: number, patch: Partial<JournalLine>) => setLines(lines.map((l, i) => i === idx ? { ...l, ...patch } : l));
  const post = () => { if (!canPost) return; const journal: JournalEntry = { id: id('JE'), date, ref: openingRef, source: 'opening_balance', description, status: 'posted', lines: validLines.map((l) => ({ ...l, id: l.id || id('JL') })) }; update((s) => addAudit({ ...s, journals: [...s.journals, journal] }, 'post', 'opening_balance', openingRef, 'Balanced opening balance batch posted'), L(locale, 'Balanced opening balance batch posted', 'تم ترحيل دفعة افتتاحية متوازنة')); };
  return <div className="page-grid">
    <Card title={L(locale, 'Balanced opening balances wizard', 'معالج الأرصدة الافتتاحية المتوازن')} icon={<Plus/>}>
      <div className="notice">{L(locale, 'Opening balances must be posted as one balanced batch. The system blocks one-sided opening entries, locked periods, and missing required cost centers.', 'يجب ترحيل الأرصدة الافتتاحية كدفعة واحدة متوازنة. يمنع النظام القيود أحادية الطرف والفترات المقفلة ومراكز التكلفة المطلوبة المفقودة.')}</div>
      <div className="form-grid"><Field label={L(locale, 'Reference', 'المرجع')}><input value={openingRef} onChange={(e) => setOpeningRef(e.target.value)}/></Field><Field label={L(locale, 'Date', 'التاريخ')}><input type="date" value={date} onChange={(e) => setDate(e.target.value)}/></Field><Field label={L(locale, 'Description', 'الوصف')}><input value={description} onChange={(e) => setDescription(e.target.value)}/></Field></div>
      <Table headers={[L(locale, 'Account', 'الحساب'), L(locale, 'Branch', 'الفرع'), L(locale, 'Cost center', 'مركز التكلفة'), L(locale, 'Debit', 'مدين'), L(locale, 'Credit', 'دائن'), L(locale, 'Memo', 'ملاحظة'), L(locale, 'Actions', 'إجراءات')]} rows={lines.map((line, idx) => [<select value={line.accountCode} onChange={(e) => updateLine(idx, { accountCode: e.target.value })}><option value="">—</option>{state.chartAccounts.filter((a) => a.active).map((a) => <option key={a.code} value={a.code}>{accountName(state, a.code, locale)}</option>)}</select>, <select value={line.branchId ?? 'company'} onChange={(e) => updateLine(idx, { branchId: e.target.value })}><option value="company">{L(locale, 'Company', 'الشركة')}</option>{state.branches.map((b) => <option key={b.id} value={b.id}>{L(locale, b.nameEn, b.nameAr)}</option>)}</select>, <select value={line.costCenterId ?? 'company'} onChange={(e) => updateLine(idx, { costCenterId: e.target.value })}><option value="company">{L(locale, 'Company / not required', 'الشركة / غير مطلوب')}</option>{state.costCenters.map((c) => <option key={c.id} value={c.id}>{L(locale, c.nameEn, c.nameAr)}</option>)}</select>, <input type="number" value={line.debit} onChange={(e) => updateLine(idx, { debit: Number(e.target.value), credit: Number(e.target.value) ? 0 : line.credit })}/>, <input type="number" value={line.credit} onChange={(e) => updateLine(idx, { credit: Number(e.target.value), debit: Number(e.target.value) ? 0 : line.debit })}/>, <input value={line.memo} onChange={(e) => updateLine(idx, { memo: e.target.value })}/>, <button className="danger" onClick={() => setLines(lines.filter((_, i) => i !== idx))}><Trash2 size={14}/>{L(locale, 'Remove', 'حذف')}</button>])}/>
      <div className="button-row"><button onClick={() => setLines([...lines, makeJournalLine('', 0, 0, 'Opening balance')])}><Plus size={16}/>{L(locale, 'Add line', 'إضافة سطر')}</button><button disabled={!canPost} onClick={post}><Save size={16}/>{L(locale, 'Post balanced batch', 'ترحيل دفعة متوازنة')}</button></div>
      <div className="kpi-grid"><KPI label={L(locale, 'Total debit', 'إجمالي المدين')} value={money(debit, locale)} hint={L(locale, 'Opening batch', 'دفعة افتتاحية')} icon={<Calculator/>}/><KPI label={L(locale, 'Total credit', 'إجمالي الدائن')} value={money(credit, locale)} hint={L(locale, 'Opening batch', 'دفعة افتتاحية')} icon={<Calculator/>}/><KPI label={L(locale, 'Difference', 'الفرق')} value={money(diff, locale)} hint={Math.abs(diff) < 0.01 ? L(locale, 'Balanced', 'متوازن') : L(locale, 'Must be zero', 'يجب أن يكون صفر')} icon={<ShieldCheck/>}/><KPI label={L(locale, 'Valid lines', 'الأسطر الصحيحة')} value={`${validLines.length}`} hint={L(locale, 'Minimum 2 lines', 'على الأقل سطران')} icon={<ListChecks/>}/></div>
      {blocked && <div className="warning-box">{blocked}</div>}{lineErrors.length > 0 && <div className="warning-box">{L(locale, 'Some accounts require cost center. Fix the accounting dimension before posting.', 'بعض الحسابات تتطلب مركز تكلفة. أصلح البعد المحاسبي قبل الترحيل.')}</div>}{!canPost && !blocked && <div className="notice warning">{L(locale, 'Batch must have at least two valid lines, balanced debits/credits, and valid dimensions.', 'يجب أن تحتوي الدفعة على سطرين صحيحين على الأقل وأن تكون مدينة/دائنة متوازنة وبأبعاد صحيحة.')}</div>}
    </Card>
    <Card title={L(locale, 'Opening balance audit', 'تدقيق الأرصدة الافتتاحية')} icon={<ClipboardCheck/>}><Table headers={[L(locale, 'Date', 'التاريخ'), L(locale, 'Ref', 'المرجع'), L(locale, 'Lines', 'الأسطر'), L(locale, 'Debit', 'مدين'), L(locale, 'Credit', 'دائن'), L(locale, 'Status', 'الحالة')]} rows={state.journals.filter((j) => j.source === 'opening_balance' || j.source === 'opening').map((j) => { const b = journalBalance(j); return [j.date, j.ref, `${j.lines.length}`, money(b.debit, locale), money(b.credit, locale), b.balanced ? <StockPill tone="good">Balanced</StockPill> : <StockPill tone="bad">Unbalanced</StockPill>]; })}/></Card>
  </div>;
}

function BankReconciliationPage({ state, update, locale }: { state: ERPState; update: (fn: (s: ERPState) => ERPState, success?: string) => void; locale: Locale }) {
  const [draft, setDraft] = useState<BankReconLine>({ id: '', date: today(), bankAccountCode: '1020', description: '', statementAmount: 0, status: 'unmatched' });
  const bankLedger = ledgerLines(state).filter(({ line }) => line.accountCode === draft.bankAccountCode);
  const addLine = () => draft.description && draft.statementAmount !== 0 && update((s) => addAudit({ ...s, bankReconLines: [...(s.bankReconLines ?? []), { ...draft, id: id('BRL') }] }, 'import', 'bank_statement_line', draft.description, 'Bank statement line added for reconciliation'), L(locale, 'Statement line added', 'تمت إضافة سطر كشف البنك'));
  const matchLine = (lineId: string, journalRef: string) => update((s) => addAudit({ ...s, bankReconLines: (s.bankReconLines ?? []).map((l) => l.id === lineId ? { ...l, matchedJournalRef: journalRef, status: 'matched' } : l) }, 'match', 'bank_reconciliation', journalRef, 'Bank statement line matched to ledger'), L(locale, 'Bank line matched', 'تمت مطابقة سطر البنك'));
  return <div className="page-grid"><Card title={L(locale, 'Bank reconciliation workbench', 'مساحة مطابقة البنوك')} icon={<Banknote/>}><div className="form-grid"><Field label={L(locale, 'Bank account', 'الحساب البنكي')}><select value={draft.bankAccountCode} onChange={(e) => setDraft({ ...draft, bankAccountCode: e.target.value })}><option value="1020">1020 - Bank Accounts</option><option value="1010">1010 - Cash on Hand</option><option value="1100">1100 - POS Clearing</option></select></Field><Field label={L(locale, 'Statement date', 'تاريخ الكشف')}><input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })}/></Field><Field label={L(locale, 'Description', 'الوصف')}><input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })}/></Field><Field label={L(locale, 'Statement amount', 'مبلغ الكشف')}><input type="number" value={draft.statementAmount} onChange={(e) => setDraft({ ...draft, statementAmount: Number(e.target.value) })}/></Field></div><button onClick={addLine}><Plus size={16}/>{L(locale, 'Add statement line', 'إضافة سطر كشف')}</button></Card><Card title={L(locale, 'Unmatched bank statement lines', 'سطور كشف غير مطابقة')} icon={<Search/>}><Table headers={[L(locale, 'Date', 'التاريخ'), L(locale, 'Description', 'الوصف'), L(locale, 'Amount', 'المبلغ'), L(locale, 'Match to ledger', 'مطابقة مع الأستاذ')]} rows={(state.bankReconLines ?? []).filter((l) => l.status !== 'matched').map((l) => [l.date, l.description, money(l.statementAmount, locale), <select onChange={(e) => e.target.value && matchLine(l.id, e.target.value)} defaultValue=""><option value="">—</option>{bankLedger.map(({ journal, line }) => <option key={journal.ref + line.id} value={journal.ref}>{journal.date} · {journal.ref} · {money(line.debit - line.credit, locale)}</option>)}</select>])}/></Card><Card title={L(locale, 'Matched lines', 'السطور المطابقة')} icon={<ShieldCheck/>}><Table headers={[L(locale, 'Date', 'التاريخ'), L(locale, 'Description', 'الوصف'), L(locale, 'Amount', 'المبلغ'), L(locale, 'Journal', 'القيد')]} rows={(state.bankReconLines ?? []).filter((l) => l.status === 'matched').map((l) => [l.date, l.description, money(l.statementAmount, locale), l.matchedJournalRef ?? '—'])}/></Card></div>;
}

function PeriodsPage({ state, update, locale }: { state: ERPState; update: (fn: (s: ERPState) => ERPState, success?: string) => void; locale: Locale }) {
  const periods = (state.fiscalPeriods?.length ? state.fiscalPeriods : defaultFiscalPeriods()).slice().sort((a, b) => a.code.localeCompare(b.code));
  const toggle = (period: FiscalPeriod, status: FiscalPeriod['status']) => update((s) => addAudit({ ...s, fiscalPeriods: periods.map((p) => p.id === period.id ? { ...p, status, lockedBy: currentUser(s)?.name ?? 'Local Admin', lockedAt: new Date().toISOString() } : p) }, status, 'fiscal_period', period.code, `Fiscal period ${status}`), L(locale, 'Period updated', 'تم تحديث الفترة'));
  return <Card title={L(locale, 'Fiscal periods and closing controls', 'الفترات المالية وضوابط الإقفال')} icon={<ClipboardCheck/>}>
    <div className="notice">{L(locale, 'Locked periods block new controlled postings in local mode. Later Supabase functions will enforce the same rule server-side.', 'الفترات المقفلة تمنع الترحيلات الرقابية الجديدة محلياً. لاحقاً ستقوم وظائف Supabase بفرض نفس القاعدة من الخادم.')}</div>
    <Table headers={[L(locale, 'Period', 'الفترة'), L(locale, 'Start', 'البداية'), L(locale, 'End', 'النهاية'), L(locale, 'Posted journals', 'قيود مرحلة'), L(locale, 'Draft journals', 'قيود مسودة'), L(locale, 'Status', 'الحالة'), L(locale, 'Actions', 'إجراءات')]} rows={periods.map((p) => { const posted = state.journals.filter((j) => j.date >= p.startDate && j.date <= p.endDate && j.status === 'posted').length; const draft = state.journals.filter((j) => j.date >= p.startDate && j.date <= p.endDate && j.status === 'draft').length; return [p.code, p.startDate, p.endDate, `${posted}`, `${draft}`, <StockPill tone={p.status === 'open' ? 'good' : p.status === 'locked' ? 'warn' : 'bad'}>{p.status}</StockPill>, <div className="button-row"><button onClick={() => toggle(p, 'open')}>{L(locale, 'Open', 'فتح')}</button><button onClick={() => toggle(p, 'locked')} disabled={!canPerform(state, 'finance.period.lock')}>{L(locale, 'Lock', 'قفل')}</button><button onClick={() => toggle(p, 'closed')} disabled={!canPerform(state, 'finance.period.lock')} className="danger">{L(locale, 'Close', 'إغلاق')}</button></div>]; })}/>
  </Card>;
}

function FinanceControlsPage({ state, locale }: { state: ERPState; locale: Locale }) {
  const unbalanced = state.journals.filter((j) => !journalBalance(j).balanced);
  const missingAccounts = state.journals.flatMap((j) => j.lines).filter((l) => !state.chartAccounts.some((a) => a.code === l.accountCode));
  const costCenterMissing = state.journals.flatMap((j) => j.lines).filter((l) => state.chartAccounts.find((a) => a.code === l.accountCode)?.requireCostCenter && (!l.costCenterId || l.costCenterId === 'company'));
  const truth = evaluateFinanceTruthLayer(state);
  return <div className="page-grid">
    <div className="kpi-grid"><KPI label={L(locale, 'Finance truth score', 'درجة الحقيقة المالية')} value={`${truth.truthScore}%`} hint={L(locale, 'Database truth layer confidence', 'ثقة طبقة الحقيقة في قاعدة البيانات')} icon={<ShieldCheck/>}/><KPI label={L(locale, 'Unbalanced journals', 'قيود غير متوازنة')} value={`${unbalanced.length}`} hint={L(locale, 'Must be zero', 'يجب أن يكون صفر')} icon={<Calculator/>}/><KPI label={L(locale, 'Missing accounts', 'حسابات غير موجودة')} value={`${missingAccounts.length}`} hint={L(locale, 'COA validation', 'تحقق دليل الحسابات')} icon={<Search/>}/><KPI label={L(locale, 'Missing cost centers', 'مراكز تكلفة مفقودة')} value={`${costCenterMissing.length}`} hint={L(locale, 'Required dimensions', 'أبعاد مطلوبة')} icon={<Layers/>}/></div>
    <Card title={L(locale, 'Truth layer findings', 'ملاحظات طبقة الحقيقة')} icon={<ListChecks/>}><Table headers={[L(locale, 'Severity', 'الخطورة'), L(locale, 'Area', 'المجال'), L(locale, 'Finding', 'الملاحظة'), L(locale, 'Action', 'الإجراء')]} rows={truth.findings.map((finding) => [<StockPill tone={finding.severity === 'critical' ? 'bad' : finding.severity === 'warning' ? 'warn' : 'good'}>{finding.severity}</StockPill>, finding.area, finding.issue, finding.action])}/></Card>
    <Card title={L(locale, 'Control exceptions', 'الملاحظات الرقابية')} icon={<ShieldCheck/>}><Table headers={[L(locale, 'Type', 'النوع'), L(locale, 'Reference', 'المرجع'), L(locale, 'Comment', 'ملاحظة')]} rows={[...unbalanced.map((j) => [L(locale, 'Unbalanced', 'غير متوازن'), j.ref, money(journalBalance(j).diff, locale)]), ...missingAccounts.map((l) => [L(locale, 'Missing account', 'حساب مفقود'), l.accountCode, l.memo]), ...costCenterMissing.map((l) => [L(locale, 'Cost center required', 'مركز تكلفة مطلوب'), l.accountCode, l.memo])]}/></Card>
  </div>;
}

function PostingRulesPage({ locale }: { locale: Locale }) {
  return <div className="page-grid">
    <Card title={L(locale, 'Accounting posting rules', 'قواعد الترحيل المحاسبي')} icon={<ListChecks/>}>
      <Table headers={[L(locale, 'Source document', 'مستند المصدر'), L(locale, 'Debit', 'مدين'), L(locale, 'Credit', 'دائن'), L(locale, 'Notes', 'ملاحظات')]} rows={[
        [L(locale, 'Purchase invoice', 'فاتورة شراء'), L(locale, 'Inventory + VAT Input', 'المخزون + ضريبة المدخلات'), L(locale, 'AP / Bank / Cash', 'ذمم دائنة / بنك / نقدية'), L(locale, 'Multi-line invoice controls average cost; stock purchase has no cost center', 'فاتورة متعددة البنود تحدد متوسط التكلفة بدون مركز تكلفة عند شراء المخزون')],
        [L(locale, 'Supplier payment', 'سداد مورد'), L(locale, 'Accounts Payable', 'الذمم الدائنة'), L(locale, 'Bank / Cash', 'بنك / نقدية'), L(locale, 'Payment approval later through authority matrix', 'اعتماد السداد لاحقاً عبر مصفوفة الصلاحيات')],
        [L(locale, 'Sales / POS batch', 'دفعة مبيعات / كاشير'), L(locale, 'Cash/Card/POS clearing + COGS', 'نقدية/بطاقات/وسيط + تكلفة مبيعات'), L(locale, 'Sales + VAT Output + Inventory', 'مبيعات + ضريبة مخرجات + مخزون'), L(locale, 'VAT inclusive/exclusive handled from menu item', 'معالجة السعر شامل/غير شامل الضريبة من صنف البيع')],
        [L(locale, 'Production batch', 'دفعة إنتاج'), L(locale, 'Semi-finished inventory', 'مخزون نصف مصنع'), L(locale, 'Raw material inventory', 'مخزون مواد خام'), L(locale, 'No food cost until final sale', 'لا تسجل تكلفة غذاء إلا عند البيع النهائي')],
        [L(locale, 'Depreciation', 'الإهلاك'), L(locale, 'Depreciation expense', 'مصروف الإهلاك'), L(locale, 'Accumulated depreciation', 'مجمع الإهلاك'), L(locale, 'Monthly run per asset', 'تشغيل شهري لكل أصل')],
      ]}/>
    </Card>
    <Card title={L(locale, 'v309 posting contracts', 'عقود الترحيل إصدار ٣٠٩')} icon={<ShieldCheck/>}>
      <Table headers={[L(locale, 'Contract', 'العقد'), L(locale, 'Source', 'المصدر'), L(locale, 'Expected debit', 'المدين المتوقع'), L(locale, 'Expected credit', 'الدائن المتوقع'), L(locale, 'Controls', 'الضوابط')]} rows={FINANCE_POSTING_CONTRACTS.map((contract) => [contract.key.replace(/_/g, ' '), contract.sourceModule, contract.expectedDebits.join(' + '), contract.expectedCredits.join(' + '), contract.requiredControls.join(', ')])}/>
    </Card>
  </div>;
}


function HRPage({ state, update, locale }: { state: ERPState; update: (fn: (s: ERPState) => ERPState, success?: string) => void; locale: Locale }) { const [emp, setEmp] = useState<Employee>({ id: '', code: '', name: '', branchId: 'company', department: '', jobTitle: '', salary: 0, active: true }); const [punchEmployee, setPunchEmployee] = useState(''); return <div className="page-grid"><Card title={L(locale, 'Employees', 'الموظفون')} icon={<Users/>}><div className="form-grid"><Field label={L(locale, 'Code', 'الكود')}><input value={emp.code} onChange={(e) => setEmp({ ...emp, code: e.target.value })}/></Field><Field label={L(locale, 'Name', 'الاسم')}><input value={emp.name} onChange={(e) => setEmp({ ...emp, name: e.target.value })}/></Field><Field label={L(locale, 'Branch', 'الفرع')}><select value={emp.branchId} onChange={(e) => setEmp({ ...emp, branchId: e.target.value })}><option value="company">{L(locale, 'Company', 'الشركة')}</option>{state.branches.map((b) => <option key={b.id} value={b.id}>{L(locale, b.nameEn, b.nameAr)}</option>)}</select></Field><Field label={L(locale, 'Department', 'القسم')}><input value={emp.department} onChange={(e) => setEmp({ ...emp, department: e.target.value })}/></Field><Field label={L(locale, 'Job title', 'المسمى الوظيفي')}><input value={emp.jobTitle} onChange={(e) => setEmp({ ...emp, jobTitle: e.target.value })}/></Field><Field label={L(locale, 'Salary', 'الراتب')}><input type="number" value={emp.salary} onChange={(e) => setEmp({ ...emp, salary: Number(e.target.value) })}/></Field></div><button onClick={() => emp.code && emp.name && update((s) => addAudit({ ...s, employees: upsert(s.employees, { ...emp, id: emp.id || id('EMP') }) }, emp.id ? 'edit' : 'create', 'employee', emp.code, 'Employee saved'), L(locale, 'Employee saved', 'تم حفظ الموظف'))}><Save size={16}/>{L(locale, 'Save Employee', 'حفظ الموظف')}</button><Table headers={[L(locale, 'Code', 'الكود'), L(locale, 'Name', 'الاسم'), L(locale, 'Branch', 'الفرع'), L(locale, 'Salary', 'الراتب'), L(locale, 'Actions', 'إجراءات')]} rows={state.employees.map((e) => [e.code, e.name, branchName(state, e.branchId, locale), money(e.salary, locale), actionButtons(() => setEmp(e), () => update((s) => addAudit({ ...s, employees: s.employees.map((x) => x.id === e.id ? { ...x, active: false } : x) }, 'delete', 'employee', e.code, 'Employee deleted'), L(locale, 'Employee deleted', 'تم حذف الموظف')), locale)])}/></Card><Card title={L(locale, 'Punch in / out', 'تسجيل الحضور والانصراف')} icon={<ClipboardCheck/>}><div className="form-grid"><Field label={L(locale, 'Employee', 'الموظف')}><select value={punchEmployee} onChange={(e) => setPunchEmployee(e.target.value)}><option value="">—</option>{state.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field></div><div className="button-row"><button onClick={() => punchEmployee && update((s) => addAudit({ ...s, attendance: [...s.attendance, { id: id('ATT'), employeeId: punchEmployee, date: today(), type: 'punch_in', time: nowTime(), source: 'manual' }] }, 'punch_in', 'attendance', punchEmployee, 'Manual punch in'), L(locale, 'Punch in recorded', 'تم تسجيل الحضور'))}>{L(locale, 'Punch In', 'تسجيل حضور')}</button><button onClick={() => punchEmployee && update((s) => addAudit({ ...s, attendance: [...s.attendance, { id: id('ATT'), employeeId: punchEmployee, date: today(), type: 'punch_out', time: nowTime(), source: 'manual' }] }, 'punch_out', 'attendance', punchEmployee, 'Manual punch out'), L(locale, 'Punch out recorded', 'تم تسجيل الانصراف'))}>{L(locale, 'Punch Out', 'تسجيل انصراف')}</button></div><Table headers={[L(locale, 'Employee', 'الموظف'), L(locale, 'Date', 'التاريخ'), L(locale, 'Type', 'النوع'), L(locale, 'Time', 'الوقت')]} rows={state.attendance.slice(-10).reverse().map((a) => [state.employees.find((e) => e.id === a.employeeId)?.name ?? '—', a.date, a.type, a.time])}/></Card></div>; }

function ControlCenterPage({ state, totals, update, locale, notify }: { state: ERPState; totals: Totals; update: (fn: (s: ERPState) => ERPState, success?: string) => void; locale: Locale; notify: (type: 'success' | 'warning' | 'error', message: string) => void }) {
  const [tab, setTab] = useState<'overview' | 'lifecycle' | 'connections' | 'inventory' | 'imports' | 'audit' | 'hardening' | 'documents' | 'backend'>('overview');
  const checks = coreControlChecks(state, totals, locale);
  const score = controlScoreFromChecks(checks);
  const critical = checks.filter((c) => c.status === 'critical').length;
  const warnings = checks.filter((c) => c.status === 'warning').length;
  const lifecycle = documentLifecycleRows(state, locale);
  const available = availableRows(state);
  const zeroCost = available.filter((r) => r.onHand > 0 && r.cost <= 0.0001);
  const negative = available.filter((r) => r.available < -0.0001 || r.onHand < -0.0001);
  const journalRows = journalIntegrity(state);
  const repair = () => update((s) => repairCoreLinks(s), L(locale, 'Safe local links repaired where possible', 'تم إصلاح الروابط المحلية الآمنة حيث أمكن'));
  const exportChecks = () => saveFile('erp-control-checks-v23.csv', rowsToCsv(checks.map((c) => ({ area: c.area, check: c.check, status: c.status, detail: c.detail, action: c.action }))), 'text/csv;charset=utf-8');
  const duplicateImportRisk = state.importProfiles.length ? L(locale, 'Saved mapping profiles exist. XLSX parser/backend import still pending.', 'توجد خرائط محفوظة. محلل XLSX والاستيراد الخلفي ما زالا مطلوبين.') : L(locale, 'No import profiles yet. Create saved maps before real uploads.', 'لا توجد خرائط استيراد بعد. أنشئ خرائط محفوظة قبل الرفع الحقيقي.');
  const hardening = hardeningRows(state, totals, locale);
  const hardeningPct = hardeningScore(hardening);
  const packRows = documentPackRows(locale);
  const checkPill = (status: ControlStatus) => status === 'ok' ? <StockPill tone="good">OK</StockPill> : status === 'warning' ? <StockPill tone="warn">Warning</StockPill> : <StockPill tone="bad">Critical</StockPill>;
  return <div className="page-grid control-workspace">
    <Card title={L(locale, 'Connected ERP Control Center', 'مركز الرقابة المترابط للنظام')} icon={<ShieldCheck/>} action={<button onClick={exportChecks}><Download size={16}/>{L(locale, 'Export checks', 'تصدير الفحوص')}</button>}>
      <div className="notice">{L(locale, 'This page connects accounting, purchasing, inventory, production, sales, imports, permissions, fiscal periods, and audit into one control layer. It does not replace a real backend, but it helps catch disconnected local-trial logic before live testing.', 'هذه الصفحة تربط المحاسبة والمشتريات والمخزون والإنتاج والمبيعات والاستيراد والصلاحيات والفترات والتدقيق في طبقة رقابة واحدة. لا تستبدل الخلفية الحقيقية، لكنها تكشف انقطاع منطق التجربة المحلية قبل الاختبار الحي.')}</div>
      <div className="finance-tab-grid">{(['overview','lifecycle','connections','inventory','imports','audit','hardening','documents','backend'] as const).map((t) => <button key={t} className={tab === t ? 'active-tab' : ''} onClick={() => setTab(t)}>{t === 'overview' ? <LayoutDashboard size={16}/> : t === 'lifecycle' ? <ClipboardCheck size={16}/> : t === 'connections' ? <Layers size={16}/> : t === 'inventory' ? <Archive size={16}/> : t === 'imports' ? <Upload size={16}/> : t === 'hardening' ? <ShieldCheck size={16}/> : t === 'documents' ? <FileText size={16}/> : t === 'backend' ? <Database size={16}/> : <ListChecks size={16}/>}{{ overview: L(locale, 'Overview', 'نظرة عامة'), lifecycle: L(locale, 'Lifecycle', 'دورة الحياة'), connections: L(locale, 'Connections', 'الترابط'), inventory: L(locale, 'Inventory Engine', 'محرك المخزون'), imports: L(locale, 'Import Governance', 'حوكمة الاستيراد'), audit: L(locale, 'Audit Readiness', 'جاهزية التدقيق'), hardening: L(locale, 'Enterprise Hardening', 'التقوية المؤسسية'), documents: L(locale, 'Document Pack', 'حزمة المستندات'), backend: L(locale, 'Backend Migration', 'الانتقال للخلفية') }[t]}</button>)}</div>
    </Card>
    {tab === 'overview' && <div className="page-grid"><div className="kpi-grid"><KPI label={L(locale, 'Control Score', 'درجة الرقابة')} value={`${score}%`} hint={L(locale, 'Connected checks passed', 'فحوص الترابط الناجحة')} icon={<ShieldCheck/>}/><KPI label={L(locale, 'Critical Issues', 'مشاكل حرجة')} value={`${critical}`} hint={L(locale, 'Must fix before live trial', 'يجب إصلاحها قبل التجربة')} icon={<LockKeyhole/>}/><KPI label={L(locale, 'Warnings', 'تنبيهات')} value={`${warnings}`} hint={L(locale, 'Needs review', 'تحتاج مراجعة')} icon={<ClipboardCheck/>}/><KPI label={L(locale, 'Lifecycle Docs', 'مستندات الدورة')} value={`${lifecycle.length}`} hint={L(locale, 'Tracked documents', 'مستندات متتبعة')} icon={<FileText/>}/></div><Card title={L(locale, 'Control checklist', 'قائمة الفحص الرقابي')} icon={<ListChecks/>}><Table headers={[L(locale, 'Area', 'المجال'), L(locale, 'Check', 'الفحص'), L(locale, 'Status', 'الحالة'), L(locale, 'Detail', 'التفاصيل'), L(locale, 'Action', 'الإجراء')]} rows={checks.map((c) => [c.area, c.check, checkPill(c.status), c.detail, c.action])}/><div className="button-row"><button onClick={repair}><RefreshCw size={16}/>{L(locale, 'Repair safe missing links', 'إصلاح الروابط الآمنة المفقودة')}</button><button onClick={() => notify('warning', L(locale, 'Backend persistence is still required before production use.', 'ما زالت قاعدة البيانات الخلفية مطلوبة قبل التشغيل الفعلي.'))}><Database size={16}/>{L(locale, 'Production warning', 'تنبيه التشغيل')}</button></div></Card></div>}
    {tab === 'lifecycle' && <Card title={L(locale, 'End-to-end document lifecycle register', 'سجل دورة حياة المستندات الشامل')} icon={<ClipboardCheck/>}><Table headers={[L(locale, 'Module', 'الموديول'), L(locale, 'Reference', 'المرجع'), L(locale, 'Status', 'الحالة'), L(locale, 'Amount', 'المبلغ'), L(locale, 'Owner', 'المسؤول'), L(locale, 'Next step', 'الخطوة التالية')]} rows={lifecycle.map((r) => [r.module, r.ref, <StockPill tone={r.tone}>{r.status}</StockPill>, r.amount ? money(r.amount, locale) : '—', r.owner, r.nextStep])}/></Card>}
    {tab === 'connections' && <div className="page-grid two"><Card title={L(locale, 'Posting connection matrix', 'مصفوفة ترابط الترحيل')} icon={<Layers/>}><Table headers={[L(locale, 'Business event', 'حدث العمل'), L(locale, 'Inventory impact', 'أثر المخزون'), L(locale, 'Accounting impact', 'الأثر المحاسبي'), L(locale, 'Cost center timing', 'وقت مركز التكلفة')]} rows={[[L(locale, 'PO approval', 'اعتماد أمر الشراء'), L(locale, 'No stock yet', 'لا مخزون بعد'), L(locale, 'No GL yet', 'لا قيد بعد'), L(locale, 'No cost center yet', 'لا مركز تكلفة بعد')], [L(locale, 'GRN receiving', 'استلام البضائع'), L(locale, 'Stock + lots + bins increase', 'زيادة المخزون والتشغيلات والمواقع'), 'Dr Inventory / Cr GRNI', L(locale, 'Company/store only', 'الشركة/المخزن فقط')], [L(locale, 'Supplier invoice match', 'مطابقة فاتورة المورد'), L(locale, 'No duplicate stock', 'لا تكرار للمخزون'), 'Dr GRNI + VAT / Cr AP', L(locale, 'No usage cost center', 'لا مركز استخدام')], [L(locale, 'Supplier payment', 'سداد مورد'), L(locale, 'No stock change', 'لا حركة مخزون'), 'Dr AP / Cr Bank or Cash', L(locale, 'Company/bank', 'الشركة/البنك')], [L(locale, 'Production batch', 'دفعة إنتاج'), L(locale, 'Raw out, semi-finished in', 'خروج خام ودخول نصف مصنع'), 'Dr Semi-finished / Cr Raw Inventory', L(locale, 'Production/store trace', 'أثر الإنتاج/المخزن')], [L(locale, 'Sales recipe posting', 'ترحيل وصفة البيع'), L(locale, 'Ingredients out', 'خروج المكونات'), 'Dr COGS / Cr Inventory + sales/VAT', L(locale, 'Usage cost center applied', 'يُطبق مركز تكلفة الاستخدام')]]}/></Card><Card title={L(locale, 'Journal integrity', 'سلامة القيود')} icon={<Calculator/>}><Table headers={[L(locale, 'Journal', 'القيد'), L(locale, 'Source', 'المصدر'), L(locale, 'Debit', 'مدين'), L(locale, 'Credit', 'دائن'), L(locale, 'Diff', 'الفرق'), L(locale, 'Status', 'الحالة')]} rows={journalRows.slice(-40).reverse().map((r) => [r.journal.ref, r.journal.source, money(r.debit, locale), money(r.credit, locale), money(r.diff, locale), r.balanced ? <StockPill tone="good">Balanced</StockPill> : <StockPill tone="bad">Unbalanced</StockPill>])}/></Card></div>}
    {tab === 'inventory' && <div className="page-grid"><div className="kpi-grid"><KPI label={L(locale, 'Available Rows', 'أسطر الرصيد المتاح')} value={`${available.length}`} hint={L(locale, 'On hand minus reservations/holds', 'الموجود ناقص الحجوزات والحجز')} icon={<Archive/>}/><KPI label={L(locale, 'Zero Cost Rows', 'أرصدة بدون تكلفة')} value={`${zeroCost.length}`} hint={L(locale, 'Should disappear after purchases', 'ينبغي أن تختفي بعد الشراء')} icon={<Calculator/>}/><KPI label={L(locale, 'Negative Rows', 'أرصدة سالبة')} value={`${negative.length}`} hint={L(locale, 'Block live posting', 'تمنع الترحيل الحي')} icon={<LockKeyhole/>}/><KPI label={L(locale, 'Stock Value', 'قيمة المخزون')} value={money(totals.stockValue, locale)} hint={L(locale, 'Average purchase cost', 'متوسط تكلفة الشراء')} icon={<Coins/>}/></div><Card title={L(locale, 'Inventory exception workbench', 'منصة استثناءات المخزون')} icon={<Archive/>}><Table headers={[L(locale, 'Store', 'المخزن'), L(locale, 'Item', 'الصنف'), L(locale, 'On hand', 'الموجود'), L(locale, 'Reserved', 'محجوز'), L(locale, 'Quarantine/Expired', 'حجز/منتهي'), L(locale, 'Available', 'المتاح'), L(locale, 'Avg cost', 'متوسط التكلفة'), L(locale, 'Status', 'الحالة')]} rows={available.filter((r) => r.available < 0 || r.cost <= 0 || r.quarantined || r.expired).map((r) => [L(locale, r.store.nameEn, r.store.nameAr), `${r.item.sku} - ${L(locale, r.item.nameEn, r.item.nameAr)}`, qty(r.onHand, r.item.purchaseUnit), qty(r.reserved), qty(r.quarantined + r.expired), qty(r.available), money(r.cost, locale), r.available < 0 ? <StockPill tone="bad">Negative</StockPill> : r.cost <= 0 ? <StockPill tone="warn">No Cost</StockPill> : <StockPill tone="warn">Hold</StockPill>])}/></Card></div>}
    {tab === 'imports' && <div className="page-grid two"><Card title={L(locale, 'Import governance status', 'حالة حوكمة الاستيراد')} icon={<Upload/>}><div className="notice">{duplicateImportRisk}</div><Table headers={[L(locale, 'Profile', 'الخريطة'), L(locale, 'Type', 'النوع'), L(locale, 'File', 'الملف'), L(locale, 'Duplicate key', 'مفتاح التكرار'), L(locale, 'Approval', 'الاعتماد')]} rows={state.importProfiles.map((p) => [p.name, p.importType, p.fileType.toUpperCase(), p.duplicateKey, p.requiresApproval ? L(locale, 'Required', 'مطلوب') : L(locale, 'Not required', 'غير مطلوب')])}/></Card><Card title={L(locale, 'Required before real uploads', 'مطلوب قبل الرفع الحقيقي')} icon={<FileSpreadsheet/>}><Table headers={[L(locale, 'Control', 'الرقابة'), L(locale, 'Status', 'الحالة')]} rows={[[L(locale, 'XLSX parser connected', 'ربط محلل XLSX'), <StockPill tone="warn">Pending backend/parser</StockPill>], [L(locale, 'Saved mapping templates', 'خرائط محفوظة'), state.importProfiles.length ? <StockPill tone="good">Ready</StockPill> : <StockPill tone="warn">Missing</StockPill>], [L(locale, 'Duplicate detection', 'كشف التكرار'), <StockPill tone="info">Designed</StockPill>], [L(locale, 'Rollback bad import', 'التراجع عن استيراد خاطئ'), <StockPill tone="warn">Pending backend</StockPill>], [L(locale, 'Row-level error file', 'ملف أخطاء بالصفوف'), <StockPill tone="info">Designed</StockPill>]]}/></Card></div>}
    {tab === 'audit' && <div className="page-grid"><Card title={L(locale, 'Audit readiness', 'جاهزية التدقيق')} icon={<ListChecks/>}><Table headers={[L(locale, 'Time', 'الوقت'), L(locale, 'Action', 'الإجراء'), L(locale, 'Entity', 'الكيان'), L(locale, 'Reference', 'المرجع'), L(locale, 'User', 'المستخدم'), L(locale, 'Note', 'ملاحظة')]} rows={state.audits.slice(0, 80).map((a) => [a.at.slice(0, 19).replace('T', ' '), a.action, a.entity, a.ref, a.user, a.note])}/></Card></div>}
    {tab === 'hardening' && <div className="page-grid"><div className="kpi-grid"><KPI label={L(locale, 'Hardening Score', 'درجة التقوية')} value={`${hardeningPct}%`} hint={L(locale, 'Prototype-to-enterprise controls', 'رقابة الانتقال من نموذج إلى مؤسسة')} icon={<ShieldCheck/>}/><KPI label={L(locale, 'Ready Controls', 'ضوابط جاهزة')} value={`${hardening.filter((r) => r.status === 'ready').length}`} hint={L(locale, 'Operationally usable in local trial', 'قابلة للاستخدام في التجربة المحلية')} icon={<ClipboardCheck/>}/><KPI label={L(locale, 'Partial Controls', 'ضوابط جزئية')} value={`${hardening.filter((r) => r.status === 'partial').length}`} hint={L(locale, 'Needs backend or deeper workflow', 'تحتاج خلفية أو تعميق')} icon={<ListChecks/>}/><KPI label={L(locale, 'Missing Critical', 'نواقص حرجة')} value={`${hardening.filter((r) => r.status === 'missing').length}`} hint={L(locale, 'Must close before production', 'يجب إغلاقها قبل التشغيل')} icon={<LockKeyhole/>}/></div><Card title={L(locale, 'Enterprise hardening register', 'سجل التقوية المؤسسية')} icon={<ShieldCheck/>}><Table headers={[L(locale, 'Area', 'المجال'), L(locale, 'Control', 'الضابط'), L(locale, 'Status', 'الحالة'), L(locale, 'Detail', 'التفصيل'), L(locale, 'Next step', 'الخطوة التالية')]} rows={hardening.map((r) => [r.area, r.control, <StockPill tone={r.status === 'ready' ? 'good' : r.status === 'partial' ? 'warn' : 'bad'}>{r.status}</StockPill>, r.detail, r.nextStep])}/></Card></div>}
    {tab === 'documents' && <div className="page-grid two"><Card title={L(locale, 'Printable document pack readiness', 'جاهزية حزمة المستندات المطبوعة')} icon={<FileText/>}><Table headers={[L(locale, 'Document', 'المستند'), L(locale, 'Status', 'الحالة'), L(locale, 'Required controls', 'الضوابط المطلوبة')]} rows={packRows.map((r) => [r.doc, <StockPill tone="info">{r.status}</StockPill>, r.controls])}/><div className="button-row"><button onClick={() => saveFile('document-pack-readiness-v23.csv', rowsToCsv(packRows.map((r) => ({ document: r.doc, status: r.status, controls: r.controls }))), 'text/csv;charset=utf-8')}><Download size={16}/>{L(locale, 'Export document pack', 'تصدير حزمة المستندات')}</button></div></Card><Card title={L(locale, 'Document timeline standard', 'معيار خط زمني للمستند')} icon={<ClipboardCheck/>}><div className="steps">{[L(locale, 'Draft created by user', 'مسودة أنشأها المستخدم'), L(locale, 'Submitted for approval with comments', 'إرسال للاعتماد مع التعليقات'), L(locale, 'Approved according to authority matrix', 'اعتماد حسب مصفوفة الصلاحيات'), L(locale, 'Posted to inventory/accounting if applicable', 'ترحيل للمخزون/المحاسبة إن وجد'), L(locale, 'Locked from editing; reversal only', 'مقفل من التعديل؛ العكس فقط'), L(locale, 'Audit trail and attachments retained', 'حفظ التدقيق والمرفقات')].map((x, i) => <div className="step" key={i}><strong>{i + 1}</strong> {x}</div>)}</div></Card></div>}
    {tab === 'backend' && <div className="page-grid"><Card title={L(locale, 'Supabase production migration checklist', 'قائمة انتقال Supabase للإنتاج')} icon={<Database/>}><div className="notice warning">{L(locale, 'This remains the biggest gap: local mode is for workflow trials only. Real ERP use requires database, auth, RLS, server-side posting, storage, and backups.', 'هذا أكبر فارق متبقٍ: الوضع المحلي للتجارب فقط. الاستخدام الحقيقي يحتاج قاعدة بيانات ومصادقة وأمان صفوف وترحيل خادمي وتخزين ونسخ احتياطي.')}</div><Table headers={[L(locale, 'Layer', 'الطبقة'), L(locale, 'Required implementation', 'التنفيذ المطلوب')]} rows={backendMigrationRows(locale)}/></Card></div>}
  </div>;
}

export default AppShell;
