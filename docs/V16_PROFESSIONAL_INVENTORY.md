# V16 Professional Inventory Upgrade

## What changed

The Inventory module was redesigned from one long basic page into a professional tabbed inventory command center.

### New tabs

1. Command Center
   - Inventory cycle control map
   - Inventory health/control score
   - Exception cards
   - Top inventory value by item
   - Missing-live-features checklist

2. Balances by Store
   - Search by SKU, item, category, or store
   - Store filter
   - On-hand quantity
   - reorder/min/max controls
   - average cost
   - stock value
   - status badges: OK, low, over max, negative, needs costing
   - export CSV

3. Item Cost Cards
   - qty on hand
   - total in/out
   - average cost
   - last purchase cost
   - stock value

4. Transfers
   - source store
   - destination store
   - available-source validation
   - transfer value preview
   - posted transfer register

5. Adjustments & Counts
   - inventory issue / wastage / correction
   - cycle count variance posting
   - GL posting to Inventory Variance / Wastage
   - cost center is applied on usage/variance, not on stock purchase

6. Reconciliation
   - stock subledger vs GL inventory
   - zero-cost item exceptions
   - negative-stock exceptions
   - low-stock details

7. Stock Ledger
   - full movement audit ledger
   - export CSV

## Still missing for true live inventory

- Barcode scanning
- bin/shelf location control
- batch/lot and expiry tracking per receipt line
- supplier returns
- damaged goods quarantine
- approvals for inventory adjustments and stock count variances
- real Supabase persistence and RLS
