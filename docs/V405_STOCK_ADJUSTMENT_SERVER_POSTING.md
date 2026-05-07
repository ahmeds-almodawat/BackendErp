# v405 Stock Count / Inventory Adjustment Server Posting

Date: 2026-05-06

## Goal

v405 adds the first backend-authoritative inventory variance workflow.

It posts approved stock adjustments and approved stock counts from the database side instead of letting browser state become the official ledger.

## Workflows

### Inventory Adjustment

`inventory_adjustment_requests` -> `inventory_stock_movements` -> `inventory_stock_balances` -> `posting_batches` -> `finance_journal_entries_backend` / `finance_journal_lines_backend` -> evidence event.

### Stock Count Variance

`inventory_stock_counts` + `inventory_stock_count_lines` -> variance inventory movements -> balance update -> balanced GL posting -> finance journal -> evidence event.

## Added Functions

| Function | Purpose |
|---|---|
| `inventory_post_adjustment_server(...)` | Server-side post one approved inventory adjustment. |
| `inventory_post_stock_count_server(...)` | Server-side post one approved stock count variance. |
| `inventory_post_adjustment(uuid)` | Compatibility wrapper. |
| `inventory_post_stock_count(uuid)` | Compatibility wrapper. |
| `stock_count_post_count(uuid)` | Compatibility wrapper. |

## Posting Logic

Positive adjustment or surplus:

- Debit inventory account.
- Credit inventory gain / variance account.

Negative adjustment or shortage:

- Debit inventory loss / variance account.
- Credit inventory account.

Default account map:

| Purpose | Default account |
|---|---|
| Inventory | `1200` |
| Inventory gain | `4810` |
| Inventory loss | `5810` |

## Safety

- Requires `inventory.adjust`, `inventory.post_adjustment`, or `finance.post`.
- Locks source rows with `FOR UPDATE`.
- Requires approved/validated source status.
- Blocks duplicate posting by existing posting batch lookup.
- Blocks outbound negative stock unless explicitly allowed.
- Uses one transaction, so partial posting rolls back on error.
- Records evidence in `inventory_adjustment_server_posting_events`.

## Next Patch

v406 should add VAT settlement / finance close server-side posting or complete COGS posting from POS + recipe mappings.
