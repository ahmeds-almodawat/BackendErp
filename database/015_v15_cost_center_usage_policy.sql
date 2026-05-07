-- v15 Cost-center correction for inventory purchases
-- Principle: stock purchases create inventory assets and supplier/cash obligations.
-- Cost centers are assigned when inventory is consumed, wasted, sold, issued to expense, or payroll/opex is incurred.

-- In production Supabase schema, do NOT require cost_center_id on inventory purchase invoice headers/lines.
-- Keep branch_id and receiving_store_id for stock ownership and location.
-- Optional line-level cost center should be used only for non-stock expense invoice lines.

-- Suggested future columns when expense purchase lines are added:
-- purchase_invoice_lines.line_type check in ('inventory_item','expense','fixed_asset')
-- purchase_invoice_lines.cost_center_id nullable; required only when line_type in ('expense') or account requires cost center.

-- Accounting posting rule:
-- inventory_item line:
--   Dr Inventory (branch/store dimension, cost_center_id = NULL/company)
--   Dr VAT Input
--   Cr Accounts Payable / Bank
-- expense line:
--   Dr Expense Account (cost_center_id required)
--   Dr VAT Input
--   Cr Accounts Payable / Bank
-- sales consumption:
--   Dr Food Cost / COGS (branch_id + cost_center_id from branch/kitchen)
--   Cr Inventory (branch/store dimension, no cost center)
