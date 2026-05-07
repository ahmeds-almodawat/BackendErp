# v404 Production Batch / Recipe Consumption Server Posting

Date: 2026-05-06

## Goal

v404 adds the next backend-authoritative ERP workflow:

`Production Batch -> Raw Material Consumption -> Finished/Semi-Finished Output -> Inventory Movement/Balance -> GL Posting Batch -> Finance Journal -> Audit Evidence`.

This is the production/recipe side of the platform. It does **not** post POS COGS yet; POS COGS needs menu-item-to-recipe mapping and should be handled after production/recipe posting is stable.

## Added / Hardened Backend Objects

- `production_batch_server_posting_events`
- compatibility columns for `production_batches`
- compatibility columns for `production_batch_inputs`
- compatibility columns for `production_batch_outputs`
- compatibility columns for inventory movements/balances
- compatibility wrappers:
  - `production_post_batch(batch_id uuid)`
  - `production_post_production_batch(batch_id uuid)`
  - `live_production_post_batch(batch_id uuid, posting_options jsonb)`

## Main RPC

```sql
public.production_post_batch_server(
  p_batch_id uuid,
  p_fiscal_period_id uuid default null,
  p_posting_date date default null,
  p_account_map jsonb default '{}'
)
```

## What It Does

1. Checks `finance.post`, `inventory.adjust`, or `production.post` permission.
2. Locks the production batch row with `FOR UPDATE`.
3. Requires status `approved`, `validated`, `released`, or `completed`.
4. Requires branch/store and open fiscal period.
5. Validates raw material input lines and output lines.
6. Calculates input cost, output cost, and production variance.
7. Blocks unbalanced posting.
8. Creates official posting batch lines.
9. Creates finance journal header and lines.
10. Creates negative inventory movements for raw material consumption.
11. Creates positive inventory movements for production output.
12. Updates inventory balances.
13. Marks the production batch posted.
14. Writes server-side audit/evidence event.

## Default Account Map

| Purpose | Default account |
|---|---:|
| Raw material inventory | `1200` |
| Finished goods inventory | `1210` |
| Production variance | `5900` |

These can be overridden through `p_account_map`.

## QA

Run:

```bash
npm run qa:v404
npm run qa:all
supabase db reset
npm run build
```

## Next Recommended Workflow

v405 should implement stock count / inventory adjustment server posting.
