export type ReportPackKey = 'today' | 'payments' | 'products' | 'categories' | 'finance' | 'inventory_cost_control';
export type ReportPackDefinition = { key: ReportPackKey; title: string; requiredKpis: string[]; exportFormats: Array<'csv' | 'xlsx' | 'pdf'>; owner: string };

export const foodicsStyleReportPacks: ReportPackDefinition[] = [
  { key: 'today', title: 'Today', requiredKpis: ['netSales', 'orders', 'avgTicket', 'hourlySales'], exportFormats: ['csv', 'xlsx', 'pdf'], owner: 'Sales' },
  { key: 'payments', title: 'Payments', requiredKpis: ['paymentsAmount', 'paymentMethodMix', 'paymentCount', 'discounts', 'voids', 'returns'], exportFormats: ['csv', 'xlsx', 'pdf'], owner: 'Cashier / Finance' },
  { key: 'products', title: 'Products', requiredKpis: ['productNetQty', 'productQuantity', 'productMargin'], exportFormats: ['csv', 'xlsx', 'pdf'], owner: 'Menu Engineering' },
  { key: 'categories', title: 'Categories', requiredKpis: ['categorySalesQty', 'foodCost', 'grossMargin'], exportFormats: ['csv', 'xlsx', 'pdf'], owner: 'Setup / Menu' },
  { key: 'finance', title: 'Finance', requiredKpis: ['financeWide', 'cash', 'vat', 'supplierExposure'], exportFormats: ['csv', 'xlsx', 'pdf'], owner: 'Finance' },
  { key: 'inventory_cost_control', title: 'Inventory / Cost Control', requiredKpis: ['inventoryValue', 'inventoryHealth', 'lowStock', 'stockByStore'], exportFormats: ['csv', 'xlsx', 'pdf'], owner: 'Inventory' },
];
