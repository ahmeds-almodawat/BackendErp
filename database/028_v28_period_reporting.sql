-- V28 Period Reporting Design Notes
-- Future Supabase implementation should add persisted report views and date filters.

-- Suggested reporting views:
-- 1. posted_journal_lines_v: journal lines with journal date/status/source.
-- 2. inventory_valuation_as_of(date): stock balance/value by item/store as of date.
-- 3. branch_pnl_by_period(start_date, end_date): revenue, COGS, expenses, profit by branch.
-- 4. supplier_spend_by_period(start_date, end_date): invoices, payments, net movement by supplier.
-- 5. menu_engineering_by_period(start_date, end_date): sold qty, net sales, recipe cost, margin.

-- Reports should always respect:
-- - selected date range
-- - branch/store/cost-center scope
-- - fiscal period lock status
-- - user permissions
