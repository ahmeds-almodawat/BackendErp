# v40 — Setup + Inventory Bootstrap

## Why
The opening stock upload previously rejected unknown SKUs. That is correct for strict production use, but it slows early trial testing when setup data is still being built.

## Added
- Opening stock upload can auto-create missing item SKUs as zero-cost item masters.
- Monthly stock count upload can optionally auto-create new SKUs found during count as zero-cost surplus items.
- Starter setup/inventory sample CSV files were added under `templates/v40_setup_inventory_sample`.
- Double-click starter scripts were added:
  - `START_ERP_LOCAL.bat`
  - `START_ERP_LOCAL.ps1`

## Recommended clean upload order
1. Import / Export > Branches
2. Import / Export > Stores
3. Import / Export > Items
4. Import / Export > Cost Centers
5. Inventory > Opening Stock Upload
6. Inventory > Monthly Stock Count

## Control note
Auto-create is for starter/local trial only. In production, new item creation should require approval.
