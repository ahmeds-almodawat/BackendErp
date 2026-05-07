-- v38 Starter-Friendly Recipe Control
-- Design note for future backend implementation.

-- Recommended backend policy:
-- 1. report_only batches may be registered without recipes.
-- 2. sales_accounting_only batches may be posted without recipes.
-- 3. full_erp batches must have mapped menu items, active recipes, deduction stores,
--    positive cost foundation, and stock availability checks.

-- Suggested future column:
-- alter table foodics_import_batches
--   add column posting_mode text check (posting_mode in ('report','sales','full'));

-- Suggested future constraint/check in posting function:
-- if posting_mode = 'full' then validate recipe readiness before inventory/COGS posting.
