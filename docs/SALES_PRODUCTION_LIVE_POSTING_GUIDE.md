# Sales and Production Live Posting Guide

Recommended sequence:

1. Confirm backend gate passed.
2. Confirm master data, inventory, and purchasing gates passed.
3. Import POS batch.
4. Validate sales/payment difference.
5. Post POS batch without COGS first.
6. Cut over recipes.
7. Post production batch.
8. Enable COGS after inventory/recipe truth is validated.
9. Reconcile sales, VAT, payments, COGS, and inventory before go-live.

Never delete posted sales or production records. Use reversal/correction flows.
