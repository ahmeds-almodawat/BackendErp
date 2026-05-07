import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowRight, BarChart3, Calculator, ChefHat, CheckCircle2, CreditCard, Database, Download, FileSpreadsheet, Link2, PackageCheck, RefreshCw, Save, ShieldCheck, Store, Trash2, Upload, Wallet, Wrench } from 'lucide-react';

type Locale = 'en' | 'ar';
type FoodicsKind = 'orders' | 'lines' | 'payments' | 'branch_summary' | 'payment_summary' | 'unknown';
type PostingMode = 'report' | 'sales' | 'full';
type Tone = 'good' | 'warn' | 'bad' | 'info';
type IssueKey = 'duplicate_orders' | 'lines_without_header' | 'payments_without_header' | 'orders_without_payment' | 'unmapped_branches' | 'unmapped_items' | 'missing_recipes' | 'branches_without_store' | 'zero_cost_demand' | 'stock_shortages' | 'reconciliation_difference' | 'duplicate_batch' | 'void_orders' | 'returned_orders' | 'discounts' | 'refund_payments';
type UploadedFoodicsFile = { id: string; name: string; kind: FoodicsKind; headers: string[]; rows: Array<Record<string, string>> };
type FoodicsBatchStatus = 'uploaded' | 'validated' | 'approved' | 'report_only' | 'posted_sales' | 'posted_full' | 'reversed';
type FoodicsBatchRecord = {
  id: string;
  ref: string;
  date: string;
  mode: PostingMode;
  status: FoodicsBatchStatus;
  orderCount: number;
  lineCount: number;
  paymentCount: number;
  orderGross: number;
  paymentTotal: number;
  difference: number;
  journalRefs: string[];
  stockMovementCount: number;
  salesDocCount: number;
  note: string;
  approvedAt?: string;
  approvedBy?: string;
  reversedAt?: string;
  reversalReason?: string;
  validationSummary?: string;
};
type MenuImportPreview = { rowNo: number; sku: string; nameEn: string; nameAr: string; category: string; sellingPrice: number; vatRate: number; priceIncludesVat: boolean; action: 'create' | 'update' | 'skip'; matchId?: string; warnings: string[]; barcode?: string; foodicsId?: string; isStockProduct?: boolean; source?: string };
type FoodicsMenuKind = 'products' | 'products_ingredients' | 'products_modifiers' | 'generic_menu' | 'unknown';
type UploadedFoodicsMenuFile = { id: string; name: string; kind: FoodicsMenuKind; headers: string[]; rows: Array<Record<string, string>> };
type RecipeImportPreview = { rowNo: number; productSku: string; productName: string; ingredientSku: string; ingredientName: string; qty: number; unit: string; productMatchId?: string; itemMatchId?: string; action: 'create_recipe_line' | 'skip'; warnings: string[] };
type ModifierImportPreview = { rowNo: number; productSku: string; productName: string; modifierName: string; modifierReference: string; min: number; max: number; free: number; unique: boolean; warnings: string[] };
type FoodicsPersistedSession = {
  files: UploadedFoodicsFile[];
  branchMap: Record<string, string>;
  itemMap: Record<string, string>;
  paymentMap: Record<string, string>;
  batchName: string;
  postingMode: PostingMode;
  batches: FoodicsBatchRecord[];
  persistedAt: string;
  degraded?: boolean;
};
type Props = { state: any; update: (fn: (s: any) => any, success?: string) => void; locale: Locale };

const FOODICS_STORAGE_KEY = 'restaurant-erp-v35-posting-reversal-control-session';
const L = (locale: Locale, en: string, ar: string) => locale === 'ar' ? ar : en;
const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
const today = () => new Date().toISOString().slice(0, 10);
const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/^\ufeff/, '').replace(/[\u200f\u200e]/g, '').replace(/\s+/g, ' ');
const numberValue = (value: unknown, fallback = 0) => { const n = Number(String(value ?? '').replace(/,/g, '').replace(/[\u200f\u200e]/g, '')); return Number.isFinite(n) ? n : fallback; };
const money = (value: number, locale: Locale) => new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 2 }).format(value || 0);
const qty = (value: number, unit = '') => `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(value || 0)}${unit ? ` ${unit}` : ''}`;
const unique = <T,>(rows: T[]) => Array.from(new Set(rows));

function parseCsv(text: string) {
  const rows: string[][] = [];
  let current = '', row: string[] = [], quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { current += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(current); current = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(current); current = '';
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
    } else current += char;
  }
  row.push(current);
  if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  const headers = (rows[0] ?? []).map((h) => h.replace(/^\ufeff/, '').trim());
  const data = rows.slice(1).map((cells) => Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ''])));
  return { headers, rows: data };
}
function rowsToCsv(rows: Array<Record<string, string | number | boolean>>) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = (value: unknown) => { const text = String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}
function saveFile(name: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
function detectKind(headers: string[]): FoodicsKind {
  const keys = headers.map(normalize);
  if (keys.includes('reference') && keys.includes('total_price') && keys.includes('closed_by')) return 'orders';
  if (keys.includes('order_reference') && keys.includes('sku') && keys.includes('tax_exclusive_total_price')) return 'lines';
  if (keys.includes('payment_method_name') && keys.includes('amount') && keys.includes('paid_at')) return 'payments';
  if (headers.some((h) => h.includes('إجمالي المبيعات')) && headers.some((h) => h.includes('مرجع الفرع'))) return 'branch_summary';
  if (headers.some((h) => h.includes('طريقة الدفع')) && headers.some((h) => h.includes('المبلغ الصافي'))) return 'payment_summary';
  return 'unknown';
}
function detectMenuKind(headers: string[]): FoodicsMenuKind {
  const keys = headers.map(normalize);
  if (keys.includes('id') && keys.includes('sku') && keys.includes('category_reference') && keys.includes('tax_group_reference') && keys.includes('is_stock_product')) return 'products';
  if (keys.includes('product_sku') && keys.includes('inventory_item_sku') && keys.includes('ingredient_cost')) return 'products_ingredients';
  if (keys.includes('product_sku') && keys.includes('modifier_reference') && keys.includes('minimum_options') && keys.includes('maximum_options')) return 'products_modifiers';
  if (keys.includes('sku') && keys.includes('name') && (keys.includes('price') || keys.includes('selling_price'))) return 'generic_menu';
  return 'unknown';
}
function yesNo(value: unknown) {
  const v = normalize(value);
  return ['yes', 'true', '1', 'active', 'نشط', 'نعم'].includes(v);
}
function categoryLabel(reference: string) {
  return reference ? `Foodics Category ${reference}` : 'Foodics Menu';
}
function pickValue(row: Record<string, string>, aliases: string[]) {
  const keys = Object.keys(row);
  const found = keys.find((key) => aliases.some((alias) => normalize(key) === normalize(alias)));
  return found ? String(row[found] ?? '').trim() : '';
}
function buildNativeProductPreview(rows: Array<Record<string, string>>, existingMenuItems: any[]): MenuImportPreview[] {
  const existingBySku = new Map(existingMenuItems.map((m: any) => [normalize(m.code), m]));
  return rows.map((row, index) => {
    const sku = pickValue(row, ['sku']);
    const name = pickValue(row, ['name']) || sku;
    const localized = pickValue(row, ['name_localized']) || name;
    const categoryRef = pickValue(row, ['category_reference']);
    const price = numberValue(pickValue(row, ['price']), 0);
    const cost = numberValue(pickValue(row, ['cost']), 0);
    const active = yesNo(pickValue(row, ['is_active']));
    const stockProduct = yesNo(pickValue(row, ['is_stock_product']));
    const existing = sku ? existingBySku.get(normalize(sku)) : undefined;
    const warnings: string[] = [];
    if (!sku) warnings.push('Missing SKU');
    if (!price) warnings.push('Missing price');
    if (!active) warnings.push('Inactive in Foodics');
    if (cost > 0) warnings.push('Foodics cost kept as reference only; ERP uses inventory average cost');
    return { rowNo: index + 2, sku, nameEn: name, nameAr: localized, category: categoryLabel(categoryRef), sellingPrice: price, vatRate: 15, priceIncludesVat: true, action: !sku || !active ? 'skip' : existing ? 'update' : 'create', matchId: existing?.id, warnings, barcode: pickValue(row, ['barcode']), foodicsId: pickValue(row, ['id']), isStockProduct: stockProduct, source: 'foodics_products_export' };
  });
}
function buildIngredientPreview(rows: Array<Record<string, string>>, menuItems: any[], items: any[]): RecipeImportPreview[] {
  return rows.map((row, index) => {
    const productSku = pickValue(row, ['product_sku']);
    const ingredientSku = pickValue(row, ['inventory_item_sku']);
    const productName = pickValue(row, ['product_name_localized', 'product_name']) || productSku;
    const ingredientName = pickValue(row, ['inventory_item_name_localized', 'inventory_item_name']) || ingredientSku;
    const qtyValue = numberValue(pickValue(row, ['quantity']), 0);
    const unit = pickValue(row, ['unit']) || 'Unit';
    const productMatch = menuItems.find((m: any) => normalize(m.code) === normalize(productSku));
    const itemMatch = items.find((i: any) => normalize(i.sku) === normalize(ingredientSku));
    const warnings: string[] = [];
    if (!productSku) warnings.push('Missing product SKU');
    if (!ingredientSku) warnings.push('Missing inventory item SKU');
    if (!qtyValue) warnings.push('Missing quantity');
    if (!productMatch) warnings.push('Menu item will be created/updated from products file if present');
    if (!itemMatch) warnings.push('Inventory item will be auto-created with zero cost');
    return { rowNo: index + 2, productSku, productName, ingredientSku, ingredientName, qty: qtyValue, unit, productMatchId: productMatch?.id, itemMatchId: itemMatch?.id, action: productSku && ingredientSku && qtyValue > 0 ? 'create_recipe_line' : 'skip', warnings };
  });
}
function buildModifierPreview(rows: Array<Record<string, string>>): ModifierImportPreview[] {
  return rows.map((row, index) => {
    const productSku = pickValue(row, ['product_sku']);
    const modifierReference = pickValue(row, ['modifier_reference']);
    const modifierName = pickValue(row, ['modifier_name_localized', 'modifier_name']) || modifierReference;
    const warnings: string[] = [];
    if (!productSku) warnings.push('Missing product SKU');
    if (!modifierReference && !modifierName) warnings.push('Missing modifier');
    return { rowNo: index + 2, productSku, productName: pickValue(row, ['product_name_localized', 'product_name']) || productSku, modifierName, modifierReference, min: numberValue(pickValue(row, ['minimum_options']), 0), max: numberValue(pickValue(row, ['maximum_options']), 0), free: numberValue(pickValue(row, ['free_options']), 0), unique: yesNo(pickValue(row, ['unique_options'])), warnings };
  });
}
function buildMenuPreview(rows: Array<Record<string, string>>, existingMenuItems: any[]): MenuImportPreview[] {
  const existingBySku = new Map(existingMenuItems.map((m: any) => [normalize(m.code), m]));
  return rows.map((row, index) => {
    const sku = pickValue(row, ['sku', 'item_sku', 'product_sku', 'product sku', 'item code', 'code', 'reference', 'menu sku', 'كود', 'كود الصنف', 'الرمز']);
    const nameEn = pickValue(row, ['name', 'item_name', 'product_name', 'name_en', 'english name', 'item name', 'الصنف', 'اسم الصنف']) || sku;
    const nameAr = pickValue(row, ['name_localized', 'localized_name', 'name_ar', 'arabic name', 'name localized', 'الاسم العربي', 'اسم الصنف عربي']) || nameEn;
    const category = pickValue(row, ['category', 'category_name', 'menu_category', 'group', 'section', 'تصنيف', 'القسم', 'الفئة']) || 'Foodics Menu';
    const grossPrice = numberValue(pickValue(row, ['price', 'selling_price', 'unit_price', 'tax_inclusive_price', 'gross_price', 'السعر', 'سعر البيع']), 0);
    const netPrice = numberValue(pickValue(row, ['tax_exclusive_unit_price', 'tax_exclusive_price', 'net_price', 'price_without_tax', 'السعر بدون ضريبة']), 0);
    const vatRate = numberValue(pickValue(row, ['vat_rate', 'tax_rate', 'tax_percent', 'ضريبة', 'نسبة الضريبة']), 15) || 15;
    const priceIncludesVat = grossPrice > 0 || !netPrice;
    const sellingPrice = grossPrice || netPrice;
    const existing = sku ? existingBySku.get(normalize(sku)) : undefined;
    const status = normalize(pickValue(row, ['active', 'is_active', 'status', 'الحالة']));
    const active = !['false', 'inactive', 'disabled', '0', 'no', 'لا', 'غير نشط'].includes(status);
    const warnings: string[] = [];
    if (!sku) warnings.push('Missing SKU');
    if (!sellingPrice) warnings.push('Missing price');
    if (!active) warnings.push('Inactive in source');
    return { rowNo: index + 2, sku, nameEn: nameEn || nameAr || sku, nameAr: nameAr || nameEn || sku, category, sellingPrice, vatRate, priceIncludesVat, action: !sku || !active ? 'skip' : existing ? 'update' : 'create', matchId: existing?.id, warnings };
  });
}
function isVoid(status?: string) { const s = normalize(status); return s.includes('void') || s.includes('cancel') || s.includes('ملغي'); }
function isReturn(status?: string) { const s = normalize(status); return s.includes('return') || s.includes('refund') || s.includes('مرتجع') || s.includes('ارجاع'); }
function lineSign(row: Record<string, string>) { return isReturn(row.order_status || row.status) ? -1 : 1; }
function orderSign(row: Record<string, string>) { return isReturn(row.status) ? -1 : 1; }
function isRefundPayment(row: Record<string, string>) { return numberValue(row.amount) < 0 || normalize(row.type || row.status).includes('refund') || normalize(row.payment_method_name).includes('refund'); }
function loadFoodicsSession(): FoodicsPersistedSession | null {
  try {
    const raw = localStorage.getItem(FOODICS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      files: Array.isArray(parsed.files) ? parsed.files : [],
      branchMap: parsed.branchMap && typeof parsed.branchMap === 'object' ? parsed.branchMap : {},
      itemMap: parsed.itemMap && typeof parsed.itemMap === 'object' ? parsed.itemMap : {},
      paymentMap: parsed.paymentMap && typeof parsed.paymentMap === 'object' ? parsed.paymentMap : {},
      batchName: parsed.batchName || `FOODICS-${today()}`,
      postingMode: parsed.postingMode || 'report',
      batches: Array.isArray(parsed.batches) ? parsed.batches : [],
      persistedAt: parsed.persistedAt || new Date().toISOString(),
      degraded: Boolean(parsed.degraded),
    };
  } catch (error) {
    console.warn('Failed to load Foodics session', error);
    return null;
  }
}
function persistFoodicsSession(session: FoodicsPersistedSession): { ok: boolean; degraded: boolean } {
  try {
    localStorage.setItem(FOODICS_STORAGE_KEY, JSON.stringify({ ...session, persistedAt: new Date().toISOString(), degraded: false }));
    return { ok: true, degraded: false };
  } catch (error) {
    console.warn('Full Foodics session persistence failed; saving mappings and file metadata only', error);
    try {
      localStorage.setItem(FOODICS_STORAGE_KEY, JSON.stringify({ ...session, files: session.files.map((f) => ({ ...f, rows: [] })), persistedAt: new Date().toISOString(), degraded: true }));
      return { ok: true, degraded: true };
    } catch (secondError) {
      console.warn('Foodics light session persistence failed', secondError);
      return { ok: false, degraded: true };
    }
  }
}
function reverseJournal(journal: any) {
  return {
    ...journal,
    id: id('JE'),
    date: today(),
    ref: `REV-${journal.ref}`,
    source: `reversal_${journal.source}`,
    description: `Reversal of ${journal.ref}`,
    status: 'posted',
    lines: (journal.lines ?? []).map((line: any) => ({ ...line, id: id('JL'), debit: Number(line.credit || 0), credit: Number(line.debit || 0), memo: `Reversal: ${line.memo || journal.ref}` })),
  };
}

function Card({ title, children, icon, action }: { title: string; children: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return <section className="card"><div className="card-header"><div className="card-title">{icon}{title}</div>{action}</div>{children}</section>;
}
function KPI({ label, value, hint, icon }: { label: string; value: string; hint: string; icon?: ReactNode }) {
  return <div className="kpi"><div className="kpi-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>;
}
function Pill({ tone, children }: { tone: Tone; children: ReactNode }) { return <span className={`pill ${tone}`}>{children}</span>; }
function Table({ headers, rows }: { headers: ReactNode[]; rows: ReactNode[][] }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>) : <tr><td colSpan={headers.length} className="muted">No rows</td></tr>}</tbody></table></div>;
}
function Tab({ value, active, onClick, children }: { value: string; active: string; onClick: (v: any) => void; children: ReactNode }) {
  return <button className={`tab ${active === value ? 'active' : ''}`} onClick={() => onClick(value)}>{children}</button>;
}

