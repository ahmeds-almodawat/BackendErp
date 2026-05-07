export type FinanceTab =
  | 'dashboard'
  | 'coa'
  | 'manual'
  | 'journals'
  | 'gl'
  | 'trial'
  | 'income'
  | 'balance'
  | 'cashflow'
  | 'ap'
  | 'paymentRun'
  | 'supplierStatement'
  | 'ar'
  | 'banking'
  | 'reconciliation'
  | 'assets'
  | 'depreciation'
  | 'vat'
  | 'branchPnl'
  | 'costCenter'
  | 'opening'
  | 'periods'
  | 'controls'
  | 'postingRules';

export type FinanceTabDefinition = {
  key: FinanceTab;
  en: string;
  ar: string;
  icon: 'dashboard' | 'book' | 'edit' | 'file' | 'database' | 'calculator' | 'pie' | 'landmark' | 'banknote' | 'wallet' | 'coins' | 'creditCard' | 'shield' | 'building' | 'refresh' | 'receipt' | 'store' | 'layers' | 'plus' | 'clipboard' | 'checks';
  ownership: 'core-ledger' | 'subledger' | 'reporting' | 'period-close' | 'control';
};

export const financeTabDefinitions: FinanceTabDefinition[] = [
  { key: 'dashboard', en: 'Accounting Dashboard', ar: 'لوحة المحاسبة', icon: 'dashboard', ownership: 'reporting' },
  { key: 'coa', en: 'Chart of Accounts', ar: 'دليل الحسابات', icon: 'book', ownership: 'core-ledger' },
  { key: 'manual', en: 'Manual Journal Entry', ar: 'قيد يومية يدوي', icon: 'edit', ownership: 'core-ledger' },
  { key: 'journals', en: 'Journal Register', ar: 'سجل القيود', icon: 'file', ownership: 'core-ledger' },
  { key: 'gl', en: 'General Ledger', ar: 'الأستاذ العام', icon: 'database', ownership: 'core-ledger' },
  { key: 'trial', en: 'Trial Balance', ar: 'ميزان المراجعة', icon: 'calculator', ownership: 'reporting' },
  { key: 'income', en: 'Income Statement', ar: 'قائمة الدخل', icon: 'pie', ownership: 'reporting' },
  { key: 'balance', en: 'Balance Sheet', ar: 'قائمة المركز المالي', icon: 'landmark', ownership: 'reporting' },
  { key: 'cashflow', en: 'Cash Flow', ar: 'التدفقات النقدية', icon: 'banknote', ownership: 'reporting' },
  { key: 'ap', en: 'Accounts Payable', ar: 'الذمم الدائنة', icon: 'wallet', ownership: 'subledger' },
  { key: 'paymentRun', en: 'AP Payment Run', ar: 'تشغيل سداد الموردين', icon: 'coins', ownership: 'subledger' },
  { key: 'supplierStatement', en: 'Supplier Statements', ar: 'كشوف حساب الموردين', icon: 'file', ownership: 'subledger' },
  { key: 'ar', en: 'Accounts Receivable', ar: 'الذمم المدينة', icon: 'creditCard', ownership: 'subledger' },
  { key: 'banking', en: 'Banking & Cash', ar: 'البنوك والنقدية', icon: 'banknote', ownership: 'subledger' },
  { key: 'reconciliation', en: 'Bank Reconciliation', ar: 'مطابقة البنوك', icon: 'shield', ownership: 'control' },
  { key: 'assets', en: 'Fixed Assets', ar: 'الأصول الثابتة', icon: 'building', ownership: 'subledger' },
  { key: 'depreciation', en: 'Depreciation Run', ar: 'تشغيل الإهلاك', icon: 'refresh', ownership: 'period-close' },
  { key: 'vat', en: 'VAT Report', ar: 'تقرير الضريبة', icon: 'receipt', ownership: 'reporting' },
  { key: 'branchPnl', en: 'Branch P&L', ar: 'ربحية الفروع', icon: 'store', ownership: 'reporting' },
  { key: 'costCenter', en: 'Cost Center Report', ar: 'تقرير مراكز التكلفة', icon: 'layers', ownership: 'reporting' },
  { key: 'opening', en: 'Opening Balances', ar: 'الأرصدة الافتتاحية', icon: 'plus', ownership: 'core-ledger' },
  { key: 'periods', en: 'Fiscal Periods', ar: 'الفترات المالية', icon: 'clipboard', ownership: 'period-close' },
  { key: 'controls', en: 'Controls', ar: 'الرقابة', icon: 'shield', ownership: 'control' },
  { key: 'postingRules', en: 'Posting Rules', ar: 'قواعد الترحيل', icon: 'checks', ownership: 'control' },
];
