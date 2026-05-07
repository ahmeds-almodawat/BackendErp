# V17 — Live Inventory Controls Upgrade

This release upgrades Inventory from a basic stock page into a live control workspace suitable for a multi-branch restaurant group.

## Added
- Bin / shelf master per store.
- Purchase invoice receiving now supports lot number, batch number, bin code, and expiry date per invoice line.
- Lot and expiry register.
- Quality hold / quarantine workflow.
- Supplier return / debit note workflow.
- Inventory adjustment requests and cycle count variance requests now go to an approval queue before posting.
- Approval queue posts the stock movement and the GL journal only after approval.
- Stock ledger includes lot, bin, expiry, supplier, and audit references.
- Control KPIs for quarantine lots, expiring lots, pending approvals, zero-cost stock, negative stock, and GL reconciliation.

## Accounting logic
- Purchase invoice: Dr Inventory / Dr VAT Input / Cr AP or cash/bank.
- Adjustment or count shortage: Dr Inventory Variance / Cr Inventory with cost center on the variance.
- Supplier return: Dr AP / Cr Inventory.
- Transfer: no P&L impact; stock moves between stores.

## What remains for production deployment
- Real barcode scanner integration.
- Supabase persistence and RLS.
- Device-level cashier/store permissions.
- Automated FEFO allocation by lot during sales and production.
- Full supplier debit note approval chain.
