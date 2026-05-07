# V30 — Master Data Readiness + Foodics Mapping Center

This phase adds a professional gate before posting Foodics sales into accounting and inventory.

## Why this matters
Foodics exports can be used immediately for reporting, but full ERP posting requires master data:

- ERP branches and Foodics branch mapping
- Branch-linked stores for inventory deduction
- Menu items and Foodics SKU mapping
- Multi-line recipes
- Inventory items, stock receipts, and average costs
- Payment method to accounting account mapping

## Posting modes

1. **Report only**
   - Upload Foodics files and view reports/reconciliation.
   - No GL posting.
   - No inventory deduction.

2. **Sales accounting only**
   - Posts net sales, VAT output, and payment split.
   - Does not deduct recipes or post COGS.
   - Useful while recipes/inventory are still being prepared.

3. **Full ERP posting**
   - Posts sales, VAT, theoretical COGS, and inventory consumption.
   - Requires branches, stores, item mapping, recipes, and positive average costs.

## Important control rule
Arabic summary reports such as branch summary and payment summary are reconciliation-only. They are never posted to GL or inventory.
