# V29 — Foodics Sales Import Engine

This version adds a Foodics-style sales import command center for the local ERP prototype.

## Added capabilities

- Multi-file Foodics CSV upload.
- Auto-detection of Foodics file types:
  - order headers
  - order item lines
  - payment lines
  - Arabic branch sales summary
  - Arabic payment summary
- Branch mapping from Foodics branch/reference to ERP branch.
- POS SKU/item mapping from Foodics item lines to ERP menu items and recipes.
- Payment method mapping to ERP debit accounts such as cash, bank/card, AR/delivery/internal settlement, and hospitality expense.
- Validation cockpit:
  - duplicate order references
  - line rows without order headers
  - payment rows without order headers
  - orders without payment rows
  - unmapped branches
  - unmapped POS SKUs
  - missing recipes
  - stock shortages
  - order vs payment reconciliation difference
- Posting cockpit:
  - aggregate Foodics sales by branch/menu/date
  - deduct ERP recipes from linked branch stores
  - generate stock movements
  - generate branch-level accounting journals
  - separate net sales, VAT output, payment clearing, and theoretical food cost
- Reconciliation cockpit:
  - order gross vs payments
  - void/return counts
  - payment methods and account mapping
- Foodics-style reports:
  - sales by branch
  - top POS items
  - export CSV

## Important accounting behavior

Foodics item cost is not trusted as the ERP cost source. The ERP calculates theoretical food cost from ERP recipes and inventory average purchase cost.

Posting design:

- Debit Cash / Bank / AR / Hospitality Expense according to payment method mapping.
- Credit Food Sales.
- Credit VAT Output.
- Debit Food Cost / COGS based on recipes.
- Credit Inventory.
- Any order/payment difference is sent to POS Clearing for investigation.

## Recommended test flow

1. Load professional master data / fast trial scenario.
2. Open Sales / POS Trial.
3. Upload Foodics order header, item lines, and payment CSV files.
4. Open Mappings and map branches, POS SKUs, and payment methods.
5. Open Validation and fix blockers.
6. Open Posting and post the Foodics batch.
7. Check Finance → Journal Register / General Ledger.
8. Check Inventory → Stock Ledger.
9. Check Reports with period filters.

## Remaining production gaps

- True XLSX import should be handled in backend or a dedicated parser.
- Mapping profiles should persist to Supabase in production.
- Duplicate detection should use database-level unique constraints.
- Sales reversal should create controlled reverse journals and reverse stock movements.
- Delivery app settlements should get dedicated receivable subledgers.
- Cashier shift reconciliation should link payment rows to shift close reports.
