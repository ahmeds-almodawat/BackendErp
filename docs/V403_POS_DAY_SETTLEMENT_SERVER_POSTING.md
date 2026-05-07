# v403 POS Day Settlement Server Posting

Date: 2026-05-06

## Goal

v403 adds the third backend-authoritative posting workflow.

```text
POS Day Batch
→ payment settlement
→ sales revenue
→ VAT output
→ GL posting batch
→ finance journal
→ audit/evidence event
```

This patch is additive and idempotent. It does not depend on browser/local state.

## Added Evidence Table

| Table | Purpose |
|---|---|
| `pos_day_server_posting_events` | Audit/evidence trail for server-side POS day posting success/failure. |

## Added / Replaced RPCs

| RPC | Purpose |
|---|---|
| `pos_day_payment_account(...)` | Maps payment methods to cash/card/bank/aggregator accounts. |
| `sales_post_pos_day_server(...)` | Real server-side POS day settlement posting engine. |
| `sales_post_pos_batch(batch_id uuid)` | Wrapper now routes old callers into the real v403 server posting. |
| `live_sales_post_pos_batch(batch_id uuid, posting_options jsonb)` | Wrapper now routes live/Foodics POS batches into the real v403 server posting. |

## What The Backend Does

Inside one protected database transaction, the backend:

1. checks permission,
2. locks the POS batch row `FOR UPDATE`,
3. requires approved/validated/reconciled status,
4. checks branch, posting date, and open fiscal period,
5. reconciles payments to revenue + VAT,
6. blocks duplicate posting,
7. creates a posting batch,
8. creates debit settlement lines by payment method,
9. creates credit sales revenue and VAT output lines,
10. creates finance journal header and lines,
11. creates VAT output transaction,
12. marks the POS batch as posted,
13. writes audit/evidence.

## What v403 Does Not Do Yet

v403 does **not** post COGS or recipe inventory deduction. Those require recipe/menu mapping and should be handled by the production/COGS server workflow.

## QA

Run:

```bash
npm run qa:v403
npm run qa:all
supabase db reset
npm run build
```

## Next Patch

v404 should add production batch / recipe consumption server-side posting.
