# V11 — Professional Finance Foundation + VAT Mode

This upgrade moves the ERP toward a 20M SAR restaurant business standard.

## Finance upgrades
- Added Finance Controls tab.
- Added Fiscal Periods / close checklist tab.
- Added posting rule map for purchase invoices, sales/POS, production, and fixed assets.
- Added journal balance review.
- Added period-locking design note for production backend.
- Finance dashboard now separates net sales from gross collected sales.

## VAT sales mode
Menu items now support two sales VAT modes:

1. Price includes VAT
   - Gross collected = entered price
   - Net sales = gross / 1.15
   - VAT output = gross - net

2. Price excludes VAT
   - Net sales = entered price
   - VAT output = net × 15%
   - Gross collected = net + VAT

The sales posting journal always separates:
- Cash/Card/POS clearing
- Food sales excluding VAT
- VAT output
- Food cost / COGS
- Inventory reduction

## Recommended next backend table additions
- menu_items.price_includes_vat boolean default true
- sales_documents.net_sales numeric
- sales_documents.vat_amount numeric
- sales_documents.gross_sales numeric
- fiscal_periods table
- period_locks table
- posting_rules table
- journal_approvals table
