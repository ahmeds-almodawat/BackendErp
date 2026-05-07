# v306 Smart Analysis — Report Comparison KPI Packs

This patch extends v305 by turning Smart Analysis into a Foodics-style KPI studio while keeping the main ERP sidebar clean.

## What changed

- Added an internal Smart Analysis side rail similar to the reference report sidebar:
  - Comparison: Today, Yesterday, This Week, Last Week, This Month, Last Month, This Year, Custom Period, Custom Period Products.
  - Hourly: Hourly Metrics, Hourly Sales Analysis, Hourly Menu Analysis, Hourly Option Analysis.
  - Platform Wide: Finance Comparison, Inventory Comparison, Purchasing / AP, Production & Recipes.
- Added comparison tiles for current period vs comparable previous period:
  - Net Sales
  - Orders
  - Net Sales / Order
  - Food Cost %
  - Cash Movement
  - Inventory Value
  - AP Exposure
  - Low Stock SKUs
- Added Foodics-inspired KPI packs to the available KPI list:
  - Payments Amount
  - Payment Method Mix
  - Payments Count
  - Discount Amount
  - Void / Adjustment Amount
  - Return Amount
  - Net Sales & Qty by Product
  - Product Quantity
  - Returns by Product
  - Voids by Product
  - Profit / Cost by Product
  - Category Sales & Quantity
  - Hourly Sales
  - Hourly Orders
- Added platform-wide analysis KPIs:
  - Platform Finance Mix
  - Inventory Health
  - Low Stock SKUs
  - Stock by Store
  - AP Payments
- Added report pack button: "Use this report pack" automatically selects the right KPI set for the internal side-rail page.
- Added export for comparison tiles as CSV.

## Notes

- POS discount, POS void, and POS return KPIs are included as report-ready cards. Current ERP-native sales documents do not yet have POS discount/void/return line fields, so the cards map to available ERP controls now and are ready for full live values when the Foodics import layer provides those columns.
- Hourly charts use actual timestamps when available. If the local demo sales only have dates, the chart distributes demo rows safely by hour so the page remains visual rather than blank.
- Main sidebar remains clean: no extra global menu items were added.

## Test

1. Run `npm install`.
2. Run `npm run build`.
3. Open Smart Analysis.
4. Try Today, Last Week, Custom Period Products, Hourly Metrics, Finance Comparison, and Inventory Comparison.
5. Use the color pickers and graph shape selector to confirm each KPI card reacts visually.
