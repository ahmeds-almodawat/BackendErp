export type V386V390GateId = 'inventory' | 'sales' | 'production' | 'financeClose' | 'hr';
export type V386V390GateStatus = 'ready' | 'watch' | 'blocked';
export type V386V390Severity = 'critical' | 'warning' | 'info' | 'good';

export interface V386V390Finding {
  severity: V386V390Severity;
  area: string;
  finding: string;
  action: string;
}

export interface V386V390CheckRow {
  check: string;
  status: V386V390GateStatus;
  evidence: string;
  nextAction: string;
}

export interface V386V390GateSnapshot {
  gateId: V386V390GateId;
  version: string;
  title: string;
  titleAr: string;
  generatedAt: string;
  score: number;
  status: V386V390GateStatus;
  counts: Record<string, number>;
  checks: V386V390CheckRow[];
  findings: V386V390Finding[];
  cutoverRule: string;
  cutoverRuleAr: string;
  nextAction: string;
}

export interface V386V390OperationalGatesSnapshot {
  version: string;
  generatedAt: string;
  overallScore: number;
  status: V386V390GateStatus;
  gates: V386V390GateSnapshot[];
  nextAction: string;
}

function arr<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function n(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function statusFromCounts(critical: number, warning: number): V386V390GateStatus {
  if (critical > 0) return 'blocked';
  if (warning > 0) return 'watch';
  return 'ready';
}

function scoreFromFindings(findings: V386V390Finding[], base = 100) {
  const penalty = findings.reduce((sum, finding) => {
    if (finding.severity === 'critical') return sum + 18;
    if (finding.severity === 'warning') return sum + 8;
    if (finding.severity === 'info') return sum + 2;
    return sum;
  }, 0);
  return Math.max(0, Math.min(100, Math.round(base - penalty)));
}

function finding(list: V386V390Finding[], severity: V386V390Severity, area: string, message: string, action: string) {
  list.push({ severity, area, finding: message, action });
}

function check(check: string, status: V386V390GateStatus, evidence: string, nextAction: string): V386V390CheckRow {
  return { check, status, evidence, nextAction };
}

function posted(doc: any) {
  return String(doc?.status || '').toLowerCase() === 'posted' || doc?.posted === true;
}

function blockedStatus(doc: any) {
  return ['rejected', 'cancelled', 'blocked', 'error'].includes(String(doc?.status || '').toLowerCase());
}

function itemIds(state: any) {
  return new Set(arr(state?.items).map((item: any) => String(item?.id || '')).filter(Boolean));
}

function buildInventoryGate(state: any): V386V390GateSnapshot {
  const findings: V386V390Finding[] = [];
  const items = arr(state?.items).filter((item: any) => item?.active !== false);
  const stores = arr(state?.stores).filter((store: any) => store?.active !== false);
  const movements = arr(state?.stockMovements);
  const transfers = arr(state?.transfers);
  const lots = arr(state?.inventoryLots);
  const approvals = arr(state?.inventoryApprovals);
  const returns = arr(state?.supplierReturns);
  const bins = arr(state?.binLocations);
  const ids = itemIds(state);
  const movementMissingItem = movements.filter((movement: any) => movement?.itemId && !ids.has(String(movement.itemId))).length;
  const negativeMovements = movements.filter((movement: any) => n(movement?.qty) < 0).length;
  const unpostedApprovals = approvals.filter((approval: any) => ['pending', 'approved'].includes(String(approval?.status || '').toLowerCase())).length;
  const expiredLots = lots.filter((lot: any) => String(lot?.expiryDate || '9999-12-31').slice(0, 10) < new Date().toISOString().slice(0, 10) && n(lot?.qty) > 0).length;
  const blockedTransfers = transfers.filter(blockedStatus).length;

  if (!items.length) finding(findings, 'critical', 'Item master', 'No active items exist for inventory control.', 'Create item master data before inventory pilot.');
  if (!stores.length) finding(findings, 'critical', 'Stores', 'No active stores exist for stock ownership.', 'Create stores and assign them to branches.');
  if (!movements.length) finding(findings, 'warning', 'Stock ledger', 'No stock movements exist yet.', 'Run opening stock, purchase receipt, transfer, and adjustment scenarios.');
  if (movementMissingItem) finding(findings, 'critical', 'Stock integrity', `${movementMissingItem} stock movement(s) reference missing items.`, 'Repair item references before backend valuation.');
  if (negativeMovements) finding(findings, 'warning', 'Movement signs', `${negativeMovements} movement(s) have negative quantities.`, 'Confirm whether direction fields or signed quantities are the official convention.');
  if (unpostedApprovals) finding(findings, 'warning', 'Approvals', `${unpostedApprovals} inventory approval(s) are pending/approved but not posted.`, 'Finish approval-to-post lifecycle through backend worker evidence.');
  if (expiredLots) finding(findings, 'critical', 'Expiry control', `${expiredLots} lot(s) appear expired with quantity on hand.`, 'Block issue/sale of expired lots or quarantine them.');
  if (blockedTransfers) finding(findings, 'warning', 'Transfers', `${blockedTransfers} transfer(s) are blocked/cancelled/rejected.`, 'Resolve failed transfer evidence before pilot.');
  if (!findings.length) finding(findings, 'good', 'Inventory gate', 'No major local inventory blockers detected.', 'Proceed to backend stock ledger, costing, and valuation proof.');

  const critical = findings.filter((x) => x.severity === 'critical').length;
  const warning = findings.filter((x) => x.severity === 'warning').length;
  return {
    gateId: 'inventory',
    version: 'v386 Inventory Workflow Gate',
    title: 'Inventory Workflow Gate',
    titleAr: 'بوابة دورة المخزون',
    generatedAt: new Date().toISOString(),
    score: scoreFromFindings(findings),
    status: statusFromCounts(critical, warning),
    counts: { items: items.length, stores: stores.length, movements: movements.length, lots: lots.length, bins: bins.length, transfers: transfers.length, approvals: approvals.length, returns: returns.length },
    checks: [
      check('Item/store master readiness', items.length && stores.length ? 'ready' : 'blocked', `${items.length} item(s), ${stores.length} store(s).`, 'Complete item and store master data.'),
      check('Stock movement evidence', movements.length ? 'ready' : 'watch', `${movements.length} movement(s), ${movementMissingItem} missing item reference(s).`, 'Run opening, receipt, issue, transfer, and adjustment examples.'),
      check('Lot/bin/expiry controls', lots.length || bins.length ? (expiredLots ? 'blocked' : 'ready') : 'watch', `${lots.length} lot(s), ${bins.length} bin(s), ${expiredLots} expired lot(s).`, 'Add lot/bin/expiry evidence for food and medical-resort operations.'),
      check('Approval-to-post lifecycle', unpostedApprovals ? 'watch' : 'ready', `${unpostedApprovals} pending/approved inventory approval(s).`, 'Require backend posting for approved adjustments and counts.'),
    ],
    cutoverRule: 'Inventory is production-ready only when stock movements, lot/bin/expiry controls, approvals, and valuation can be rebuilt from backend ledger evidence.',
    cutoverRuleAr: 'يصبح المخزون جاهزًا للإنتاج فقط عندما يمكن إعادة بناء الحركات والدفعات والمواقع والاعتمادات والتقييم من دليل دفتر المخزون الخلفي.',
    nextAction: critical ? 'Repair critical stock integrity issues before pilot.' : warning ? 'Run a complete opening-stock to count-adjustment scenario.' : 'Proceed to inventory valuation and COGS proof.',
  };
}

function buildSalesGate(state: any): V386V390GateSnapshot {
  const findings: V386V390Finding[] = [];
  const sales = arr(state?.sales);
  const menuItems = arr(state?.menuItems).filter((item: any) => item?.active !== false);
  const recipeLines = arr(state?.recipeLines);
  const payments = new Set(sales.map((sale: any) => String(sale?.paymentMethod || '').trim()).filter(Boolean));
  const postedSales = sales.filter(posted).length;
  const unpostedSales = sales.length - postedSales;
  const menuIdsWithRecipe = new Set(recipeLines.map((line: any) => String(line?.menuItemId || '')).filter(Boolean));
  const menuWithoutRecipe = menuItems.filter((menu: any) => !menuIdsWithRecipe.has(String(menu?.id || ''))).length;
  const salesWithoutMenu = sales.filter((sale: any) => sale?.menuItemId && !menuItems.some((menu: any) => menu?.id === sale.menuItemId)).length;
  const zeroQtySales = sales.filter((sale: any) => n(sale?.qty) <= 0).length;

  if (!menuItems.length) finding(findings, 'critical', 'Menu master', 'No active menu items exist for POS settlement.', 'Create menu master data before sales pilot.');
  if (!sales.length) finding(findings, 'warning', 'Sales evidence', 'No POS/local sales rows exist yet.', 'Import or create one sales day and settle it.');
  if (menuWithoutRecipe) finding(findings, 'warning', 'Recipe deduction', `${menuWithoutRecipe} menu item(s) have no recipe lines.`, 'Map recipes for products that consume inventory.');
  if (salesWithoutMenu) finding(findings, 'critical', 'Sales integrity', `${salesWithoutMenu} sale(s) reference missing menu items.`, 'Repair POS menu mapping before replay.');
  if (zeroQtySales) finding(findings, 'warning', 'Sales quality', `${zeroQtySales} sale(s) have zero/negative quantity.`, 'Validate refunds/voids separately from normal sales.');
  if (unpostedSales) finding(findings, 'warning', 'Settlement', `${unpostedSales} sale(s) are not marked posted.`, 'Use POS replay and settlement evidence before finance posting.');
  if (!payments.size && sales.length) finding(findings, 'warning', 'Payments', 'Sales rows do not show clear payment methods.', 'Map cash, card, delivery, discounts, refunds, and tips/charges.');
  if (!findings.length) finding(findings, 'good', 'Sales gate', 'No major local POS blockers detected.', 'Proceed to POS replay, settlement, VAT, and COGS proof.');

  const critical = findings.filter((x) => x.severity === 'critical').length;
  const warning = findings.filter((x) => x.severity === 'warning').length;
  return {
    gateId: 'sales',
    version: 'v387 Sales / POS Settlement Gate',
    title: 'Sales / POS Settlement Gate',
    titleAr: 'بوابة تسوية المبيعات والكاشير',
    generatedAt: new Date().toISOString(),
    score: scoreFromFindings(findings),
    status: statusFromCounts(critical, warning),
    counts: { sales: sales.length, postedSales, unpostedSales, menuItems: menuItems.length, recipeLines: recipeLines.length, paymentMethods: payments.size, menuWithoutRecipe, salesWithoutMenu },
    checks: [
      check('Menu and recipe mapping', menuItems.length && !menuWithoutRecipe ? 'ready' : menuItems.length ? 'watch' : 'blocked', `${menuItems.length} menu item(s), ${menuWithoutRecipe} without recipes.`, 'Map recipes for inventory-consuming menu items.'),
      check('Sales replay evidence', sales.length ? (salesWithoutMenu ? 'blocked' : 'ready') : 'watch', `${sales.length} sale row(s), ${salesWithoutMenu} missing menu reference(s).`, 'Run POS/Foodics replay worker for a realistic day.'),
      check('Payment settlement', payments.size ? 'ready' : 'watch', `${payments.size} payment method(s) detected.`, 'Map card/cash/bank/delivery/refund settlement rules.'),
      check('Posting status', unpostedSales ? 'watch' : 'ready', `${postedSales}/${sales.length} posted sale(s).`, 'Block final finance posting until replay/settlement is complete.'),
    ],
    cutoverRule: 'Sales is production-ready only when POS replay is idempotent, payments reconcile, VAT is explainable, and recipe/COGS deduction is backend-evidenced.',
    cutoverRuleAr: 'تصبح المبيعات جاهزة للإنتاج فقط عند إثبات إعادة تشغيل نقاط البيع دون تكرار، ومطابقة المدفوعات، وتفسير الضريبة، وربط الوصفات وتكلفة المبيعات بدليل خلفي.',
    nextAction: critical ? 'Repair critical POS mapping issues first.' : warning ? 'Run one complete POS day-close and settlement scenario.' : 'Proceed to VAT/COGS posting proof.',
  };
}

function buildProductionGate(state: any): V386V390GateSnapshot {
  const findings: V386V390Finding[] = [];
  const recipes = arr(state?.productionRecipes);
  const productions = arr(state?.productions);
  const recipeLines = arr(state?.recipeLines);
  const items = itemIds(state);
  const postedProductions = productions.filter(posted).length;
  const unpostedProductions = productions.length - postedProductions;
  const recipeWithoutLines = recipes.filter((recipe: any) => !recipeLines.some((line: any) => line?.menuItemId === recipe?.menuItemId || line?.recipeId === recipe?.id)).length;
  const productionWithoutRecipe = productions.filter((prod: any) => prod?.recipeId && !recipes.some((recipe: any) => recipe?.id === prod.recipeId)).length;
  const recipeLineMissingItem = recipeLines.filter((line: any) => line?.itemId && !items.has(String(line.itemId))).length;
  const zeroOutput = productions.filter((prod: any) => n(prod?.qty) <= 0).length;

  if (!recipes.length && !recipeLines.length) finding(findings, 'warning', 'Recipes', 'No production or menu recipe evidence exists yet.', 'Create recipes for dough, sauces, BBQ prep, and semi-finished production.');
  if (!productions.length) finding(findings, 'warning', 'Production batches', 'No production batches exist yet.', 'Run one production batch from raw consumption to finished output.');
  if (recipeWithoutLines) finding(findings, 'warning', 'Recipe completeness', `${recipeWithoutLines} production recipe(s) have no detectable lines.`, 'Add raw material lines, yield, wastage, and unit conversions.');
  if (productionWithoutRecipe) finding(findings, 'critical', 'Production integrity', `${productionWithoutRecipe} production batch(es) reference missing recipes.`, 'Repair production recipe references before cutover.');
  if (recipeLineMissingItem) finding(findings, 'critical', 'Raw material integrity', `${recipeLineMissingItem} recipe line(s) reference missing items.`, 'Repair item mapping before inventory deduction.');
  if (zeroOutput) finding(findings, 'warning', 'Yield', `${zeroOutput} production batch(es) have zero/negative output.`, 'Separate wastage/failed batch treatment from normal output.');
  if (unpostedProductions) finding(findings, 'warning', 'Posting', `${unpostedProductions} production batch(es) are not posted.`, 'Require backend WIP/finished goods posting before pilot.');
  if (!findings.length) finding(findings, 'good', 'Production gate', 'No major production workflow blockers detected.', 'Proceed to production costing and inventory posting proof.');

  const critical = findings.filter((x) => x.severity === 'critical').length;
  const warning = findings.filter((x) => x.severity === 'warning').length;
  return {
    gateId: 'production',
    version: 'v388 Production / Recipe Gate',
    title: 'Production / Recipe Gate',
    titleAr: 'بوابة الإنتاج والوصفات',
    generatedAt: new Date().toISOString(),
    score: scoreFromFindings(findings),
    status: statusFromCounts(critical, warning),
    counts: { productionRecipes: recipes.length, productionBatches: productions.length, postedProductions, unpostedProductions, recipeLines: recipeLines.length, recipeWithoutLines, recipeLineMissingItem },
    checks: [
      check('Recipe structure', recipes.length || recipeLines.length ? (recipeLineMissingItem ? 'blocked' : 'ready') : 'watch', `${recipes.length} recipe(s), ${recipeLines.length} line(s), ${recipeLineMissingItem} missing item reference(s).`, 'Complete raw material lines, yield, wastage, and unit conversions.'),
      check('Batch execution', productions.length ? (productionWithoutRecipe ? 'blocked' : 'ready') : 'watch', `${productions.length} batch(es), ${productionWithoutRecipe} missing recipe reference(s).`, 'Run dough/sauce/prep batches with clear output and consumption evidence.'),
      check('Posting evidence', unpostedProductions ? 'watch' : 'ready', `${postedProductions}/${productions.length} posted batch(es).`, 'Post consumption/output through backend stock ledger.'),
      check('Yield control', zeroOutput ? 'watch' : 'ready', `${zeroOutput} zero/negative output batch(es).`, 'Define variance and failed-batch treatment.'),
    ],
    cutoverRule: 'Production is production-ready only when recipes, yield, wastage, WIP/finished goods, and raw material deduction are backend-evidenced.',
    cutoverRuleAr: 'يصبح الإنتاج جاهزًا للإنتاج فقط عند إثبات الوصفات والعائد والهالك وتحت التشغيل والمنتج النهائي وخصم الخام من النظام الخلفي.',
    nextAction: critical ? 'Repair critical recipe/production references first.' : warning ? 'Run a full BBQ/bread/sauce production scenario.' : 'Proceed to production costing proof.',
  };
}

function journalBalanced(journal: any) {
  const lines = arr(journal?.lines);
  const debit = lines.reduce((sum, line: any) => sum + n(line?.debit), 0);
  const credit = lines.reduce((sum, line: any) => sum + n(line?.credit), 0);
  return Math.abs(debit - credit) < 0.01;
}

function buildFinanceCloseGate(state: any): V386V390GateSnapshot {
  const findings: V386V390Finding[] = [];
  const journals = arr(state?.journals);
  const fiscalPeriods = arr(state?.fiscalPeriods);
  const bankReconLines = arr(state?.bankReconLines);
  const fixedAssets = arr(state?.fixedAssets);
  const arInvoices = arr(state?.arInvoices);
  const purchaseInvoices = arr(state?.purchaseInvoices);
  const supplierPayments = arr(state?.supplierPayments);
  const unbalancedJournals = journals.filter((journal: any) => !journalBalanced(journal)).length;
  const postedJournals = journals.filter(posted).length;
  const openPeriods = fiscalPeriods.filter((period: any) => String(period?.status || '').toLowerCase() === 'open').length;
  const unmatchedBankLines = bankReconLines.filter((line: any) => String(line?.status || '').toLowerCase() !== 'matched').length;
  const unpaidAR = arInvoices.filter((invoice: any) => n(invoice?.amount) - n(invoice?.paidAmount) > 0.01).length;
  const unpaidAP = purchaseInvoices.filter((invoice: any) => String(invoice?.status || '').toLowerCase() === 'posted' && !supplierPayments.some((payment: any) => payment?.invoiceRef === invoice?.ref)).length;

  if (!journals.length) finding(findings, 'warning', 'General ledger', 'No journal evidence exists yet.', 'Post at least one balanced manual journal and one operational posting scenario.');
  if (unbalancedJournals) finding(findings, 'critical', 'Trial balance', `${unbalancedJournals} journal(s) are not balanced.`, 'Block financial close until debit/credit equality is proven.');
  if (!fiscalPeriods.length) finding(findings, 'warning', 'Fiscal periods', 'No fiscal period setup exists.', 'Create monthly fiscal periods and lock/close workflow.');
  if (openPeriods > 1) finding(findings, 'warning', 'Period control', `${openPeriods} fiscal period(s) are open.`, 'Define close sequence and lock prior months after review.');
  if (unmatchedBankLines) finding(findings, 'warning', 'Bank reconciliation', `${unmatchedBankLines} bank line(s) are unmatched.`, 'Reconcile bank lines before month-end sign-off.');
  if (unpaidAR) finding(findings, 'info', 'AR', `${unpaidAR} AR invoice(s) have remaining balances.`, 'Review aging, collection, and expected cash-flow assumptions.');
  if (unpaidAP) finding(findings, 'info', 'AP', `${unpaidAP} posted supplier invoice(s) have no linked payment reference.`, 'Review AP aging and payment allocation before close.');
  if (!fixedAssets.length) finding(findings, 'info', 'Fixed assets', 'No fixed asset register evidence exists yet.', 'Add depreciation policy and asset register before formal financial statements.');
  if (!findings.length) finding(findings, 'good', 'Finance close gate', 'No major finance close blockers detected.', 'Proceed to backend close, reversal, and report snapshot proof.');

  const critical = findings.filter((x) => x.severity === 'critical').length;
  const warning = findings.filter((x) => x.severity === 'warning').length;
  return {
    gateId: 'financeClose',
    version: 'v389 Finance Close Gate',
    title: 'Finance Close Gate',
    titleAr: 'بوابة الإغلاق المالي',
    generatedAt: new Date().toISOString(),
    score: scoreFromFindings(findings, 96),
    status: statusFromCounts(critical, warning),
    counts: { journals: journals.length, postedJournals, unbalancedJournals, fiscalPeriods: fiscalPeriods.length, openPeriods, bankReconLines: bankReconLines.length, unmatchedBankLines, fixedAssets: fixedAssets.length, arInvoices: arInvoices.length, purchaseInvoices: purchaseInvoices.length },
    checks: [
      check('Trial balance equality', unbalancedJournals ? 'blocked' : journals.length ? 'ready' : 'watch', `${journals.length} journal(s), ${unbalancedJournals} unbalanced.`, 'Prove debit/credit equality from backend posted lines.'),
      check('Period lock/close', fiscalPeriods.length ? (openPeriods > 1 ? 'watch' : 'ready') : 'watch', `${fiscalPeriods.length} period(s), ${openPeriods} open.`, 'Create close checklist and lock previous periods.'),
      check('Bank reconciliation', unmatchedBankLines ? 'watch' : 'ready', `${bankReconLines.length} bank line(s), ${unmatchedBankLines} unmatched.`, 'Match bank statement to cash/bank GL before close.'),
      check('AP/AR review', unpaidAP || unpaidAR ? 'watch' : 'ready', `${unpaidAP} AP gap(s), ${unpaidAR} AR open invoice(s).`, 'Review aging and linked settlement evidence.'),
    ],
    cutoverRule: 'Finance close is production-ready only when all statements are generated from posted backend lines, periods lock, reversals are controlled, and bank/AP/AR reconcile.',
    cutoverRuleAr: 'يصبح الإغلاق المالي جاهزًا للإنتاج فقط عند صدور القوائم من قيود خلفية مرحلة، وقفل الفترات، وضبط عكس القيود، ومطابقة البنك والذمم.',
    nextAction: critical ? 'Repair unbalanced journals before any pilot close.' : warning ? 'Run a full month-end close rehearsal.' : 'Proceed to formal financial statement snapshot proof.',
  };
}

function buildHrGate(state: any): V386V390GateSnapshot {
  const findings: V386V390Finding[] = [];
  const employees = arr(state?.employees).filter((employee: any) => employee?.active !== false);
  const users = arr(state?.userAccounts).filter((user: any) => user?.active !== false);
  const roles = arr(state?.roles);
  const userAccess = arr(state?.userAccess);
  const attendance = arr(state?.attendance);
  const schedules = arr(state?.schedules);
  const linkedUsers = users.filter((user: any) => user?.employeeId && employees.some((employee: any) => employee?.id === user.employeeId)).length;
  const usersWithoutEmployee = users.length - linkedUsers;
  const employeesWithoutUser = employees.filter((employee: any) => !users.some((user: any) => user?.employeeId === employee?.id)).length;
  const usersWithoutAccess = users.filter((user: any) => !userAccess.some((access: any) => access?.userId === user?.id || access?.employeeId === user?.employeeId)).length;
  const attendanceWithoutEmployee = attendance.filter((row: any) => row?.employeeId && !employees.some((employee: any) => employee?.id === row.employeeId)).length;
  const schedulesWithoutEmployee = schedules.filter((row: any) => row?.employeeId && !employees.some((employee: any) => employee?.id === row.employeeId)).length;

  if (!employees.length) finding(findings, 'critical', 'Employee master', 'No active employees exist.', 'Create employee master data before HR pilot.');
  if (!users.length) finding(findings, 'warning', 'User accounts', 'No active user accounts exist.', 'Create owner/admin and role-scoped user accounts.');
  if (usersWithoutEmployee) finding(findings, 'warning', 'User linkage', `${usersWithoutEmployee} user account(s) are not linked to employees.`, 'Link users to employees for auditability and approvals.');
  if (employeesWithoutUser) finding(findings, 'info', 'Access coverage', `${employeesWithoutUser} employee(s) have no user account.`, 'Confirm whether they are operators or non-system staff.');
  if (usersWithoutAccess) finding(findings, 'critical', 'Access scope', `${usersWithoutAccess} active user(s) have no branch/store/cost-center access scope.`, 'Assign scopes before production login.');
  if (!roles.length) finding(findings, 'critical', 'Roles', 'No roles exist in local state.', 'Create role templates and permission assignments.');
  if (attendanceWithoutEmployee || schedulesWithoutEmployee) finding(findings, 'critical', 'Attendance integrity', `${attendanceWithoutEmployee + schedulesWithoutEmployee} attendance/schedule row(s) reference missing employees.`, 'Repair employee references before payroll or attendance reporting.');
  if (!attendance.length) finding(findings, 'warning', 'Attendance evidence', 'No attendance punches exist yet.', 'Run punch-in/out or shift import scenario.');
  if (!schedules.length) finding(findings, 'info', 'Scheduling', 'No schedules exist yet.', 'Add schedule evidence before manpower/utilization reporting.');
  if (!findings.length) finding(findings, 'good', 'HR gate', 'No major HR/access blockers detected.', 'Proceed to attendance, payroll, and role-scope proof.');

  const critical = findings.filter((x) => x.severity === 'critical').length;
  const warning = findings.filter((x) => x.severity === 'warning').length;
  return {
    gateId: 'hr',
    version: 'v390 HR / Attendance Gate',
    title: 'HR / Attendance Gate',
    titleAr: 'بوابة الموارد البشرية والحضور',
    generatedAt: new Date().toISOString(),
    score: scoreFromFindings(findings),
    status: statusFromCounts(critical, warning),
    counts: { employees: employees.length, users: users.length, linkedUsers, usersWithoutEmployee, employeesWithoutUser, roles: roles.length, userAccess: userAccess.length, usersWithoutAccess, attendance: attendance.length, schedules: schedules.length },
    checks: [
      check('Employee/user linkage', usersWithoutEmployee ? 'watch' : employees.length ? 'ready' : 'blocked', `${linkedUsers}/${users.length} user(s) linked to employees.`, 'Link every system user to an employee/person record.'),
      check('Role and scope readiness', roles.length && !usersWithoutAccess ? 'ready' : 'blocked', `${roles.length} role(s), ${usersWithoutAccess} user(s) without access scope.`, 'Assign role and branch/store/cost-center scope before production.'),
      check('Attendance integrity', attendanceWithoutEmployee || schedulesWithoutEmployee ? 'blocked' : attendance.length ? 'ready' : 'watch', `${attendance.length} attendance row(s), ${schedules.length} schedule row(s).`, 'Repair missing employee references and run shift scenario.'),
      check('Operational HR evidence', schedules.length ? 'ready' : 'watch', `${schedules.length} schedule row(s).`, 'Add scheduling/manpower evidence for pilot operations.'),
    ],
    cutoverRule: 'HR is production-ready only when every system user is linked, scoped, role-controlled, and attendance/scheduling evidence is auditable.',
    cutoverRuleAr: 'تصبح الموارد البشرية جاهزة للإنتاج فقط عند ربط كل مستخدم، وتحديد نطاقه، وضبط دوره، وإثبات الحضور والجداول بسجل قابل للتدقيق.',
    nextAction: critical ? 'Fix role/scope/employee reference issues first.' : warning ? 'Run one full shift and attendance scenario.' : 'Proceed to attendance reporting and payroll readiness.',
  };
}

export function buildV386V390OperationalGatesSnapshot(state: any): V386V390OperationalGatesSnapshot {
  const gates = [
    buildInventoryGate(state),
    buildSalesGate(state),
    buildProductionGate(state),
    buildFinanceCloseGate(state),
    buildHrGate(state),
  ];
  const overallScore = Math.round(gates.reduce((sum, gate) => sum + gate.score, 0) / Math.max(1, gates.length));
  const blocked = gates.filter((gate) => gate.status === 'blocked').length;
  const watch = gates.filter((gate) => gate.status === 'watch').length;
  return {
    version: 'v386-v390 Operational Workflow Gates Mega Patch',
    generatedAt: new Date().toISOString(),
    overallScore,
    status: blocked ? 'blocked' : watch ? 'watch' : 'ready',
    gates,
    nextAction: blocked ? 'Resolve blocked operational gates before pilot.' : watch ? 'Complete watch-list workflow evidence before production cutover.' : 'Operational gates are locally ready for backend authority proof.',
  };
}

export function getV386V390Gate(state: any, gateId: V386V390GateId): V386V390GateSnapshot {
  const snapshot = buildV386V390OperationalGatesSnapshot(state);
  return snapshot.gates.find((gate) => gate.gateId === gateId) ?? snapshot.gates[0];
}

export function v386V390GateRowsToCsv(gate: V386V390GateSnapshot) {
  const rows = [
    ['section', 'key', 'status', 'value', 'evidence', 'action'],
    ...gate.checks.map((row) => ['check', row.check, row.status, '', row.evidence, row.nextAction]),
    ...gate.findings.map((row) => ['finding', row.area, row.severity, '', row.finding, row.action]),
    ...Object.entries(gate.counts).map(([key, value]) => ['count', key, '', String(value), '', '']),
  ];
  return rows.map((row) => row.map((value) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(',')).join('\n');
}
