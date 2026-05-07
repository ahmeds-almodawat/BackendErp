# V39 — Inventory Opening Balance + Monthly Stock Count Upload

## Purpose
This version adds the inventory controls that are required before testing Full ERP Posting:

1. Opening stock upload for migration/startup balances.
2. Monthly stock count upload for physical count control.
3. Automatic shortage/surplus calculation by store and item.
4. Variance approval workflow before inventory and GL posting.

## New Inventory Tabs

### Opening Stock Upload
Use this once when starting from an old POS/manual inventory. The upload creates stock movements and inventory lots when lot/bin/expiry are provided.

Supported CSV columns:
- store_code
- item_sku
- qty
- unit_cost
- date
- lot_no
- bin_code
- expiry_date

If unit cost is positive, the system creates a balanced opening inventory journal:

Dr Raw Inventory / Semi-finished Inventory  
Cr Opening inventory equity / conversion balance

### Monthly Stock Count
Use this every month. The upload compares physical counted quantity to system quantity.

Supported CSV columns:
- count_batch_ref
- store_code
- item_sku
- counted_qty
- cost_center_code
- note

The system creates pending approval requests for variances:

Shortage: Dr Inventory Variance / Cr Inventory  
Surplus: Dr Inventory / Cr Inventory Variance

## Professional Control Policy
Stock counts do not post directly. They generate approval requests first. After approval, the existing Approval Queue posts the stock movement and accounting entry.
