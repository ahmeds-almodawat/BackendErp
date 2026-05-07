# v15 — Cost Center Usage Policy + Fast Trial Scenario

## Key correction

Inventory purchases should not force a cost center at invoice header level.

Example: buying 10 KG tomato is a stock asset. It may later be transferred to another branch or consumed in a recipe. If the purchase invoice is assigned to a kitchen cost center immediately, branch profitability becomes wrong.

## Correct ERP treatment

### Purchase stock
- Debit Inventory
- Debit VAT Input
- Credit AP / Cash / Bank
- Branch and receiving store are recorded.
- Cost center remains Company / blank.

### Use/consume stock
- Sale recipe consumption, wastage, expense issue, and similar usage events assign cost center.
- Debit Food Cost / Expense with the branch/kitchen cost center.
- Credit Inventory with no cost center.

## New dummy data option

Dashboard now has two loaders:

1. **Load master data only**
   - Branches, stores, suppliers, items, menu items, recipes, cost centers, chart of accounts.
   - Inventory item standard costs remain zero.

2. **Load fast trial scenario**
   - Master data.
   - Posted purchase invoice with multiple items.
   - Transfer from main stockroom to Restaurant 1 kitchen.
   - Pizza dough production batch.
   - Pizza sale with recipe deduction.
   - Finance journals and AP/VAT/stock movements.

Use the fast scenario to test the end-to-end flow quickly without manually entering every document.
