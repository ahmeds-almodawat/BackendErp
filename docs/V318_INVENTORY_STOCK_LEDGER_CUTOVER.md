# v318 Inventory Stock Ledger Backend Cutover

v318 starts the real inventory backend foundation.

## Scope

- Inventory stock movement ledger
- Stock balances
- Inventory adjustment requests
- Stock counts
- Stock count lines
- Lot tracking
- Validation functions
- Posting RPC foundation

## Enterprise rules

- Current stock should come from posted movements or summarized balances.
- Outbound movements should not exceed available stock unless an approved exception exists.
- Posted stock records should be reversed, not deleted.
- Opening stock must be staged and validated before production cutover.
- Weighted average costing is recommended for the production pilot.