export default function FoodicsSalesPage({ state, update, locale }: Props) {
  const persisted = useMemo(() => loadFoodicsSession(), []);
  const [tab, setTab] = useState<'readiness' | 'upload' | 'menuImport' | 'mapping' | 'validation' | 'issues' | 'posting' | 'reconciliation' | 'adjustments' | 'batches' | 'reports'>('readiness');
  const [issueKey, setIssueKey] = useState<IssueKey>('unmapped_items');
  const [postingMode, setPostingMode] = useState<PostingMode>(persisted?.postingMode ?? 'report');
  const [files, setFiles] = useState<UploadedFoodicsFile[]>(persisted?.files ?? []);
  const [branchMap, setBranchMap] = useState<Record<string, string>>(persisted?.branchMap ?? {});
  const [itemMap, setItemMap] = useState<Record<string, string>>(persisted?.itemMap ?? {});
  const [paymentMap, setPaymentMap] = useState<Record<string, string>>(persisted?.paymentMap ?? {});
  const [batchName, setBatchName] = useState(persisted?.batchName ?? `FOODICS-${today()}`);
  const [approvalNote, setApprovalNote] = useState("");
  const [batches, setBatches] = useState<FoodicsBatchRecord[]>(persisted?.batches ?? []);
  const [persistWarning, setPersistWarning] = useState(persisted?.degraded ? 'metadata' : '');
  const [menuFiles, setMenuFiles] = useState<UploadedFoodicsMenuFile[]>([]);
  const [menuPreviewRows, setMenuPreviewRows] = useState<MenuImportPreview[]>([]);
  const [recipePreviewRows, setRecipePreviewRows] = useState<RecipeImportPreview[]>([]);
  const [modifierPreviewRows, setModifierPreviewRows] = useState<ModifierImportPreview[]>([]);

  useEffect(() => {
    const result = persistFoodicsSession({ files, branchMap, itemMap, paymentMap, batchName, postingMode, batches, persistedAt: new Date().toISOString() });
    setPersistWarning(result.ok ? (result.degraded ? 'metadata' : '') : 'failed');
  }, [files, branchMap, itemMap, paymentMap, batchName, postingMode, batches]);

  const orders = files.filter((f) => f.kind === 'orders').flatMap((f) => f.rows);
  const lines = files.filter((f) => f.kind === 'lines').flatMap((f) => f.rows);
  const payments = files.filter((f) => f.kind === 'payments').flatMap((f) => f.rows);
  const branchSummary = files.filter((f) => f.kind === 'branch_summary').flatMap((f) => f.rows);
  const paymentSummary = files.filter((f) => f.kind === 'payment_summary').flatMap((f) => f.rows);
  const cleanLines = lines.filter((r) => !isVoid(r.order_status) && !isVoid(r.status) && normalize(r.sku));
  const saleLines = cleanLines.filter((r) => normalize(r.type || 'product') !== 'modifier');

  const branchKey = (row: Record<string, string>) => row.branch_reference || row['مرجع الفرع'] || row.branch_name || row['الفرع'] || 'UNKNOWN';
  const branchLabel = (key: string) => [...orders, ...lines, ...payments, ...branchSummary].find((r) => branchKey(r) === key)?.branch_name || [...branchSummary, ...orders].find((r) => branchKey(r) === key)?.['الفرع'] || key;
  const itemLabel = (sku: string) => lines.find((r) => r.sku === sku)?.name_localized || lines.find((r) => r.sku === sku)?.name || sku;
  const branchName = (branchId: string) => { const b = state.branches?.find((x: any) => x.id === branchId); return b ? (locale === 'ar' ? b.nameAr : b.nameEn) : '—'; };
  const storeName = (storeId: string) => { const s = state.stores?.find((x: any) => x.id === storeId); return s ? (locale === 'ar' ? s.nameAr : s.nameEn) : '—'; };
  const itemName = (itemId: string) => { const i = state.items?.find((x: any) => x.id === itemId); return i ? (locale === 'ar' ? i.nameAr : i.nameEn) : '—'; };
  const menuName = (menuId: string) => { const m = state.menuItems?.find((x: any) => x.id === menuId); return m ? (locale === 'ar' ? m.nameAr : m.nameEn) : '—'; };
  const avgCost = (itemId: string) => {
    const ins = (state.stockMovements ?? []).filter((m: any) => m.itemId === itemId && m.direction === 'in' && Number(m.unitCost || 0) > 0);
    const qtyIn = ins.reduce((s: number, m: any) => s + Number(m.qty || 0), 0);
    const valIn = ins.reduce((s: number, m: any) => s + Number(m.qty || 0) * Number(m.unitCost || 0), 0);
    return qtyIn ? valIn / qtyIn : Number(state.items?.find((i: any) => i.id === itemId)?.standardCost || 0);
  };
  const balance = (storeId: string, itemId: string) => (state.stockMovements ?? []).filter((m: any) => m.storeId === storeId && m.itemId === itemId).reduce((s: number, m: any) => s + (m.direction === 'in' ? 1 : -1) * Number(m.qty || 0), 0);
  const branchCostCenter = (branchId: string) => state.costCenters?.find((c: any) => c.branchId === branchId)?.id ?? 'company';
  const defaultPaymentAccount = (method: string) => {
    const k = normalize(method);
    if (k.includes('cash') || k.includes('نقد')) return '1010';
    if (k.includes('mada') || k.includes('card') || k.includes('visa') || k.includes('master')) return '1020';
    if (k.includes('جاهز') || k.includes('توصيل') || k.includes('hospital') || k.includes('مستشفى') || k.includes('تقفيل')) return '1200';
    if (k.includes('ضيافة') || k.includes('ضيف') || k.includes('compliment')) return '6900';
    return '1100';
  };

  const handleFiles = async (list: FileList | null) => {
    if (!list) return;
    const allFiles: UploadedFoodicsFile[] = [];
    for (const file of Array.from(list)) {
      const text = await file.text();
      const parsed = parseCsv(text);
      const kind = detectKind(parsed.headers);
      allFiles.push({ id: id('FOODICSFILE'), name: file.name, kind, headers: parsed.headers, rows: parsed.rows });
    }
    setFiles((prev) => [...prev, ...allFiles]);
    const nextBranch: Record<string, string> = {};
    unique(allFiles.flatMap((f) => f.rows.map(branchKey).filter(Boolean))).forEach((k) => {
      const label = branchLabel(k);
      const match = state.branches?.find((b: any) => normalize(b.code) === normalize(k) || normalize(b.nameEn) === normalize(label) || normalize(b.nameAr) === normalize(label));
      if (match) nextBranch[k] = match.id;
    });
    const nextItem: Record<string, string> = {};
    unique(allFiles.filter((f) => f.kind === 'lines').flatMap((f) => f.rows.map((r) => r.sku).filter(Boolean))).forEach((sku) => {
      const label = allFiles.flatMap((f) => f.rows).find((r) => r.sku === sku)?.name_localized || allFiles.flatMap((f) => f.rows).find((r) => r.sku === sku)?.name || sku;
      const match = state.menuItems?.find((m: any) => normalize(m.code) === normalize(sku) || normalize(m.nameEn) === normalize(label) || normalize(m.nameAr) === normalize(label));
      if (match) nextItem[sku] = match.id;
    });
    const nextPay: Record<string, string> = {};
    unique(allFiles.filter((f) => f.kind === 'payments' || f.kind === 'payment_summary').flatMap((f) => f.rows.map((r) => r.payment_method_name || r.payment_method_name_localized || r['طريقة الدفع']).filter(Boolean))).forEach((m) => nextPay[m] = defaultPaymentAccount(m));
    setBranchMap((p) => ({ ...nextBranch, ...p }));
    setItemMap((p) => ({ ...nextItem, ...p }));
    setPaymentMap((p) => ({ ...nextPay, ...p }));
    setBatches((prev) => [{ id: id('FOODICSBATCH'), ref: batchName || `FOODICS-${today()}`, date: today(), mode: 'report', status: 'uploaded', orderCount: allFiles.filter((f) => f.kind === 'orders').reduce((s, f) => s + f.rows.length, 0), lineCount: allFiles.filter((f) => f.kind === 'lines').reduce((s, f) => s + f.rows.length, 0), paymentCount: allFiles.filter((f) => f.kind === 'payments').reduce((s, f) => s + f.rows.length, 0), orderGross: 0, paymentTotal: 0, difference: 0, journalRefs: [], stockMovementCount: 0, salesDocCount: 0, note: `Uploaded ${allFiles.length} Foodics files` }, ...prev]);
  };

  const handleMenuFiles = async (list: FileList | null) => {
    if (!list) return;
    const parsedFiles: UploadedFoodicsMenuFile[] = [];
    for (const file of Array.from(list)) {
      const parsed = parseCsv(await file.text());
      const kind = detectMenuKind(parsed.headers);
      parsedFiles.push({ id: id('FOODICSMENUFILE'), name: file.name, kind, headers: parsed.headers, rows: parsed.rows });
    }
    setMenuFiles(parsedFiles);
    const productRows = parsedFiles.filter((f) => f.kind === 'products').flatMap((f) => f.rows);
    const genericRows = parsedFiles.filter((f) => f.kind === 'generic_menu').flatMap((f) => f.rows);
    const ingredientRows = parsedFiles.filter((f) => f.kind === 'products_ingredients').flatMap((f) => f.rows);
    const modifierRows = parsedFiles.filter((f) => f.kind === 'products_modifiers').flatMap((f) => f.rows);
    setMenuPreviewRows(productRows.length ? buildNativeProductPreview(productRows, state.menuItems ?? []) : buildMenuPreview(genericRows, state.menuItems ?? []));
    setRecipePreviewRows(buildIngredientPreview(ingredientRows, state.menuItems ?? [], state.items ?? []));
    setModifierPreviewRows(buildModifierPreview(modifierRows));
  };

  const autoMapBySku = () => {
    const next: Record<string, string> = { ...itemMap };
    skus.forEach((sku) => {
      const label = itemLabel(sku);
      const exact = (state.menuItems ?? []).find((m: any) => normalize(m.code) === normalize(sku));
      const nameMatch = (state.menuItems ?? []).find((m: any) => normalize(m.nameEn) === normalize(label) || normalize(m.nameAr) === normalize(label));
      if (exact || nameMatch) next[sku] = (exact || nameMatch).id;
    });
    setItemMap(next);
  };

  const importFoodicsMenuBundle = () => {
    const validMenuRows = menuPreviewRows.filter((row) => row.action !== 'skip' && row.sku);
    const validRecipeRows = recipePreviewRows.filter((row) => row.action !== 'skip');
    const validModifierRows = modifierPreviewRows.filter((row) => row.productSku && (row.modifierReference || row.modifierName));
    if (!validMenuRows.length && !validRecipeRows.length && !validModifierRows.length) return;
    const nextMap: Record<string, string> = {};
    update((s: any) => {
      let menuItems = [...(s.menuItems ?? [])];
      let items = [...(s.items ?? [])];
      let recipeLines = [...(s.recipeLines ?? [])];
      validMenuRows.forEach((row) => {
        const existingIndex = menuItems.findIndex((m: any) => normalize(m.code) === normalize(row.sku));
        if (existingIndex >= 0) {
          const existing = menuItems[existingIndex];
          menuItems[existingIndex] = { ...existing, nameEn: row.nameEn || existing.nameEn, nameAr: row.nameAr || existing.nameAr, category: row.category || existing.category, sellingPrice: row.sellingPrice || existing.sellingPrice, vatRate: row.vatRate || existing.vatRate || 15, priceIncludesVat: row.priceIncludesVat, active: true, foodicsProductId: row.foodicsId, barcode: row.barcode, isFoodicsStockProduct: row.isStockProduct };
          nextMap[row.sku] = existing.id;
        } else {
          const newId = id('MENU');
          menuItems.push({ id: newId, code: row.sku, nameEn: row.nameEn, nameAr: row.nameAr, category: row.category || 'Foodics Menu', sellingPrice: row.sellingPrice || 0, vatRate: row.vatRate || 15, priceIncludesVat: row.priceIncludesVat, active: true, foodicsProductId: row.foodicsId, barcode: row.barcode, isFoodicsStockProduct: row.isStockProduct });
          nextMap[row.sku] = newId;
        }
      });
      const menuBySku = (sku: string) => menuItems.find((m: any) => normalize(m.code) === normalize(sku));
      const itemBySku = (sku: string) => items.find((i: any) => normalize(i.sku) === normalize(sku));
      validRecipeRows.forEach((row) => {
        if (!itemBySku(row.ingredientSku)) {
          items.push({ id: id('ITEM'), sku: row.ingredientSku, nameEn: row.ingredientName || row.ingredientSku, nameAr: row.ingredientName || row.ingredientSku, category: 'Foodics Ingredients', purchaseUnit: row.unit || 'Unit', consumptionUnit: row.unit || 'Unit', conversionFactor: 1, standardCost: 0, minStock: 0, maxStock: 0, reorderPoint: 0, isSemiFinished: false, active: true });
        }
      });
      const importedMenuIds = unique(validRecipeRows.map((row) => menuBySku(row.productSku)?.id).filter(Boolean));
      if (importedMenuIds.length) recipeLines = recipeLines.filter((line: any) => !importedMenuIds.includes(line.menuItemId));
      validRecipeRows.forEach((row) => {
        const menu = menuBySku(row.productSku);
        const item = itemBySku(row.ingredientSku);
        if (!menu || !item || !row.qty) return;
        recipeLines.push({ id: id('REC'), menuItemId: menu.id, itemId: item.id, qty: row.qty, unit: row.unit || item.consumptionUnit || 'Unit', wastagePct: 0, note: 'Imported from Foodics products_ingredients export' });
      });
      const foodicsModifierGroups = validModifierRows.map((row) => ({ id: id('MOD'), productSku: row.productSku, productName: row.productName, menuItemId: menuBySku(row.productSku)?.id || '', modifierName: row.modifierName, modifierReference: row.modifierReference, minOptions: row.min, maxOptions: row.max, freeOptions: row.free, uniqueOptions: row.unique, source: 'foodics_products_modifiers_export' }));
      const audit = { id: id('AUD'), at: new Date().toISOString(), action: 'import', entity: 'foodics_menu_bundle', ref: 'MENU-' + today(), user: 'Local User', note: `Foodics native menu import: ${validMenuRows.length} products, ${validRecipeRows.length} ingredient recipe rows, ${validModifierRows.length} modifier links` };
      return { ...s, menuItems, items, recipeLines, foodicsModifierGroups, audits: [audit, ...(s.audits ?? [])] };
    }, L(locale, 'Foodics menu, recipes, and modifiers imported', 'تم استيراد قائمة فودكس والوصفات والمعدلات'));
    setItemMap((prev) => ({ ...nextMap, ...prev }));
  };


  const orderRefs = new Set(orders.map((o) => o.reference).filter(Boolean));
  const paymentRefs = new Set(payments.map((p) => p.order_reference).filter(Boolean));
  const lineRefs = new Set(lines.map((l) => l.order_reference).filter(Boolean));
  const branchKeys = unique<string>([...orders, ...lines, ...payments, ...branchSummary].map(branchKey).filter((v): v is string => Boolean(v)));
  const skus = unique<string>(saleLines.map((l) => l.sku).filter((v): v is string => Boolean(v)));
  const methods = unique<string>([...payments.map((p) => p.payment_method_name || p.payment_method_name_localized), ...paymentSummary.map((p) => p['طريقة الدفع'])].filter((v): v is string => Boolean(v)));
  const unmappedBranches = branchKeys.filter((k) => !branchMap[k]);
  const unmappedItems = skus.filter((sku) => !itemMap[sku]);
  const autoSkuMatchCount = skus.filter((sku) => (state.menuItems ?? []).some((m: any) => normalize(m.code) === normalize(sku))).length;
  const manualMappingCount = skus.filter((sku) => itemMap[sku]).length;
  const unmappedPayments = methods.filter((m) => !paymentMap[m]);
  const duplicateOrders = Math.max(0, orders.length - orderRefs.size);
  const duplicateOrderRefs = [...orders.reduce((map, row) => { const ref = row.reference || 'UNKNOWN'; map.set(ref, (map.get(ref) || 0) + 1); return map; }, new Map<string, number>()).entries()].filter(([, count]) => count > 1);
  const lineWithoutHeader = [...lineRefs].filter((ref) => !orderRefs.has(ref));
  const paymentWithoutHeader = [...paymentRefs].filter((ref) => !orderRefs.has(ref));
  const ordersWithoutPayment = [...orderRefs].filter((ref) => !paymentRefs.has(ref));
  const voidOrders = orders.filter((o) => isVoid(o.status));
  const returnedOrders = orders.filter((o) => !isVoid(o.status) && isReturn(o.status));
  const recognizedOrders = orders.filter((o) => !isVoid(o.status));
  const discountedOrders = recognizedOrders.filter((o) => numberValue(o.discounts) > 0);
  const discountLines = cleanLines.filter((r) => numberValue(r.discount_amount) > 0 || numberValue(r.tax_exclusive_discount_amount) > 0 || normalize(r.discount_name));
  const refundPayments = payments.filter((p) => isRefundPayment(p));
  const grossBeforeVoidsReturns = orders.filter((o) => !isVoid(o.status) && !isReturn(o.status)).reduce((s, o) => s + Math.abs(numberValue(o.total_price)), 0);
  const voidGross = voidOrders.reduce((s, o) => s + Math.abs(numberValue(o.total_price)), 0);
  const returnGross = returnedOrders.reduce((s, o) => s + Math.abs(numberValue(o.total_price)), 0);
  const orderDiscountTotal = recognizedOrders.reduce((s, o) => s + Math.abs(numberValue(o.discounts)), 0);
  const lineDiscountTotal = discountLines.reduce((s, r) => s + Math.abs(numberValue(r.discount_amount) || numberValue(r.tax_exclusive_discount_amount)), 0);
  const discountTotal = lineDiscountTotal || orderDiscountTotal;
  const refundPaymentTotal = refundPayments.reduce((s, p) => s + Math.abs(numberValue(p.amount)), 0);
  const mappedMenus = unique(skus.map((s) => itemMap[s]).filter(Boolean));
  const missingRecipes = mappedMenus.filter((menuId) => !(state.recipeLines ?? []).some((r: any) => r.menuItemId === menuId));
  const orderGross = recognizedOrders.reduce((s, o) => s + orderSign(o) * numberValue(o.total_price), 0);
  const orderNet = recognizedOrders.reduce((s, o) => s + orderSign(o) * numberValue(o.subtotal), 0);
  const orderVat = recognizedOrders.reduce((s, o) => s + orderSign(o) * numberValue(o.total_taxes), 0);
  const paymentTotal = payments.reduce((s, p) => s + numberValue(p.amount), 0) || paymentSummary.reduce((s, p) => s + numberValue(p['المبلغ الصافي']), 0);
  const lineNet = saleLines.reduce((s, r) => s + lineSign(r) * numberValue(r.tax_exclusive_total_price), 0);
  const lineVat = saleLines.reduce((s, r) => s + lineSign(r) * numberValue(r.total_taxes), 0);
  const lineGross = saleLines.reduce((s, r) => s + lineSign(r) * numberValue(r.total_price), 0);
  const reconDiff = orderGross - paymentTotal;
  const activeBatchRef = batchName || `FOODICS-${today()}`;
  const duplicateBatch = batches.some((b) => b.ref === activeBatchRef && ['report_only', 'posted_sales', 'posted_full'].includes(b.status));

  const salesByBranch = useMemo(() => { const map = new Map<string, number>(); saleLines.forEach((r) => { const k = branchKey(r); map.set(k, (map.get(k) || 0) + lineSign(r) * numberValue(r.tax_exclusive_total_price)); }); return [...map.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])); }, [saleLines]);
  const salesByItem = useMemo(() => { const map = new Map<string, number>(); saleLines.forEach((r) => { const k = r.sku || 'UNKNOWN'; map.set(k, (map.get(k) || 0) + lineSign(r) * numberValue(r.tax_exclusive_total_price)); }); return [...map.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])); }, [saleLines]);
  const paymentsByMethod = useMemo(() => { const map = new Map<string, number>(); payments.forEach((r) => { const k = r.payment_method_name || r.payment_method_name_localized || 'UNKNOWN'; map.set(k, (map.get(k) || 0) + numberValue(r.amount)); }); return [...map.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])); }, [payments]);
  const demand = useMemo(() => {
    const map = new Map<string, any>();
    saleLines.forEach((row) => {
      const branchId = branchMap[branchKey(row)];
      const store = state.stores?.find((s: any) => s.branchId === branchId);
      const menuId = itemMap[row.sku];
      const soldQty = lineSign(row) * numberValue(row.quantity);
      if (!branchId || !store || !menuId || soldQty <= 0) return;
      (state.recipeLines ?? []).filter((r: any) => r.menuItemId === menuId).forEach((r: any) => {
        const required = Number(r.qty || 0) * (1 + Number(r.wastagePct || 0) / 100) * soldQty;
        const k = `${store.id}|${r.itemId}`;
        const prev = map.get(k) ?? { storeId: store.id, itemId: r.itemId, qty: 0, cost: avgCost(r.itemId) };
        map.set(k, { ...prev, qty: prev.qty + required });
      });
    });
    return [...map.values()];
  }, [saleLines, branchMap, itemMap, state.recipeLines, state.stores, state.stockMovements]);

  const stockShortages = demand.filter((d) => balance(d.storeId, d.itemId) < d.qty);
  const zeroCostDemand = demand.filter((d) => Number(d.cost || 0) <= 0 && Number(d.qty || 0) > 0);
  const mappedBranchIds = unique(Object.values(branchMap).filter(Boolean));
  const mappedBranchesWithoutStores = mappedBranchIds.filter((branchId) => !(state.stores ?? []).some((s: any) => s.branchId === branchId));
  const hasStockCostFoundation = (state.items ?? []).length > 0 && (state.stockMovements ?? []).some((m: any) => m.direction === 'in' && Number(m.unitCost || 0) > 0);
  const hasFoodicsOperationalFiles = orders.length > 0 && lines.length > 0 && payments.length > 0;
  const hasFoodicsReportFiles = orders.length > 0 || lines.length > 0 || payments.length > 0 || branchSummary.length > 0 || paymentSummary.length > 0;
  const approvedBatch = batches.find((b) => b.ref === activeBatchRef && b.status === 'approved' && b.mode === postingMode);
  const postedBatch = batches.find((b) => b.ref === activeBatchRef && ['posted_sales', 'posted_full'].includes(b.status));
  const canReportOnly = hasFoodicsReportFiles && !duplicateBatch;
  const canSalesAccounting = hasFoodicsOperationalFiles && !duplicateOrders && !unmappedBranches.length && !unmappedPayments.length && !duplicateBatch;
  const recipeControlIsFullOnly = postingMode === 'full';
  const canFullPosting = canSalesAccounting && !unmappedItems.length && !missingRecipes.length && !mappedBranchesWithoutStores.length && demand.length > 0 && !zeroCostDemand.length;
  const basePostingReady = postingMode === 'sales' ? canSalesAccounting : postingMode === 'full' ? canFullPosting : false;
  const validationBlockers = [
    duplicateOrderRefs.length ? String(duplicateOrderRefs.length) + ' duplicate order references' : '',
    unmappedBranches.length ? String(unmappedBranches.length) + ' unmapped branches' : '',
    unmappedPayments.length ? String(unmappedPayments.length) + ' unmapped payment methods' : '',
    postingMode === 'full' && unmappedItems.length ? String(unmappedItems.length) + ' unmapped POS items' : '',
    postingMode === 'full' && missingRecipes.length ? String(missingRecipes.length) + ' missing recipes' : '',
    postingMode === 'full' && mappedBranchesWithoutStores.length ? String(mappedBranchesWithoutStores.length) + ' mapped branches without deduction store' : '',
    postingMode === 'full' && zeroCostDemand.length ? String(zeroCostDemand.length) + ' zero-cost recipe demand rows' : '',
    postingMode === 'full' && stockShortages.length ? String(stockShortages.length) + ' stock shortages' : '',
    postedBatch ? 'batch already posted' : '',
  ].filter(Boolean);
  const canApproveBatch = hasFoodicsOperationalFiles && postingMode !== 'report' && basePostingReady && validationBlockers.length === 0 && !approvedBatch;
  const canPost = (postingMode === 'sales' || postingMode === 'full') ? basePostingReady && !!approvedBatch && !postedBatch : false;

  const readinessRows = [
    { area: 'Branches', ar: 'الفروع', status: (state.branches ?? []).length > 0, detail: `${(state.branches ?? []).length} ERP branches / ${branchKeys.length} Foodics branches`, risk: (state.branches ?? []).length ? 'Ready' : 'Missing' },
    { area: 'Linked stores', ar: 'المخازن المرتبطة', status: mappedBranchesWithoutStores.length === 0, detail: mappedBranchesWithoutStores.length ? `${mappedBranchesWithoutStores.length} mapped branches without stores` : 'Mapped branches have deduction stores', risk: mappedBranchesWithoutStores.length ? 'Block full posting' : 'Ready' },
    { area: 'Menu upload / SKU auto-map', ar: 'رفع القائمة / الربط الآلي حسب SKU', status: autoSkuMatchCount > 0 || (state.menuItems ?? []).length > 0, detail: `${autoSkuMatchCount} exact SKU matches / ${skus.length} Foodics SKUs`, risk: unmappedItems.length ? 'Use Menu Import or Auto Map before posting' : 'Ready' },
    { area: 'Menu mapping', ar: 'ربط أصناف البيع', status: !unmappedItems.length && skus.length > 0, detail: `${(state.menuItems ?? []).length} ERP items / ${skus.length} Foodics SKUs`, risk: unmappedItems.length ? `${unmappedItems.length} unmapped SKUs` : 'Ready' },
    { area: 'Recipes', ar: 'الوصفات', status: postingMode !== 'full' || (missingRecipes.length === 0 && mappedMenus.length > 0), detail: `${(state.recipeLines ?? []).length} recipe lines / ${missingRecipes.length} mapped meals missing recipes`, risk: missingRecipes.length ? (postingMode === 'full' ? 'Blocks full inventory/COGS posting only' : 'Starter flow allowed; prepare recipes later') : 'Ready' },
    { area: 'Stock and average cost', ar: 'الرصيد ومتوسط التكلفة', status: hasStockCostFoundation && !zeroCostDemand.length, detail: hasStockCostFoundation ? 'Purchase cost foundation exists' : 'No positive-cost receipt yet', risk: zeroCostDemand.length ? `${zeroCostDemand.length} zero-cost deduction groups` : hasStockCostFoundation ? 'Ready' : 'Warning' },
    { area: 'Payment accounts', ar: 'حسابات طرق الدفع', status: (state.chartAccounts ?? []).length > 0 && !unmappedPayments.length, detail: `${methods.length} Foodics payment methods`, risk: unmappedPayments.length ? `${unmappedPayments.length} unmapped methods` : 'Ready' },
    { area: 'Foodics operational files', ar: 'ملفات فودكس التشغيلية', status: hasFoodicsOperationalFiles, detail: `${orders.length} orders / ${lines.length} lines / ${payments.length} payments`, risk: hasFoodicsOperationalFiles ? 'Ready' : 'Upload headers + lines + payments' },
    { area: 'Duplicate batch control', ar: 'رقابة تكرار الدفعة', status: !duplicateBatch, detail: activeBatchRef, risk: duplicateBatch ? 'Use new batch ref or reverse old batch' : 'Ready' },
  ];
  const postingModes = [
    { key: 'report' as const, en: 'Report only', ar: 'تقارير فقط', enabled: canReportOnly, noteEn: 'Registers Foodics batch for analysis. No GL or inventory posting.', noteAr: 'يسجل دفعة فودكس للتحليل دون ترحيل مالي أو مخزني.' },
    { key: 'sales' as const, en: 'Sales accounting only', ar: 'ترحيل المبيعات مالياً فقط', enabled: canSalesAccounting, noteEn: 'Posts revenue, VAT, and payment split. Does not deduct recipes.', noteAr: 'يرحل الإيراد والضريبة وتقسيم المدفوعات دون خصم الوصفات.' },
    { key: 'full' as const, en: 'Full ERP posting', ar: 'ترحيل كامل مع المخزون', enabled: canFullPosting, noteEn: 'Posts sales, VAT, recipe deduction, COGS, and inventory movement.', noteAr: 'يرحل المبيعات والضريبة وخصم الوصفات وتكلفة المبيعات وحركة المخزون.' },
  ];
  const validations: Array<[string, number, Tone, string]> = [
    ['Duplicate orders', duplicateOrders, duplicateOrders ? 'bad' : 'good', 'Block duplicate posting'],
    ['Lines without order header', lineWithoutHeader.length, lineWithoutHeader.length ? 'bad' : 'good', 'Upload all header chunks'],
    ['Payments without order header', paymentWithoutHeader.length, paymentWithoutHeader.length ? 'warn' : 'good', 'Review date range'],
    ['Orders without payment', ordersWithoutPayment.length, ordersWithoutPayment.length ? 'warn' : 'good', 'Review void/internal/timing'],
    ['Unmapped branches', unmappedBranches.length, unmappedBranches.length ? 'bad' : 'good', 'Map Foodics branch to ERP branch'],
    ['Unmapped POS items', unmappedItems.length, unmappedItems.length ? 'bad' : 'good', 'Map SKU to ERP menu item'],
    ['Missing recipes', missingRecipes.length, missingRecipes.length ? (recipeControlIsFullOnly ? 'bad' : 'warn') : 'good', recipeControlIsFullOnly ? 'Required only for Full ERP inventory/COGS posting' : 'Allowed in Report-only and Sales Accounting starter flow'],
    ['Mapped branches without store', mappedBranchesWithoutStores.length, mappedBranchesWithoutStores.length ? 'bad' : 'good', 'Link every mapped branch to a deduction store'],
    ['Zero-cost recipe demand', zeroCostDemand.length, zeroCostDemand.length ? 'warn' : 'good', 'Post purchases before COGS posting'],
    ['Stock shortages', stockShortages.length, stockShortages.length ? 'warn' : 'good', 'Resolve before live posting'],
    ['Discounts detected', discountTotal, discountTotal > 0 ? 'warn' : 'good', 'Review discount reasons and approval policy'],
    ['Voided orders', voidOrders.length, voidOrders.length ? 'warn' : 'good', 'Exclude from revenue and review cashier controls'],
    ['Returned / refunded orders', returnedOrders.length, returnedOrders.length ? 'warn' : 'good', 'Post as negative revenue/VAT; do not restore food inventory by default'],
    ['Refund payment lines', refundPayments.length, refundPayments.length ? 'warn' : 'good', 'Post refund payments as credits to cash/card clearing'],
    ['Orders vs payments difference', reconDiff, Math.abs(reconDiff) > 1 ? 'warn' : 'good', 'Investigate returns/internal settlement'],
    ['Existing active batch reference', duplicateBatch ? 1 : 0, duplicateBatch ? 'bad' : 'good', 'Use a new batch name or reverse the old batch first'],
  ];

  const issueKeyForCheck = (check: string): IssueKey => ({
    'Duplicate orders': 'duplicate_orders',
    'Lines without order header': 'lines_without_header',
    'Payments without order header': 'payments_without_header',
    'Orders without payment': 'orders_without_payment',
    'Unmapped branches': 'unmapped_branches',
    'Unmapped POS items': 'unmapped_items',
    'Missing recipes': 'missing_recipes',
    'Mapped branches without store': 'branches_without_store',
    'Zero-cost recipe demand': 'zero_cost_demand',
    'Stock shortages': 'stock_shortages',
    'Discounts detected': 'discounts',
    'Voided orders': 'void_orders',
    'Returned / refunded orders': 'returned_orders',
    'Refund payment lines': 'refund_payments',
    'Orders vs payments difference': 'reconciliation_difference',
    'Existing active batch reference': 'duplicate_batch',
  } as Record<string, IssueKey>)[check] || 'unmapped_items';
  const openIssue = (key: IssueKey) => { setIssueKey(key); setTab('issues'); };
  const issueTitle = (key: IssueKey) => ({
    duplicate_orders: L(locale, 'Duplicate orders', 'الطلبات المكررة'),
    lines_without_header: L(locale, 'Lines without order header', 'بنود بدون رأس طلب'),
    payments_without_header: L(locale, 'Payments without order header', 'مدفوعات بدون رأس طلب'),
    orders_without_payment: L(locale, 'Orders without payment', 'طلبات بدون مدفوعات'),
    unmapped_branches: L(locale, 'Unmapped branches', 'فروع غير مربوطة'),
    unmapped_items: L(locale, 'Unmapped POS items', 'أصناف POS غير مربوطة'),
    missing_recipes: L(locale, 'Missing recipes', 'وصفات ناقصة'),
    branches_without_store: L(locale, 'Mapped branches without store', 'فروع مربوطة بدون مخزن'),
    zero_cost_demand: L(locale, 'Zero-cost recipe demand', 'احتياج وصفات بدون تكلفة'),
    stock_shortages: L(locale, 'Stock shortages', 'نواقص المخزون'),
    void_orders: L(locale, 'Voided orders', 'الطلبات الملغاة'),
    returned_orders: L(locale, 'Returned / refunded orders', 'طلبات مرتجعة / مستردة'),
    discounts: L(locale, 'Discounts detected', 'خصومات مكتشفة'),
    refund_payments: L(locale, 'Refund payment lines', 'مدفوعات مستردة'),
    reconciliation_difference: L(locale, 'Orders vs payments difference', 'فرق الطلبات والمدفوعات'),
    duplicate_batch: L(locale, 'Existing active batch reference', 'مرجع دفعة نشط موجود'),
  })[key];
  const skuNet = (sku: string) => saleLines.filter((line) => line.sku === sku).reduce((sum, row) => sum + lineSign(row) * numberValue(row.tax_exclusive_total_price), 0);
  const skuQty = (sku: string) => saleLines.filter((line) => line.sku === sku).reduce((sum, row) => sum + lineSign(row) * numberValue(row.quantity), 0);
  const issueExportRows = (key: IssueKey): Array<Record<string, string | number>> => {
    if (key === 'unmapped_items') return unmappedItems.map((sku) => ({ sku, foodics_name: itemLabel(sku), qty: skuQty(sku), net_sales: skuNet(sku) }));
    if (key === 'missing_recipes') return missingRecipes.map((menuId) => ({ menu_code: state.menuItems?.find((m: any) => m.id === menuId)?.code || '', menu_name: menuName(menuId), linked_foodics_skus: skus.filter((sku) => itemMap[sku] === menuId).join('|') }));
    if (key === 'unmapped_branches') return unmappedBranches.map((branch) => ({ branch_reference: branch, foodics_branch_name: branchLabel(branch) }));
    if (key === 'branches_without_store') return mappedBranchesWithoutStores.map((branchId) => ({ erp_branch: branchName(branchId), branch_id: branchId }));
    if (key === 'zero_cost_demand') return zeroCostDemand.map((d) => ({ store: storeName(d.storeId), item: itemName(d.itemId), required_qty: d.qty, unit_cost: d.cost }));
    if (key === 'stock_shortages') return stockShortages.map((d) => ({ store: storeName(d.storeId), item: itemName(d.itemId), required_qty: d.qty, available_qty: balance(d.storeId, d.itemId) }));
    if (key === 'orders_without_payment') return ordersWithoutPayment.map((ref) => { const o = orders.find((x) => x.reference === ref) || {}; return { order_reference: ref, branch: branchLabel(branchKey(o)), status: o.status || '', gross: numberValue(o.total_price) }; });
    if (key === 'lines_without_header') return lineWithoutHeader.map((ref) => ({ order_reference: ref, line_count: lines.filter((l) => l.order_reference === ref).length }));
    if (key === 'payments_without_header') return paymentWithoutHeader.map((ref) => ({ order_reference: ref, payment_amount: payments.filter((p) => p.order_reference === ref).reduce((sum, p) => sum + numberValue(p.amount), 0) }));
    if (key === 'duplicate_orders') return duplicateOrderRefs.map(([ref, count]) => ({ order_reference: ref, duplicate_count: count }));
    if (key === 'void_orders') return voidOrders.map((o) => ({ order_reference: o.reference || '', order_number: o.number || '', branch: branchLabel(branchKey(o)), status: o.status || '', gross_excluded: numberValue(o.total_price), closed_by: o.closed_by || '' }));
    if (key === 'returned_orders') return returnedOrders.map((o) => ({ order_reference: o.reference || '', original_order_reference: o.original_order_reference || '', order_number: o.number || '', branch: branchLabel(branchKey(o)), status: o.status || '', gross_reversal: numberValue(o.total_price), vat_reversal: numberValue(o.total_taxes) }));
    if (key === 'discounts') return discountLines.length ? discountLines.map((r) => ({ order_reference: r.order_reference || '', sku: r.sku || '', item: itemLabel(r.sku), discount_name: r.discount_name || '', gross_discount: numberValue(r.discount_amount), net_discount: numberValue(r.tax_exclusive_discount_amount), branch: branchLabel(branchKey(r)) })) : discountedOrders.map((o) => ({ order_reference: o.reference || '', order_number: o.number || '', branch: branchLabel(branchKey(o)), discount: numberValue(o.discounts), status: o.status || '' }));
    if (key === 'refund_payments') return refundPayments.map((p) => ({ order_reference: p.order_reference || '', branch: branchLabel(branchKey(p)), payment_method: p.payment_method_name || p.payment_method_name_localized || '', amount: numberValue(p.amount), paid_at: p.paid_at || '', employee: p.employee_name || '' }));
    if (key === 'duplicate_batch') return batches.filter((b) => b.ref === activeBatchRef && ['report_only', 'posted_sales', 'posted_full'].includes(b.status)).map((b) => ({ batch: b.ref, status: b.status, mode: b.mode, date: b.date }));
    return [{ order_gross: orderGross, payment_total: paymentTotal, difference: reconDiff }];
  };
  const issueDetails = (() => {
    if (issueKey === 'unmapped_items') return {
      headers: [L(locale, 'Foodics SKU', 'SKU فودكس'), L(locale, 'Foodics item', 'صنف فودكس'), L(locale, 'Qty', 'الكمية'), L(locale, 'Net Sales', 'صافي المبيعات'), L(locale, 'Map to ERP menu item', 'ربط بصنف النظام')],
      rows: unmappedItems.map((sku) => [sku, itemLabel(sku), qty(skuQty(sku)), money(skuNet(sku), locale), <select value={itemMap[sku] || ''} onChange={(e) => setItemMap({ ...itemMap, [sku]: e.target.value })}><option value="">—</option>{(state.menuItems ?? []).map((m: any) => <option key={m.id} value={m.id}>{m.code} - {locale === 'ar' ? m.nameAr : m.nameEn}</option>)}</select>])
    };
    if (issueKey === 'missing_recipes') return {
      headers: [L(locale, 'ERP menu item', 'صنف النظام'), 'SKU', L(locale, 'Linked Foodics SKUs', 'SKUs المرتبطة'), L(locale, 'Action', 'إجراء')],
      rows: missingRecipes.map((menuId) => { const menu = state.menuItems?.find((m: any) => m.id === menuId); return [menuName(menuId), menu?.code || '—', skus.filter((sku) => itemMap[sku] === menuId).join(', '), <button onClick={() => setTab('menuImport')}><ArrowRight size={14}/>{L(locale, 'Import ingredients / recipe', 'استيراد المكونات / الوصفة')}</button>]; })
    };
    if (issueKey === 'unmapped_branches') return {
      headers: [L(locale, 'Foodics branch ref', 'مرجع فرع فودكس'), L(locale, 'Foodics branch', 'فرع فودكس'), L(locale, 'Map to ERP branch', 'ربط بفرع النظام')],
      rows: unmappedBranches.map((branch) => [branch, branchLabel(branch), <select value={branchMap[branch] || ''} onChange={(e) => setBranchMap({ ...branchMap, [branch]: e.target.value })}><option value="">—</option>{(state.branches ?? []).map((b: any) => <option key={b.id} value={b.id}>{b.code} - {locale === 'ar' ? b.nameAr : b.nameEn}</option>)}</select>])
    };
    if (issueKey === 'branches_without_store') return {
      headers: [L(locale, 'ERP branch', 'فرع النظام'), L(locale, 'Current linked stores', 'المخازن المرتبطة حالياً'), L(locale, 'Action', 'إجراء')],
      rows: mappedBranchesWithoutStores.map((branchId) => [branchName(branchId), (state.stores ?? []).filter((s: any) => s.branchId === branchId).map((s: any) => locale === 'ar' ? s.nameAr : s.nameEn).join(', ') || '—', L(locale, 'Create/link a store in Setup > Stores', 'أنشئ/اربط مخزن من الإعدادات > المخازن')])
    };
    if (issueKey === 'zero_cost_demand') return {
      headers: [L(locale, 'Store', 'المخزن'), L(locale, 'Ingredient', 'المكون'), L(locale, 'Required', 'المطلوب'), L(locale, 'Unit Cost', 'تكلفة الوحدة'), L(locale, 'Action', 'إجراء')],
      rows: zeroCostDemand.map((d) => [storeName(d.storeId), itemName(d.itemId), qty(d.qty), money(d.cost, locale), L(locale, 'Post purchase invoice with unit cost before full COGS posting', 'رحّل فاتورة مشتريات بتكلفة وحدة قبل ترحيل تكلفة المبيعات')])
    };
    if (issueKey === 'stock_shortages') return {
      headers: [L(locale, 'Store', 'المخزن'), L(locale, 'Ingredient', 'المكون'), L(locale, 'Required', 'المطلوب'), L(locale, 'Available', 'المتاح'), L(locale, 'Shortage', 'العجز')],
      rows: stockShortages.map((d) => [storeName(d.storeId), itemName(d.itemId), qty(d.qty), qty(balance(d.storeId, d.itemId)), qty(Math.max(0, d.qty - balance(d.storeId, d.itemId)))])
    };
    if (issueKey === 'orders_without_payment') return { headers: [L(locale, 'Order ref', 'مرجع الطلب'), L(locale, 'Branch', 'الفرع'), L(locale, 'Status', 'الحالة'), L(locale, 'Gross', 'الإجمالي')], rows: ordersWithoutPayment.map((ref) => { const o = orders.find((x) => x.reference === ref) || {}; return [ref, branchLabel(branchKey(o)), o.status || '—', money(numberValue(o.total_price), locale)]; }) };
    if (issueKey === 'lines_without_header') return { headers: [L(locale, 'Missing order ref', 'مرجع طلب مفقود'), L(locale, 'Line count', 'عدد البنود'), L(locale, 'Action', 'إجراء')], rows: lineWithoutHeader.map((ref) => [ref, lines.filter((l) => l.order_reference === ref).length, L(locale, 'Upload the missing Foodics order header chunk', 'ارفع جزء رؤوس الطلبات الناقص من فودكس')]) };
    if (issueKey === 'payments_without_header') return { headers: [L(locale, 'Missing order ref', 'مرجع طلب مفقود'), L(locale, 'Payment amount', 'مبلغ الدفع'), L(locale, 'Action', 'إجراء')], rows: paymentWithoutHeader.map((ref) => [ref, money(payments.filter((p) => p.order_reference === ref).reduce((sum, p) => sum + numberValue(p.amount), 0), locale), L(locale, 'Review date range or upload missing order header file', 'راجع نطاق التاريخ أو ارفع ملف رؤوس الطلبات الناقص')]) };
    if (issueKey === 'duplicate_orders') return { headers: [L(locale, 'Order ref', 'مرجع الطلب'), L(locale, 'Duplicate count', 'عدد التكرار'), L(locale, 'Action', 'إجراء')], rows: duplicateOrderRefs.map(([ref, count]) => [ref, count, L(locale, 'Remove duplicate header file/chunk before posting', 'احذف ملف/جزء رؤوس الطلبات المكرر قبل الترحيل')]) };
    if (issueKey === 'void_orders') return { headers: [L(locale, 'Order ref', 'مرجع الطلب'), L(locale, 'Branch', 'الفرع'), L(locale, 'Status', 'الحالة'), L(locale, 'Gross excluded', 'الإجمالي المستبعد'), L(locale, 'Closed by', 'أغلق بواسطة')], rows: voidOrders.map((o) => [o.reference || '—', branchLabel(branchKey(o)), o.status || '—', money(numberValue(o.total_price), locale), o.closed_by || '—']) };
    if (issueKey === 'returned_orders') return { headers: [L(locale, 'Order ref', 'مرجع الطلب'), L(locale, 'Original order', 'الطلب الأصلي'), L(locale, 'Branch', 'الفرع'), L(locale, 'Gross reversal', 'عكس الإجمالي'), L(locale, 'VAT reversal', 'عكس الضريبة')], rows: returnedOrders.map((o) => [o.reference || '—', o.original_order_reference || '—', branchLabel(branchKey(o)), money(numberValue(o.total_price), locale), money(numberValue(o.total_taxes), locale)]) };
    if (issueKey === 'discounts') return { headers: [L(locale, 'Order ref', 'مرجع الطلب'), 'SKU', L(locale, 'Item / Order', 'الصنف / الطلب'), L(locale, 'Discount name', 'اسم الخصم'), L(locale, 'Discount', 'الخصم'), L(locale, 'Branch', 'الفرع')], rows: (discountLines.length ? discountLines.map((r) => [r.order_reference || '—', r.sku || '—', itemLabel(r.sku), r.discount_name || '—', money(numberValue(r.discount_amount) || numberValue(r.tax_exclusive_discount_amount), locale), branchLabel(branchKey(r))]) : discountedOrders.map((o) => [o.reference || '—', '—', o.number || 'Order', 'Order discount', money(numberValue(o.discounts), locale), branchLabel(branchKey(o))])) };
    if (issueKey === 'refund_payments') return { headers: [L(locale, 'Order ref', 'مرجع الطلب'), L(locale, 'Branch', 'الفرع'), L(locale, 'Method', 'الطريقة'), L(locale, 'Amount', 'المبلغ'), L(locale, 'Paid at', 'وقت الدفع'), L(locale, 'Employee', 'الموظف')], rows: refundPayments.map((p) => [p.order_reference || '—', branchLabel(branchKey(p)), p.payment_method_name || p.payment_method_name_localized || '—', money(numberValue(p.amount), locale), p.paid_at || '—', p.employee_name || '—']) };
    if (issueKey === 'duplicate_batch') return { headers: [L(locale, 'Batch', 'الدفعة'), L(locale, 'Status', 'الحالة'), L(locale, 'Mode', 'النمط'), L(locale, 'Action', 'إجراء')], rows: batches.filter((b) => b.ref === activeBatchRef && ['report_only', 'posted_sales', 'posted_full'].includes(b.status)).map((b) => [b.ref, b.status, b.mode, <button disabled={b.status === 'report_only'} onClick={() => reversePostedBatch(b)}><RefreshCw size={14}/>{L(locale, 'Reverse batch', 'عكس الدفعة')}</button>]) };
    return { headers: [L(locale, 'Metric', 'المؤشر'), L(locale, 'Amount', 'المبلغ'), L(locale, 'Action', 'إجراء')], rows: [[L(locale, 'Orders gross', 'إجمالي الطلبات'), money(orderGross, locale), L(locale, 'Review order headers', 'راجع رؤوس الطلبات')], [L(locale, 'Payments total', 'إجمالي المدفوعات'), money(paymentTotal, locale), L(locale, 'Review payment methods and settlements', 'راجع طرق الدفع والتسويات')], [L(locale, 'Difference', 'الفرق'), money(reconDiff, locale), <button onClick={() => setTab('reconciliation')}><ArrowRight size={14}/>{L(locale, 'Open reconciliation', 'فتح المطابقة')}</button>]] };
  })();

  const makeBatchRecord = (mode: PostingMode, status: FoodicsBatchStatus, extras?: Partial<FoodicsBatchRecord>): FoodicsBatchRecord => ({
    id: id('FOODICSBATCH'), ref: activeBatchRef, date: today(), mode, status,
    orderCount: orders.length, lineCount: lines.length, paymentCount: payments.length,
    orderGross, paymentTotal, difference: reconDiff, journalRefs: [], stockMovementCount: 0, salesDocCount: 0,
    note: '', ...extras,
  });
  const approveCurrentBatch = () => {
    if (!canApproveBatch) return;
    const summary = [
      `orders=${orders.length}`,
      `lines=${lines.length}`,
      `payments=${payments.length}`,
      `gross=${orderGross.toFixed(2)}`,
      `payments_total=${paymentTotal.toFixed(2)}`,
      `difference=${reconDiff.toFixed(2)}`,
      `discounts=${discountTotal.toFixed(2)}`,
      `voids=${voidOrders.length}`,
      `returns=${returnedOrders.length}`,
      `refund_payments=${refundPayments.length}`,
      `mode=${postingMode}`,
    ].join('; ');
    const record = makeBatchRecord(postingMode, 'approved', {
      approvedAt: new Date().toISOString(),
      approvedBy: 'Local User',
      validationSummary: summary,
      note: approvalNote || `Approved for ${postingMode === 'sales' ? 'sales accounting' : 'full ERP'} posting after validation review.`,
    });
    setBatches((prev) => [record, ...prev.filter((b) => !(b.ref === activeBatchRef && b.status === 'approved' && b.mode === postingMode))]);
    setApprovalNote('');
  };

  const registerReportBatch = () => {
    if (!canReportOnly) return;
    setBatches((prev) => [makeBatchRecord('report', 'report_only', { note: 'Report-only Foodics batch registered. No GL or inventory posting.' }), ...prev]);
  };

  const postFoodicsBatch = () => {
    if (!canPost) return;
    let record = makeBatchRecord(postingMode, postingMode === 'sales' ? 'posted_sales' : 'posted_full');
    update((s: any) => {
      const batchRef = activeBatchRef;
      const saleDocs: any[] = [];
      const movementMap = new Map<string, any>();
      const branchAmounts = new Map<string, { net: number; vat: number; gross: number }>();
      const branchPayments = new Map<string, Map<string, number>>();
      if (postingMode === 'sales') {
        recognizedOrders.forEach((row) => {
          const branchId = branchMap[branchKey(row)]; if (!branchId) return;
          const sign = orderSign(row);
          const a = branchAmounts.get(branchId) ?? { net: 0, vat: 0, gross: 0 };
          branchAmounts.set(branchId, { net: a.net + sign * numberValue(row.subtotal), vat: a.vat + sign * numberValue(row.total_taxes), gross: a.gross + sign * numberValue(row.total_price) });
        });
      } else {
        saleLines.forEach((row) => {
          const branchId = branchMap[branchKey(row)];
          const store = s.stores?.find((st: any) => st.branchId === branchId);
          const menuId = itemMap[row.sku];
          const soldQty = lineSign(row) * numberValue(row.quantity);
          if (!branchId || !store || !menuId || soldQty <= 0) return;
          const docRef = `${batchRef}-${branchId}-${menuId}-${row.business_date || today()}`;
          const existing = saleDocs.find((d) => d.ref === docRef);
          if (existing) existing.qty += soldQty;
          else saleDocs.push({ id: id('SALE'), date: row.business_date || today(), ref: docRef, branchId, storeId: store.id, menuItemId: menuId, qty: soldQty, paymentMethod: 'Foodics import', posted: true });
          const a = branchAmounts.get(branchId) ?? { net: 0, vat: 0, gross: 0 };
          branchAmounts.set(branchId, { net: a.net + lineSign(row) * numberValue(row.tax_exclusive_total_price), vat: a.vat + lineSign(row) * numberValue(row.total_taxes), gross: a.gross + lineSign(row) * numberValue(row.total_price) });
          (s.recipeLines ?? []).filter((r: any) => r.menuItemId === menuId).forEach((r: any) => {
            const k = `${store.id}|${r.itemId}`;
            const required = Number(r.qty || 0) * (1 + Number(r.wastagePct || 0) / 100) * soldQty;
            const prev = movementMap.get(k);
            if (prev) prev.qty += required;
            else movementMap.set(k, { id: id('MOV'), date: row.business_date || today(), type: 'foodics_sales_consumption', storeId: store.id, itemId: r.itemId, direction: 'out', qty: required, unitCost: avgCost(r.itemId), ref: batchRef, note: `Foodics recipe consumption ${row.sku}` });
          });
        });
      }
      payments.forEach((pay) => {
        const branchId = branchMap[branchKey(pay)]; if (!branchId) return;
        const method = pay.payment_method_name || pay.payment_method_name_localized || 'Unknown';
        const map = branchPayments.get(branchId) ?? new Map<string, number>();
        map.set(method, (map.get(method) || 0) + numberValue(pay.amount));
        branchPayments.set(branchId, map);
      });
      const movements = [...movementMap.values()];
      const journals: any[] = [];
      branchAmounts.forEach((amounts, branchId) => {
        const payMap = branchPayments.get(branchId) ?? new Map<string, number>();
        const journalLines: any[] = [];
        let debitPayments = 0;
        if (payMap.size) payMap.forEach((amount, method) => {
          const accountCode = paymentMap[method] || defaultPaymentAccount(method);
          debitPayments += amount;
          journalLines.push({ id: id('JL'), accountCode, debit: amount >= 0 ? amount : 0, credit: amount < 0 ? Math.abs(amount) : 0, branchId, costCenterId: 'company', memo: amount < 0 ? `Foodics refund/payment reversal: ${method}` : `Foodics payment: ${method}` });
        });
        else {
          debitPayments = amounts.gross;
          journalLines.push({ id: id('JL'), accountCode: '1100', debit: amounts.gross, credit: 0, branchId, costCenterId: 'company', memo: 'Foodics POS clearing - no payment file' });
        }
        const diff = amounts.gross - debitPayments;
        if (Math.abs(diff) > 0.01) journalLines.push({ id: id('JL'), accountCode: '1100', debit: diff > 0 ? diff : 0, credit: diff < 0 ? Math.abs(diff) : 0, branchId, costCenterId: 'company', memo: 'Foodics order/payment reconciliation difference' });
        const branchMoves = movements.filter((m) => s.stores?.find((st: any) => st.id === m.storeId)?.branchId === branchId);
        const cogs = branchMoves.reduce((sum, m) => sum + Number(m.qty || 0) * Number(m.unitCost || 0), 0);
        journalLines.push(
          { id: id('JL'), accountCode: '4000', debit: 0, credit: amounts.net, branchId, costCenterId: branchCostCenter(branchId), memo: 'Foodics net sales' },
          { id: id('JL'), accountCode: '2150', debit: 0, credit: amounts.vat, branchId, costCenterId: 'company', memo: 'Foodics VAT output' },
        );
        if (postingMode === 'full' && cogs > 0) journalLines.push(
          { id: id('JL'), accountCode: '5100', debit: cogs, credit: 0, branchId, costCenterId: branchCostCenter(branchId), memo: 'Foodics theoretical food cost' },
          { id: id('JL'), accountCode: '1300', debit: 0, credit: cogs, branchId, costCenterId: 'company', memo: 'Foodics recipe inventory consumption' },
        );
        journals.push({ id: id('JE'), date: today(), ref: `${batchRef}-${branchId}`, source: `foodics_sales_import_${postingMode}`, description: `Foodics sales posting for ${branchName(branchId)}`, status: 'posted', lines: journalLines });
      });
      const audit = { id: id('AUD'), at: new Date().toISOString(), action: 'post', entity: 'foodics_sales_batch', ref: batchRef, user: 'Local User', note: `Foodics ${postingMode} batch posted: ${saleDocs.length} sales docs, ${movements.length} stock movements, ${journals.length} journals; discounts ${discountTotal.toFixed(2)}, voids ${voidOrders.length}, returns ${returnedOrders.length}, refund payments ${refundPayments.length}` };
      record = makeBatchRecord(postingMode, postingMode === 'sales' ? 'posted_sales' : 'posted_full', { journalRefs: journals.map((j) => j.ref), stockMovementCount: movements.length, salesDocCount: saleDocs.length, approvedAt: approvedBatch?.approvedAt, approvedBy: approvedBatch?.approvedBy, validationSummary: approvedBatch?.validationSummary, note: audit.note });
      return { ...s, sales: [...(s.sales ?? []), ...saleDocs], stockMovements: [...(s.stockMovements ?? []), ...movements], journals: [...(s.journals ?? []), ...journals], audits: [...(s.audits ?? []), audit] };
    }, L(locale, 'Foodics batch posted', 'تم ترحيل دفعة فودكس'));
    setBatches((prev) => [record, ...prev]);
  };

  const reversePostedBatch = (batch: FoodicsBatchRecord) => {
    if (batch.status === 'reversed' || batch.status === 'report_only' || batch.mode === 'report') return;
    const reason = window.prompt(L(locale, 'Enter reversal reason. This will be saved in the audit trail:', 'أدخل سبب العكس. سيتم حفظه في سجل التدقيق:')) || '';
    if (!reason.trim()) return;
    update((s: any) => {
      const relatedJournals = (s.journals ?? []).filter((j: any) => batch.journalRefs.includes(j.ref) || String(j.ref || '').startsWith(`${batch.ref}-`));
      const reversalJournals = relatedJournals.filter((j: any) => !String(j.ref || '').startsWith('REV-')).map(reverseJournal);
      const relatedMovements = (s.stockMovements ?? []).filter((m: any) => m.ref === batch.ref && m.type === 'foodics_sales_consumption');
      const reversalMovements = relatedMovements.map((m: any) => ({ ...m, id: id('MOV'), date: today(), direction: m.direction === 'out' ? 'in' : 'out', ref: `REV-${batch.ref}`, note: `Reversal of ${batch.ref}: ${m.note || ''}` }));
      const audit = { id: id('AUD'), at: new Date().toISOString(), action: 'reverse', entity: 'foodics_sales_batch', ref: batch.ref, user: 'Local User', note: `Foodics batch reversed: ${reversalJournals.length} journals and ${reversalMovements.length} stock movements. Reason: ${reason}` };
      return { ...s, journals: [...(s.journals ?? []), ...reversalJournals], stockMovements: [...(s.stockMovements ?? []), ...reversalMovements], audits: [...(s.audits ?? []), audit] };
    }, L(locale, 'Foodics batch reversed', 'تم عكس دفعة فودكس'));
    setBatches((prev) => prev.map((b) => b.id === batch.id ? { ...b, status: 'reversed', reversedAt: new Date().toISOString(), reversalReason: reason, note: `${b.note} | Reversed ${today()}: ${reason}` } : b));
  };

  const resetFoodicsSession = () => {
    if (!confirm(L(locale, 'Reset Foodics upload session and mappings?', 'مسح جلسة فودكس والربط؟'))) return;
    localStorage.removeItem(FOODICS_STORAGE_KEY);
    setFiles([]); setBranchMap({}); setItemMap({}); setPaymentMap({}); setPostingMode('report'); setBatchName(`FOODICS-${today()}`); setBatches([]);
  };
  const exportSession = () => saveFile('foodics-v36-session.json', JSON.stringify({ files, menuFiles, branchMap, itemMap, paymentMap, batchName, postingMode, batches }, null, 2), 'application/json;charset=utf-8');

  return <div className="page-grid">
    <Card title={L(locale, 'Foodics sales command center', 'مركز قيادة مبيعات فودكس')} icon={<FileSpreadsheet/>} action={<div className="button-row"><button onClick={exportSession}><Download size={16}/>{L(locale, 'Export session', 'تصدير الجلسة')}</button><button className="danger" onClick={resetFoodicsSession}><Trash2 size={16}/>{L(locale, 'Reset Foodics', 'مسح فودكس')}</button></div>}>
      <div className="notice">{L(locale, 'v36 adds Foodics discounts, voids, returns, refund payments, safer posting treatment, native menu import, persisted mappings, approval, reversal, and batch register locally. Large monthly files may exceed browser local storage; if that happens, mappings and file metadata are still kept.', 'الإصدار ٣٦ يضيف رقابة خصومات وإلغاءات ومرتجعات واستردادات فودكس مع معالجة ترحيل أكثر أماناً، واستيراد القائمة الأصلي، وحفظ الربط، والاعتماد، والعكس، وسجل الدفعات محلياً. الملفات الشهرية الكبيرة قد تتجاوز مساحة المتصفح؛ عندها يتم حفظ الربط وبيانات الملفات المختصرة فقط.')}</div>
      {persistWarning === 'metadata' && <div className="warning-box">{L(locale, 'Browser storage was too small for the full Foodics rows, so the app saved mappings and file metadata only. Re-upload files before posting if rows are missing.', 'مساحة المتصفح لم تكفِ لكل صفوف فودكس، لذلك تم حفظ الربط وبيانات الملفات فقط. أعد رفع الملفات قبل الترحيل إذا اختفت الصفوف.')}</div>}
      {persistWarning === 'failed' && <div className="warning-box">{L(locale, 'Foodics local persistence failed. Export the session manually before leaving this page.', 'فشل الحفظ المحلي لجلسة فودكس. صدّر الجلسة يدوياً قبل مغادرة الصفحة.')}</div>}
      <div className="tab-row"><Tab active={tab} value="readiness" onClick={setTab}>{L(locale, 'Readiness', 'الجاهزية')}</Tab><Tab active={tab} value="upload" onClick={setTab}>{L(locale, 'Upload', 'رفع الملفات')}</Tab><Tab active={tab} value="menuImport" onClick={setTab}>{L(locale, 'Menu Import', 'استيراد القائمة')}</Tab><Tab active={tab} value="mapping" onClick={setTab}>{L(locale, 'Mappings', 'الربط')}</Tab><Tab active={tab} value="validation" onClick={setTab}>{L(locale, 'Validation', 'التحقق')}</Tab><Tab active={tab} value="issues" onClick={setTab}>{L(locale, 'Issue Center', 'مركز المعالجة')}</Tab><Tab active={tab} value="posting" onClick={setTab}>{L(locale, 'Posting', 'الترحيل')}</Tab><Tab active={tab} value="reconciliation" onClick={setTab}>{L(locale, 'Reconciliation', 'المطابقة')}</Tab><Tab active={tab} value="adjustments" onClick={setTab}>{L(locale, 'Discounts / Voids / Returns', 'الخصومات / الإلغاءات / المرتجعات')}</Tab><Tab active={tab} value="batches" onClick={setTab}>{L(locale, 'Batch Register', 'سجل الدفعات')}</Tab><Tab active={tab} value="reports" onClick={setTab}>{L(locale, 'Reports', 'التقارير')}</Tab></div>
    </Card>

    {tab === 'readiness' && <div className="page-grid two"><Card title={L(locale, 'Master data readiness gate', 'بوابة جاهزية البيانات الأساسية')} icon={<ShieldCheck/>}>
      <div className="kpi-grid"><KPI label={L(locale, 'Orders', 'الطلبات')} value={`${orders.length}`} hint={L(locale, 'Foodics headers', 'رؤوس فودكس')} icon={<CreditCard/>}/><KPI label={L(locale, 'Lines', 'البنود')} value={`${lines.length}`} hint={L(locale, 'Item detail', 'تفاصيل الأصناف')} icon={<ChefHat/>}/><KPI label={L(locale, 'Payments', 'المدفوعات')} value={`${payments.length}`} hint={L(locale, 'Payment split', 'تقسيم المدفوعات')} icon={<Wallet/>}/><KPI label={L(locale, 'Difference', 'فرق المطابقة')} value={money(reconDiff, locale)} hint={L(locale, 'Orders - payments', 'الطلبات - المدفوعات')} icon={<AlertTriangle/>}/></div>
      <Table headers={[L(locale, 'Area', 'المجال'), L(locale, 'Status', 'الحالة'), L(locale, 'Detail', 'التفاصيل'), L(locale, 'Risk', 'المخاطر')]} rows={readinessRows.map((r) => [L(locale, r.area, r.ar), <Pill tone={r.status ? 'good' : 'bad'}>{r.status ? L(locale, 'Ready', 'جاهز') : L(locale, 'Missing', 'ناقص')}</Pill>, r.detail, r.risk])}/>
    </Card><Card title={L(locale, 'Posting modes', 'أنماط الترحيل')} icon={<PackageCheck/>}>
      <div className="form-grid"><label><span>{L(locale, 'Batch name', 'اسم الدفعة')}</span><input value={batchName} onChange={(e) => setBatchName(e.target.value)}/></label><label><span>{L(locale, 'Active mode', 'النمط النشط')}</span><select value={postingMode} onChange={(e) => setPostingMode(e.target.value as PostingMode)}>{postingModes.map((m) => <option key={m.key} value={m.key}>{L(locale, m.en, m.ar)} {m.enabled ? '✓' : '—'}</option>)}</select></label></div>
      <Table headers={[L(locale, 'Mode', 'النمط'), L(locale, 'Allowed?', 'مسموح؟'), L(locale, 'What it does', 'ماذا يفعل')]} rows={postingModes.map((m) => [L(locale, m.en, m.ar), m.enabled ? <Pill tone="good">{L(locale, 'Allowed', 'مسموح')}</Pill> : <Pill tone="bad">{L(locale, 'Blocked', 'محظور')}</Pill>, L(locale, m.noteEn, m.noteAr)])}/>
    </Card></div>}

    {tab === 'upload' && <Card title={L(locale, 'Upload Foodics CSV files', 'رفع ملفات فودكس CSV')} icon={<Upload/>}>
      <div className="notice">{L(locale, 'Upload order headers, order item lines, payments, branch summary, and payment summary. Multiple chunked Foodics files are supported.', 'ارفع رؤوس الطلبات وبنود الطلبات والمدفوعات وملخص الفروع وملخص المدفوعات. يدعم النظام ملفات فودكس المجزأة.')}</div>
      <input type="file" multiple accept=".csv,text/csv" onChange={(e) => handleFiles(e.target.files)}/>
      <Table headers={[L(locale, 'File', 'الملف'), L(locale, 'Detected Type', 'النوع المكتشف'), L(locale, 'Rows', 'الصفوف'), L(locale, 'Use', 'الاستخدام'), L(locale, 'Columns', 'الأعمدة')]} rows={files.map((f) => [f.name, <Pill tone={f.kind === 'unknown' ? 'bad' : 'info'}>{f.kind}</Pill>, f.rows.length, f.kind === 'branch_summary' || f.kind === 'payment_summary' ? L(locale, 'Reconciliation only', 'مطابقة فقط') : f.kind === 'payments' ? L(locale, 'Payment split', 'تقسيم المدفوعات') : f.kind === 'lines' ? L(locale, 'Recipe / item detail', 'تفاصيل الأصناف والوصفات') : f.kind === 'orders' ? L(locale, 'Sales control total', 'إجمالي رقابي للمبيعات') : L(locale, 'Unknown', 'غير معروف'), f.headers.slice(0, 8).join(', ')])}/>
    </Card>}

    {tab === 'menuImport' && <div className="page-grid two"><Card title={L(locale, 'Native Foodics menu bundle import', 'استيراد قائمة فودكس الأصلية')} icon={<ChefHat/>} action={<button onClick={() => saveFile('foodics-native-menu-files-v33.txt', 'Upload these native Foodics CSV files together:\n1) products_export*.csv\n2) products_ingredients_export*.csv\n3) products_modifiers_export*.csv\n')}><Download size={16}/>{L(locale, 'Expected files', 'الملفات المطلوبة')}</button>}>
      <div className="notice">{L(locale, 'Upload the native Foodics files exactly as exported: products, products ingredients, and products modifiers. The ERP detects the real Foodics columns, creates/updates menu items by SKU, creates zero-cost inventory ingredients, builds recipe lines, stores modifier groups, then auto-maps future sales by SKU.', 'ارفع ملفات فودكس الأصلية كما هي: المنتجات، مكونات المنتجات، ومعدلات/إضافات المنتجات. النظام يتعرف على أعمدة فودكس الحقيقية، ينشئ/يحدث أصناف البيع حسب SKU، ينشئ مكونات مخزون بتكلفة صفرية، يبني بنود الوصفة، يحفظ مجموعات الإضافات، ثم يربط المبيعات القادمة آلياً حسب SKU.')}</div>
      <input type="file" multiple accept=".csv,text/csv" onChange={(e) => handleMenuFiles(e.target.files)}/>
      <Table headers={[L(locale, 'File', 'الملف'), L(locale, 'Detected Foodics Layout', 'نوع ملف فودكس'), L(locale, 'Rows', 'الصفوف'), L(locale, 'Columns', 'الأعمدة')]} rows={menuFiles.map((f) => [f.name, <Pill tone={f.kind === 'unknown' ? 'bad' : 'info'}>{f.kind}</Pill>, f.rows.length, f.headers.slice(0, 9).join(', ')])}/>
      <div className="kpi-grid"><KPI label={L(locale, 'Products', 'المنتجات')} value={String(menuPreviewRows.length)} hint={L(locale, 'Foodics products export', 'ملف المنتجات')} icon={<FileSpreadsheet/>}/><KPI label={L(locale, 'Create', 'إنشاء')} value={String(menuPreviewRows.filter((r) => r.action === 'create').length)} hint={L(locale, 'New ERP menu items', 'أصناف جديدة')} icon={<ChefHat/>}/><KPI label={L(locale, 'Ingredients', 'المكونات')} value={String(recipePreviewRows.length)} hint={L(locale, 'Recipe lines from Foodics', 'بنود وصفات من فودكس')} icon={<PackageCheck/>}/><KPI label={L(locale, 'Modifiers', 'الإضافات')} value={String(modifierPreviewRows.length)} hint={L(locale, 'Modifier group links', 'ربط مجموعات الإضافات')} icon={<Link2/>}/></div>
      <div className="button-row"><button disabled={!menuPreviewRows.some((r) => r.action !== 'skip') && !recipePreviewRows.some((r) => r.action !== 'skip') && !modifierPreviewRows.length} onClick={importFoodicsMenuBundle}><Save size={16}/>{L(locale, 'Import Native Foodics Bundle', 'استيراد حزمة فودكس الأصلية')}</button><button onClick={autoMapBySku}><Link2 size={16}/>{L(locale, 'Auto Map Current Sales by SKU', 'ربط المبيعات الحالية آلياً حسب SKU')}</button><button onClick={() => saveFile('foodics-native-menu-preview.csv', rowsToCsv(menuPreviewRows.map((r) => ({ row: r.rowNo, sku: r.sku, nameEn: r.nameEn, nameAr: r.nameAr, category: r.category, price: r.sellingPrice, vatRate: r.vatRate, priceIncludesVat: r.priceIncludesVat, barcode: r.barcode || '', foodicsId: r.foodicsId || '', action: r.action, warnings: r.warnings.join('|') }))))}><Download size={16}/>{L(locale, 'Export Products Preview', 'تصدير معاينة المنتجات')}</button></div>
      <Table headers={[L(locale, 'Row', 'الصف'), 'SKU', L(locale, 'Name', 'الاسم'), L(locale, 'Category', 'التصنيف'), L(locale, 'Price', 'السعر'), L(locale, 'Action', 'الإجراء'), L(locale, 'Warnings', 'الملاحظات')]} rows={menuPreviewRows.slice(0, 200).map((r) => [r.rowNo, r.sku || <Pill tone="bad">Missing</Pill>, locale === 'ar' ? r.nameAr : r.nameEn, r.category, money(r.sellingPrice, locale), <Pill tone={r.action === 'skip' ? 'warn' : r.action === 'update' ? 'info' : 'good'}>{r.action}</Pill>, r.warnings.join(', ') || '—'])}/>
    </Card><Card title={L(locale, 'Foodics recipes and modifier readiness', 'جاهزية وصفات وإضافات فودكس')} icon={<ShieldCheck/>}>
      <Table headers={[L(locale, 'Native Foodics File', 'ملف فودكس الأصلي'), L(locale, 'ERP Result', 'نتيجة النظام')]} rows={[[L(locale, 'products_export', 'تصدير المنتجات'), L(locale, 'Creates/updates menu items. SKU is the primary key. Price is imported as VAT-inclusive by default.', 'ينشئ/يحدث أصناف البيع. SKU هو المفتاح الأساسي. السعر يستورد كشامل ضريبة افتراضياً.')], [L(locale, 'products_ingredients_export', 'تصدير مكونات المنتجات'), L(locale, 'Creates inventory items at zero cost if missing, then creates multi-line recipes from product SKU to ingredient SKU.', 'ينشئ أصناف مخزون بتكلفة صفرية عند عدم وجودها، ثم يبني وصفات متعددة البنود من SKU المنتج إلى SKU المكون.')], [L(locale, 'products_modifiers_export', 'تصدير إضافات/معدلات المنتجات'), L(locale, 'Stores modifier group links for future POS/add-on logic. It does not force inventory deduction yet because modifier options need their own export.', 'يحفظ ربط مجموعات الإضافات لاستخدامها لاحقاً في الكاشير/الإضافات. لا يخصم مخزون حالياً لأن خيارات الإضافات تحتاج ملفها الخاص.')], [L(locale, 'Sales mapping', 'ربط المبيعات'), L(locale, 'After import, current and future Foodics sales lines auto-map by exact SKU. Manual mapping remains only for exceptions.', 'بعد الاستيراد يتم ربط بنود مبيعات فودكس الحالية والقادمة آلياً حسب SKU، والربط اليدوي يبقى للاستثناءات فقط.')]]}/>
      <div className="kpi-grid"><KPI label={L(locale, 'Recipe preview', 'معاينة الوصفات')} value={String(recipePreviewRows.length)} hint={L(locale, 'Ingredient rows', 'صفوف المكونات')} icon={<PackageCheck/>}/><KPI label={L(locale, 'Missing ingredient items', 'مكونات غير موجودة')} value={String(recipePreviewRows.filter((r) => !r.itemMatchId).length)} hint={L(locale, 'Will be auto-created at zero cost', 'ستنُشأ بتكلفة صفرية')} icon={<AlertTriangle/>}/><KPI label={L(locale, 'Modifier links', 'روابط الإضافات')} value={String(modifierPreviewRows.length)} hint={L(locale, 'For future POS modifiers', 'لمعدلات الكاشير لاحقاً')} icon={<Link2/>}/><KPI label={L(locale, 'Unmapped sales SKUs', 'SKU مبيعات غير مربوط')} value={String(unmappedItems.length)} hint={L(locale, 'After sales upload', 'بعد رفع المبيعات')} icon={<AlertTriangle/>}/></div>
      <Table headers={[L(locale, 'Product SKU', 'SKU المنتج'), L(locale, 'Ingredient SKU', 'SKU المكون'), L(locale, 'Qty', 'الكمية'), L(locale, 'Unit', 'الوحدة'), L(locale, 'Action', 'الإجراء'), L(locale, 'Warnings', 'ملاحظات')]} rows={recipePreviewRows.slice(0, 80).map((r) => [r.productSku, r.ingredientSku, qty(r.qty), r.unit, <Pill tone={r.action === 'skip' ? 'warn' : 'good'}>{r.action}</Pill>, r.warnings.join(', ') || '—'])}/>
      <Table headers={[L(locale, 'Product SKU', 'SKU المنتج'), L(locale, 'Modifier', 'الإضافة'), L(locale, 'Min/Max', 'حد أدنى/أعلى'), L(locale, 'Free', 'مجاني'), L(locale, 'Warnings', 'ملاحظات')]} rows={modifierPreviewRows.slice(0, 80).map((r) => [r.productSku, r.modifierName, `${r.min}/${r.max}`, r.free, r.warnings.join(', ') || '—'])}/>
    </Card></div>}
    {tab === 'mapping' && <div className="page-grid two"><Card title={L(locale, 'Branch mapping', 'ربط الفروع')} icon={<Store/>}><Table headers={[L(locale, 'Foodics Branch', 'فرع فودكس'), L(locale, 'ERP Branch', 'فرع النظام'), L(locale, 'Deduction Store', 'مخزن الخصم')]} rows={branchKeys.map((k) => { const branchId = branchMap[k]; const store = (state.stores ?? []).find((s: any) => s.branchId === branchId); return [`${k} — ${branchLabel(k)}`, <select value={branchId || ''} onChange={(e) => setBranchMap({ ...branchMap, [k]: e.target.value })}><option value="">—</option>{(state.branches ?? []).map((b: any) => <option key={b.id} value={b.id}>{b.code} - {locale === 'ar' ? b.nameAr : b.nameEn}</option>)}</select>, store ? storeName(store.id) : <Pill tone="warn">{L(locale, 'No linked store', 'لا يوجد مخزن مرتبط')}</Pill>]; })}/></Card>
      <Card title={L(locale, 'POS item mapping', 'ربط أصناف الكاشير')} icon={<ChefHat/>} action={<button onClick={autoMapBySku}><Link2 size={16}/>{L(locale, 'Auto map by SKU', 'ربط آلي حسب SKU')}</button>}><div className="notice">{L(locale, 'You do not need to map every upload. Exact SKU matches auto-map; manual choices are saved and reused for future Foodics batches.', 'لا تحتاج إلى الربط في كل رفع. المطابقة الدقيقة حسب SKU تتم آلياً، والاختيارات اليدوية محفوظة وتستخدم في دفعات فودكس القادمة.')}</div><Table headers={[L(locale, 'Foodics SKU / Item', 'SKU / الصنف'), L(locale, 'ERP Menu Item', 'صنف النظام'), L(locale, 'Recipe lines', 'بنود الوصفة')]} rows={skus.slice(0, 200).map((sku) => { const menuId = itemMap[sku]; const recipeCount = menuId ? (state.recipeLines ?? []).filter((r: any) => r.menuItemId === menuId).length : 0; return [`${sku} — ${itemLabel(sku)}`, <select value={menuId || ''} onChange={(e) => setItemMap({ ...itemMap, [sku]: e.target.value })}><option value="">—</option>{(state.menuItems ?? []).map((m: any) => <option key={m.id} value={m.id}>{m.code} - {locale === 'ar' ? m.nameAr : m.nameEn}</option>)}</select>, recipeCount ? <Pill tone="good">{recipeCount}</Pill> : <Pill tone="bad">0</Pill>]; })}/></Card>
      <Card title={L(locale, 'Payment method mapping', 'ربط طرق الدفع')} icon={<Wallet/>}><Table headers={[L(locale, 'Foodics Method', 'طريقة فودكس'), L(locale, 'ERP Debit Account', 'حساب المدين')]} rows={methods.map((m) => [m, <select value={paymentMap[m] || defaultPaymentAccount(m)} onChange={(e) => setPaymentMap({ ...paymentMap, [m]: e.target.value })}>{(state.chartAccounts ?? []).filter((a: any) => ['asset', 'expense'].includes(a.type)).map((a: any) => <option key={a.code} value={a.code}>{a.code} - {locale === 'ar' ? a.nameAr : a.nameEn}</option>)}</select>])}/></Card>
    </div>}

    {tab === 'validation' && <Card title={L(locale, 'Validation cockpit', 'قمرة التحقق')} icon={<ShieldCheck/>} action={<button onClick={() => saveFile('foodics-validation.csv', rowsToCsv(validations.map(([check, count, severity, action]) => ({ check, count, severity, action }))))}><Download size={16}/>{L(locale, 'Export', 'تصدير')}</button>}>
      <div className="notice">{L(locale, 'Each validation line now has a drill-down action. Use Open issue to jump directly to the affected rows and fix them without searching manually.', 'كل سطر تحقق لديه الآن زر تفصيلي. استخدم فتح المشكلة للانتقال مباشرة إلى الصفوف المتأثرة وتصحيحها دون بحث يدوي.')}</div>
      <Table headers={[L(locale, 'Check', 'الفحص'), L(locale, 'Count / Amount', 'العدد / المبلغ'), L(locale, 'Severity', 'الخطورة'), L(locale, 'Action', 'الإجراء'), L(locale, 'Fix', 'تصحيح')]} rows={validations.map(([check, count, severity, action]) => [check, Math.abs(count) > 1000 ? money(count, locale) : qty(count), <Pill tone={severity}>{severity}</Pill>, action, <button onClick={() => openIssue(issueKeyForCheck(check))}><Wrench size={14}/>{L(locale, 'Open issue', 'فتح المشكلة')}</button>])}/>
      <div className="kpi-grid"><KPI label={L(locale, 'Net lines', 'صافي البنود')} value={money(lineNet, locale)} hint={L(locale, 'Tax exclusive', 'غير شامل الضريبة')} icon={<BarChart3/>}/><KPI label={L(locale, 'VAT lines', 'ضريبة البنود')} value={money(lineVat, locale)} hint="VAT" icon={<CreditCard/>}/><KPI label={L(locale, 'Gross lines', 'إجمالي البنود')} value={money(lineGross, locale)} hint={L(locale, 'Including VAT', 'شامل الضريبة')} icon={<Calculator/>}/><KPI label={L(locale, 'Demand groups', 'مجموعات الطلب')} value={`${demand.length}`} hint={L(locale, 'Inventory deduction groups', 'مجموعات خصم المخزون')} icon={<ChefHat/>}/></div>
    </Card>}

    {tab === 'issues' && <Card title={`${L(locale, 'Issue Center', 'مركز المعالجة')} — ${issueTitle(issueKey)}`} icon={<Wrench/>} action={<div className="button-row"><button onClick={() => saveFile(`foodics-issue-${issueKey}.csv`, rowsToCsv(issueExportRows(issueKey)))}><Download size={16}/>{L(locale, 'Export issue rows', 'تصدير صفوف المشكلة')}</button><button onClick={() => setTab('validation')}><ArrowRight size={16}/>{L(locale, 'Back to validation', 'العودة للتحقق')}</button></div>}>
      <div className="notice">{L(locale, 'This screen shows only the rows connected to the selected validation issue. Fix mappings inline where possible; for setup issues, the action tells you exactly where to correct the master data.', 'هذه الشاشة تعرض فقط الصفوف المرتبطة بمشكلة التحقق المحددة. صحح الربط مباشرة قدر الإمكان؛ أما مشاكل الإعداد فتوضح لك أين يتم تعديل البيانات الأساسية.')}</div>
      <div className="button-row"><button onClick={() => setIssueKey('unmapped_items')}><Link2 size={14}/>{L(locale, 'Unmapped items', 'أصناف غير مربوطة')}</button><button onClick={() => setIssueKey('missing_recipes')}><ChefHat size={14}/>{L(locale, 'Missing recipes', 'وصفات ناقصة')}</button><button onClick={() => setIssueKey('unmapped_branches')}><Store size={14}/>{L(locale, 'Branches', 'الفروع')}</button><button onClick={() => setIssueKey('stock_shortages')}><AlertTriangle size={14}/>{L(locale, 'Stock shortages', 'نواقص المخزون')}</button><button onClick={() => setIssueKey('discounts')}><CreditCard size={14}/>{L(locale, 'Discounts', 'الخصومات')}</button><button onClick={() => setIssueKey('void_orders')}><Trash2 size={14}/>{L(locale, 'Voids', 'الإلغاءات')}</button><button onClick={() => setIssueKey('returned_orders')}><RefreshCw size={14}/>{L(locale, 'Returns', 'المرتجعات')}</button><button onClick={() => setIssueKey('reconciliation_difference')}><Calculator size={14}/>{L(locale, 'Reconciliation', 'المطابقة')}</button></div>
      <Table headers={issueDetails.headers} rows={issueDetails.rows}/>
    </Card>}

    {tab === 'posting' && <div className="page-grid two"><Card title={L(locale, 'Posting readiness', 'جاهزية الترحيل')} icon={<Save/>}>
      <div className={canPost || (postingMode === 'report' && canReportOnly) ? 'notice' : 'notice warning'}>{postingMode === 'report' ? L(locale, 'Report-only mode registers the batch and keeps reconciliation evidence without GL or inventory posting.', 'نمط التقارير يسجل الدفعة ويحفظ أدلة المطابقة دون ترحيل مالي أو مخزني.') : canPost ? L(locale, `Ready for ${postingMode === 'sales' ? 'sales accounting only' : 'full ERP'} local trial posting.`, `جاهز للترحيل التجريبي المحلي بنمط ${postingMode === 'sales' ? 'ترحيل المبيعات مالياً فقط' : 'الترحيل الكامل'}.`) : L(locale, 'Go to Readiness and Mappings to resolve blockers before posting.', 'اذهب إلى الجاهزية والربط لمعالجة الموانع قبل الترحيل.')}</div>
      <div className="form-grid"><label><span>{L(locale, 'Posting mode', 'نمط الترحيل')}</span><select value={postingMode} onChange={(e) => setPostingMode(e.target.value as PostingMode)}><option value="report">{L(locale, 'Report only — no posting', 'تقارير فقط — بدون ترحيل')}</option><option value="sales">{L(locale, 'Sales accounting only', 'ترحيل المبيعات مالياً فقط')}</option><option value="full">{L(locale, 'Full ERP posting with inventory deduction', 'ترحيل كامل مع خصم المخزون')}</option></select></label><label><span>{L(locale, 'Approval note', 'ملاحظة الاعتماد')}</span><input value={approvalNote} onChange={(e) => setApprovalNote(e.target.value)} placeholder={L(locale, 'Checked against Foodics summary before posting', 'تمت المراجعة مع ملخص فودكس قبل الترحيل')}/></label></div>
      {missingRecipes.length > 0 && <div className={postingMode === 'full' ? 'notice warning' : 'notice'}><strong>{L(locale, 'Starter-friendly recipe control', 'رقابة الوصفات المناسبة للبداية')}</strong><p>{L(locale, 'Missing recipes do not block Report-only or Sales Accounting Only. They block Full ERP Posting only because that mode deducts inventory and posts COGS.', 'الوصفات الناقصة لا تمنع نمط التقارير أو ترحيل المبيعات مالياً فقط. تمنع الترحيل الكامل فقط لأنه يخصم المخزون ويرحل تكلفة المبيعات.')}</p><div className="button-row"><button onClick={() => setPostingMode('sales')}><CreditCard size={14}/>{L(locale, 'Use starter sales accounting', 'استخدم ترحيل المبيعات كبداية')}</button><button onClick={() => setTab('menuImport')}><ChefHat size={14}/>{L(locale, 'Import / prepare recipes', 'استيراد / تجهيز الوصفات')}</button><button onClick={() => openIssue('missing_recipes')}><Wrench size={14}/>{L(locale, 'Open missing recipes', 'فتح الوصفات الناقصة')}</button></div></div>}
      <Table headers={[L(locale, 'Gate', 'بوابة الرقابة'), L(locale, 'Status', 'الحالة'), L(locale, 'Meaning', 'المعنى')]} rows={[[L(locale, 'Validation', 'التحقق'), validationBlockers.length ? <Pill tone="bad">Blocked</Pill> : <Pill tone="good">Clear</Pill>, validationBlockers.length ? validationBlockers.join(' / ') : L(locale, 'No hard blockers for selected mode', 'لا توجد موانع جوهرية للنمط المختار')], [L(locale, 'Approval', 'الاعتماد'), approvedBatch ? <Pill tone="good">Approved</Pill> : postingMode === 'report' ? <Pill tone="info">Not required</Pill> : <Pill tone="warn">Required</Pill>, approvedBatch ? `${approvedBatch.approvedBy || 'Local User'} — ${approvedBatch.approvedAt || ''}` : L(locale, 'Approve after validation review', 'اعتمد بعد مراجعة التحقق')], [L(locale, 'Duplicate protection', 'منع التكرار'), postedBatch ? <Pill tone="bad">Posted before</Pill> : duplicateBatch ? <Pill tone="warn">Existing batch</Pill> : <Pill tone="good">OK</Pill>, L(locale, 'Same batch cannot be posted twice unless reversed first', 'لا يمكن ترحيل نفس الدفعة مرتين إلا بعد عكسها')]]}/>
      <div className="button-row"><button disabled={postingMode !== 'report' || !canReportOnly} onClick={registerReportBatch}><Database size={16}/>{L(locale, 'Register Report Batch', 'تسجيل دفعة تقارير')}</button><button disabled={!canApproveBatch} onClick={approveCurrentBatch}><ShieldCheck size={16}/>{L(locale, 'Approve Batch', 'اعتماد الدفعة')}</button><button disabled={!canPost} onClick={postFoodicsBatch}><Save size={16}/>{L(locale, postingMode === 'sales' ? 'Post Sales Accounting Only' : 'Post Full Foodics Batch', postingMode === 'sales' ? 'ترحيل المبيعات مالياً فقط' : 'ترحيل دفعة فودكس كاملة')}</button><button onClick={() => saveFile('foodics-recipe-demand.csv', rowsToCsv(demand.map((d) => ({ store: storeName(d.storeId), item: itemName(d.itemId), required_qty: d.qty, available_qty: balance(d.storeId, d.itemId), unit_cost: d.cost, value: d.qty * d.cost }))))}><Download size={16}/>{L(locale, 'Export demand', 'تصدير الاحتياج')}</button></div>
      <Table headers={[L(locale, 'Store', 'المخزن'), L(locale, 'Ingredient', 'المكون'), L(locale, 'Required', 'المطلوب'), L(locale, 'Available', 'المتاح'), L(locale, 'Value', 'القيمة'), L(locale, 'Status', 'الحالة')]} rows={demand.slice(0, 100).map((d) => [storeName(d.storeId), itemName(d.itemId), qty(d.qty), qty(balance(d.storeId, d.itemId)), money(d.qty * d.cost, locale), Number(d.cost || 0) <= 0 ? <Pill tone="warn">Zero cost</Pill> : balance(d.storeId, d.itemId) >= d.qty ? <Pill tone="good">OK</Pill> : <Pill tone="warn">Short</Pill>])}/>
    </Card><Card title={L(locale, 'Accounting impact', 'الأثر المحاسبي')} icon={<Calculator/>}><Table headers={[L(locale, 'Mode', 'النمط'), L(locale, 'Debit', 'مدين'), L(locale, 'Credit', 'دائن')]} rows={[[L(locale, 'Sales accounting', 'ترحيل المبيعات'), L(locale, 'Cash / Bank / AR / Hospitality expense', 'نقدية / بنك / ذمم / مصروف ضيافة'), L(locale, 'Food Sales + VAT Output', 'مبيعات أغذية + ضريبة مخرجات')], [L(locale, 'Full ERP only', 'الترحيل الكامل فقط'), L(locale, 'Food Cost / COGS', 'تكلفة الغذاء'), L(locale, 'Inventory', 'المخزون')], [L(locale, 'Reversal', 'العكس'), L(locale, 'Reversal journals + opposite stock movement', 'قيود عكسية + حركة مخزون عكسية'), L(locale, 'Keeps audit trail', 'يحافظ على الأثر الرقابي')]]}/></Card></div>}

    {tab === 'reconciliation' && <div className="page-grid two"><Card title={L(locale, 'Order-payment reconciliation', 'مطابقة الطلبات والمدفوعات')} icon={<Calculator/>}><div className="kpi-grid"><KPI label={L(locale, 'Recognized Gross', 'الإجمالي المعترف به')} value={money(orderGross, locale)} hint={L(locale, 'Gross after returns, excluding voids', 'الإجمالي بعد المرتجعات وبدون الإلغاءات')} icon={<CreditCard/>}/><KPI label={L(locale, 'Payments Net', 'صافي المدفوعات')} value={money(paymentTotal, locale)} hint={L(locale, 'Includes refund lines if negative', 'يشمل مدفوعات الاسترداد إذا كانت سالبة')} icon={<Wallet/>}/><KPI label={L(locale, 'Difference', 'الفرق')} value={money(reconDiff, locale)} hint={L(locale, 'Investigate before closing', 'تحقق قبل الإغلاق')} icon={<AlertTriangle/>}/><KPI label={L(locale, 'Discounts', 'الخصومات')} value={money(discountTotal, locale)} hint={L(locale, 'Analytical; sales posted net', 'تحليلي؛ المبيعات ترحل صافي')} icon={<RefreshCw/>}/></div><Table headers={[L(locale, 'Control item', 'بند رقابي'), L(locale, 'Count / Amount', 'العدد / المبلغ'), L(locale, 'Treatment', 'المعالجة')]} rows={[[L(locale, 'Gross before voids/returns', 'الإجمالي قبل الإلغاءات والمرتجعات'), money(grossBeforeVoidsReturns, locale), L(locale, 'Reference only', 'مرجعي فقط')], [L(locale, 'Voided orders', 'الطلبات الملغاة'), `${voidOrders.length} / ${money(voidGross, locale)}`, L(locale, 'Excluded from revenue; reviewed as cashier control exception', 'تستبعد من الإيراد وتراجع كاستثناء رقابي للكاشير')], [L(locale, 'Returned orders', 'الطلبات المرتجعة'), `${returnedOrders.length} / ${money(returnGross, locale)}`, L(locale, 'Negative revenue/VAT; inventory is not restored by default', 'إيراد/ضريبة سالبة ولا يعاد المخزون افتراضياً')], [L(locale, 'Refund payments', 'مدفوعات الاسترداد'), `${refundPayments.length} / ${money(refundPaymentTotal, locale)}`, L(locale, 'Credits cash/card/receivable clearing accounts', 'تسجل دائنة على حسابات النقد/البطاقات/الذمم')]]}/></Card><Card title={L(locale, 'Payments by method', 'المدفوعات حسب الطريقة')} icon={<Wallet/>}><Table headers={[L(locale, 'Method', 'الطريقة'), L(locale, 'Amount', 'المبلغ'), L(locale, 'Account', 'الحساب')]} rows={paymentsByMethod.map(([m, amount]) => [m, money(amount, locale), paymentMap[m] || defaultPaymentAccount(m)])}/></Card></div>}

    {tab === 'adjustments' && <div className="page-grid two"><Card title={L(locale, 'Discounts, voids, refunds, and returns control', 'رقابة الخصومات والإلغاءات والاستردادات والمرتجعات')} icon={<RefreshCw/>} action={<button onClick={() => saveFile('foodics-adjustments-control.csv', rowsToCsv([...issueExportRows('discounts'), ...issueExportRows('void_orders'), ...issueExportRows('returned_orders'), ...issueExportRows('refund_payments')]))}><Download size={16}/>{L(locale, 'Export adjustments', 'تصدير الحركات التصحيحية')}</button>}><div className="kpi-grid"><KPI label={L(locale, 'Discounts', 'الخصومات')} value={money(discountTotal, locale)} hint={`${discountLines.length || discountedOrders.length} ${L(locale, 'rows/orders', 'صف/طلب')}`} icon={<CreditCard/>}/><KPI label={L(locale, 'Voids', 'الإلغاءات')} value={`${voidOrders.length}`} hint={money(voidGross, locale)} icon={<Trash2/>}/><KPI label={L(locale, 'Returns', 'المرتجعات')} value={`${returnedOrders.length}`} hint={money(returnGross, locale)} icon={<RefreshCw/>}/><KPI label={L(locale, 'Refund payments', 'مدفوعات الاسترداد')} value={`${refundPayments.length}`} hint={money(refundPaymentTotal, locale)} icon={<Wallet/>}/></div><Table headers={[L(locale, 'Control', 'الرقابة'), L(locale, 'ERP treatment', 'معالجة النظام'), L(locale, 'Posting effect', 'أثر الترحيل')]} rows={[[L(locale, 'Discounts', 'الخصومات'), L(locale, 'Foodics sales are posted net of discount; discount detail remains analytical for control reports.', 'ترحل مبيعات فودكس صافية بعد الخصم وتبقى تفاصيل الخصم تحليلية للتقارير الرقابية.'), L(locale, 'No extra GL line in v36 unless you later choose gross-sales reporting.', 'لا يوجد قيد إضافي في v36 إلا إذا اخترت لاحقاً عرض إجمالي المبيعات قبل الخصم.')], [L(locale, 'Voids', 'الإلغاءات'), L(locale, 'Void orders are excluded from revenue, VAT, COGS, and inventory deduction.', 'تستبعد الطلبات الملغاة من الإيراد والضريبة وتكلفة المبيعات وخصم المخزون.'), L(locale, 'No GL posting; appears as cashier/operations exception.', 'لا يوجد ترحيل مالي وتظهر كاستثناء تشغيلي/كاشير.')], [L(locale, 'Returns', 'المرتجعات'), L(locale, 'Returned orders reduce revenue and VAT. Food inventory is not restored by default because returned food is not reusable.', 'المرتجعات تخفض الإيراد والضريبة ولا يعاد مخزون الطعام افتراضياً لأنه غير قابل لإعادة الاستخدام.'), L(locale, 'Negative sales/VAT; COGS reversal requires a future policy toggle if needed.', 'إيراد/ضريبة سالبة، وعكس تكلفة المبيعات يحتاج خيار سياسة لاحق إذا رغبت.')], [L(locale, 'Refund payments', 'مدفوعات الاسترداد'), L(locale, 'Negative payment lines credit the cash/card/receivable account instead of creating invalid negative debit.', 'مدفوعات الاسترداد السالبة تسجل دائنة على حساب النقد/البطاقات/الذمم بدلاً من مدين سالب غير صحيح.'), L(locale, 'Cleaner bank/card reconciliation.', 'مطابقة بنكية وبطاقات أنظف.')]]}/></Card><Card title={L(locale, 'Adjustment drilldowns', 'تفاصيل الحركات التصحيحية')} icon={<AlertTriangle/>}><div className="button-row"><button onClick={() => openIssue('discounts')}>{L(locale, 'Open discounts', 'فتح الخصومات')}</button><button onClick={() => openIssue('void_orders')}>{L(locale, 'Open voids', 'فتح الإلغاءات')}</button><button onClick={() => openIssue('returned_orders')}>{L(locale, 'Open returns', 'فتح المرتجعات')}</button><button onClick={() => openIssue('refund_payments')}>{L(locale, 'Open refund payments', 'فتح مدفوعات الاسترداد')}</button></div><Table headers={[L(locale, 'Metric', 'المؤشر'), L(locale, 'Value', 'القيمة'), L(locale, 'Action', 'الإجراء')]} rows={[[L(locale, 'Discount approval exposure', 'تعرض اعتماد الخصومات'), money(discountTotal, locale), L(locale, 'Review by cashier/discount name before month close', 'راجع حسب الكاشير/اسم الخصم قبل إقفال الشهر')], [L(locale, 'Void exposure', 'تعرض الإلغاءات'), money(voidGross, locale), L(locale, 'Review void trend by cashier and branch', 'راجع اتجاه الإلغاء حسب الكاشير والفرع')], [L(locale, 'Return/refund exposure', 'تعرض المرتجعات/الاستردادات'), money(returnGross + refundPaymentTotal, locale), L(locale, 'Match returned orders to refund payments and original order reference', 'طابق المرتجعات مع مدفوعات الاسترداد ومرجع الطلب الأصلي')]]}/></Card></div>}


    {tab === 'batches' && <Card title={L(locale, 'Foodics batch register and reversal control', 'سجل دفعات فودكس ورقابة العكس')} icon={<Database/>} action={<button onClick={() => saveFile('foodics-batch-register.csv', rowsToCsv(batches.map((b) => ({ ref: b.ref, date: b.date, mode: b.mode, status: b.status, orders: b.orderCount, lines: b.lineCount, payments: b.paymentCount, order_gross: b.orderGross, payment_total: b.paymentTotal, difference: b.difference, journals: b.journalRefs.join('|'), stock_movements: b.stockMovementCount, sales_docs: b.salesDocCount, approved_at: b.approvedAt || '', reversed_at: b.reversedAt || '', reversal_reason: b.reversalReason || '', note: b.note }))))}><Download size={16}/>{L(locale, 'Export register', 'تصدير السجل')}</button>}>
      <Table headers={[L(locale, 'Date', 'التاريخ'), L(locale, 'Batch', 'الدفعة'), L(locale, 'Mode', 'النمط'), L(locale, 'Status', 'الحالة'), L(locale, 'Orders', 'الطلبات'), L(locale, 'Gross', 'الإجمالي'), L(locale, 'Payments', 'المدفوعات'), L(locale, 'Diff', 'الفرق'), L(locale, 'Journals', 'القيود'), L(locale, 'Action', 'إجراء')]} rows={batches.map((b) => [b.date, b.ref, b.mode, <Pill tone={b.status === 'reversed' ? 'warn' : b.status === 'uploaded' ? 'info' : 'good'}>{b.status}</Pill>, b.orderCount, money(b.orderGross, locale), money(b.paymentTotal, locale), money(b.difference, locale), b.journalRefs.join(', ') || '—', <button disabled={b.status === 'reversed' || b.status === 'report_only' || b.status === 'approved' || b.mode === 'report'} onClick={() => reversePostedBatch(b)}><RefreshCw size={14}/>{L(locale, 'Reverse', 'عكس')}</button>])}/>
    </Card>}

    {tab === 'reports' && <div className="page-grid two"><Card title={L(locale, 'Sales by branch', 'المبيعات حسب الفرع')} icon={<BarChart3/>} action={<button onClick={() => saveFile('foodics-sales-by-branch.csv', rowsToCsv(salesByBranch.map(([branch, net]) => ({ branch, branch_name: branchLabel(branch), net_sales: net, erp_branch: branchMap[branch] ? branchName(branchMap[branch]) : '' }))))}><Download size={16}/>{L(locale, 'Export', 'تصدير')}</button>}><Table headers={[L(locale, 'Branch', 'الفرع'), L(locale, 'Net Sales', 'صافي المبيعات'), L(locale, 'ERP Branch', 'فرع النظام')]} rows={salesByBranch.map(([branch, net]) => [`${branch} — ${branchLabel(branch)}`, money(net, locale), branchMap[branch] ? branchName(branchMap[branch]) : <Pill tone="bad">Unmapped</Pill>])}/></Card><Card title={L(locale, 'Top Foodics items', 'أعلى أصناف فودكس')} icon={<BarChart3/>} action={<button onClick={() => saveFile('foodics-sales-by-item.csv', rowsToCsv(salesByItem.map(([sku, net]) => ({ sku, item_name: itemLabel(sku), net_sales: net, erp_menu: itemMap[sku] ? menuName(itemMap[sku]) : '' }))))}><Download size={16}/>{L(locale, 'Export', 'تصدير')}</button>}><Table headers={[L(locale, 'SKU / Item', 'SKU / الصنف'), L(locale, 'Net Sales', 'صافي المبيعات'), L(locale, 'ERP Menu', 'صنف النظام')]} rows={salesByItem.slice(0, 100).map(([sku, net]) => [`${sku} — ${itemLabel(sku)}`, money(net, locale), itemMap[sku] ? menuName(itemMap[sku]) : <Pill tone="bad">Unmapped</Pill>])}/></Card></div>}
  </div>;
}
