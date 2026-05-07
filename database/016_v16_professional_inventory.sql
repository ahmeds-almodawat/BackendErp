-- V16 Professional Inventory direction
-- Adds the design target for a production-grade inventory module.

-- Recommended future tables:
-- inventory_bins(id, store_id, code, name, active)
-- inventory_batches(id, item_id, batch_no, expiry_date, received_date, supplier_id)
-- stock_count_headers(id, count_no, store_id, status, counted_by, approved_by, posted_at)
-- stock_count_lines(id, count_id, item_id, system_qty, counted_qty, variance_qty, unit_cost)
-- inventory_adjustments(id, adjustment_no, store_id, reason, status, cost_center_id, created_by, approved_by, posted_at)
-- inventory_adjustment_lines(id, adjustment_id, item_id, direction, qty, unit_cost)
-- supplier_returns(id, return_no, supplier_id, store_id, status, posted_at)
-- supplier_return_lines(id, return_id, item_id, qty, unit_cost, reason)

-- New account recommended in COA:
-- 6700 Inventory Variance / Wastage / فروقات وهالك المخزون
