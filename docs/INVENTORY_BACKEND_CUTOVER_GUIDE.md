# Inventory Backend Cutover Guide

Recommended sequence:

1. Confirm branches, stores, and items from v317.
2. Stage opening stock.
3. Validate SKU/store mapping.
4. Validate unit conversion and costing method.
5. Post opening stock movements.
6. Enable purchase receipt movements.
7. Enable sales/production consumption movements.
8. Enable stock count variance posting.

Do not allow official stock transactions until backup/restore and RLS are tested.
