# v14 Enterprise Operations Upgrade

## Focus
This phase continues the enterprise pattern by making operations more connected to accounting and inventory valuation.

## Production / Prep Kitchen
- Production recipe master.
- Multi-line production recipe ingredients.
- Recipe-based batch creation.
- Planned vs actual output control.
- Yield percentage calculation.
- Expiry date logic from default expiry days.
- Stock availability validation before posting.
- Production batch register.
- Production costing and semi-finished inventory report.

## Accounting impact
Production does not post food cost. It transfers value inside inventory:

Debit: Semi-Finished Inventory
Credit: Raw Material Inventory

Food cost remains recognized later when the final menu item is sold.

## Inventory control
- Stock value vs GL inventory reconciliation.
- Low-stock alerts.
- Zero-cost inventory alert.
- Item cost card.
- Stock movement audit ledger.

## Remaining recommended phases
1. Full POS cashier order flow with shift close, kitchen routing, and receipt preview.
2. Three-way match: PO / GRN / supplier invoice.
3. HR schedule compliance linked to POS shift open/close and punch in/out.
4. Supabase persistence and RLS after local workflow stabilizes.
