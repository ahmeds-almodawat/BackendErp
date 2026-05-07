# v34 — Validation Drill-Down Issue Center

This version upgrades the Foodics validation cockpit so every validation warning can open an actionable issue screen.

## Added

- New **Issue Center** tab in Sales / POS Trial.
- **Open issue** button beside every validation line.
- Drill-down tables for:
  - duplicate orders
  - lines without order header
  - payments without order header
  - orders without payment
  - unmapped Foodics branches
  - unmapped POS items/SKUs
  - missing recipes
  - mapped branches without stores
  - zero-cost recipe demand
  - stock shortages
  - order/payment reconciliation difference
  - existing active batch reference
- Inline fixing for:
  - Foodics branch mapping
  - POS SKU to ERP menu item mapping
- Export of issue rows as CSV.

## Professional behavior

The cockpit no longer only tells the user that there are issues. It routes the user directly to the exact affected rows/items so the issue can be fixed faster.

## Notes

Some setup corrections still happen in master data pages, such as creating a branch store or posting purchase invoice costs. The Issue Center explains where to correct those records.
