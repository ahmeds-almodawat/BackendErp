-- V39 backend design placeholder
-- Opening stock and stock count should become persisted documents in Supabase.

-- Suggested future tables:
-- inventory_opening_batches(id, ref, date, status, created_by, posted_at)
-- inventory_opening_lines(id, batch_id, store_id, item_id, qty, unit_cost, lot_no, bin_code, expiry_date)
-- stock_count_batches(id, ref, count_date, status, store_id, created_by, approved_by, posted_at)
-- stock_count_lines(id, batch_id, store_id, item_id, system_qty, counted_qty, variance_qty, unit_cost, cost_center_id, status)

-- Posting rule:
-- Opening stock: Dr inventory / Cr opening conversion equity.
-- Stock shortage: Dr inventory variance / Cr inventory.
-- Stock surplus: Dr inventory / Cr inventory variance.
