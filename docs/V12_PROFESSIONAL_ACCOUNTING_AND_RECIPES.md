# V12 — Professional Accounting + Multi-Line Recipes

This version upgrades the ERP foundation from a basic finance page into a professional accounting workspace suitable for a serious multi-branch restaurant business.

## Accounting upgrades

- Bilingual Chart of Accounts with account types and cost-center requirements.
- Manual General Ledger entry screen with debit/credit balancing validation.
- General Ledger report.
- Trial Balance.
- Financial Statements:
  - Income Statement
  - Balance Sheet
  - Cash Flow Summary
- Accounts Payable subledger by supplier.
- Accounts Receivable scaffold for corporate customers, delivery platforms, and catering.
- Banking and cash control view.
- Fixed Assets register with monthly depreciation posting.
- VAT input/output/payable report.
- Finance control center showing unbalanced journals and missing account links.
- Period and closing-control scaffold.

## Inventory costing

Inventory item standard cost can remain zero. The live cost is calculated from posted purchase invoice line prices using average purchase cost. This allows initial non-money master data to be loaded without corrupting costing.

## Recipes

Recipes are no longer one-line. Each menu item can have unlimited recipe lines. Recipe cost is calculated from the average purchase cost of each ingredient, including wastage percentage.

## Recommended test flow

1. Load professional master data from the Dashboard.
2. Create/post a purchase invoice with multiple items and real invoice prices.
3. Check Inventory — average cost should update from purchase invoices.
4. Open Setup > Recipes — recipe cost should update from average purchase prices.
5. Post a sale in Sales/POS Trial.
6. Open Finance:
   - General Ledger
   - Trial Balance
   - Financial Statements
   - AP
   - VAT
7. Create a manual GL entry from Finance > Manual Journal.
