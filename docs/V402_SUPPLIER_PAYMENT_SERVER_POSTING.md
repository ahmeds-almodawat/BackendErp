# v402 Supplier Payment Server Posting

Date: 2026-05-06

## Goal

v402 adds the second backend-authoritative ERP workflow:

**Supplier Payment → AP Settlement → Cash/Bank Credit → GL Posting Batch → Finance Journal → Audit Evidence**

This is the natural continuation after v401 purchase invoice posting. v401 creates open supplier payable balances. v402 settles those balances through a controlled server-side payment posting RPC.

## Added Tables

| Table | Purpose |
|---|---|
| `supplier_payment_server_posting_events` | Audit/evidence events for supplier payment server posting. |
| `supplier_payment_applications` | Links a supplier payment to the AP open items it settled. |

## Added / Replaced RPCs

| RPC | Purpose |
|---|---|
| `purchasing_post_supplier_payment_server(...)` | Real server-side supplier payment posting transaction. |
| `purchasing_post_supplier_payment(payment_id uuid)` | Existing wrapper now calls the real v402 server posting logic. |
| `supplier_payment_server_posting_event(...)` | Writes server-side evidence events. |

## What The Server Does

Inside one protected database transaction, the RPC:

1. checks `finance.post` permission,
2. locks the supplier payment row using `FOR UPDATE`,
3. requires payment status `approved`,
4. validates supplier, branch, amount, account code, and fiscal period,
5. checks open AP balance unless controlled unapplied payment mode is explicitly enabled,
6. prevents duplicate posting through `posting_batches` and `posting_source_locks`,
7. creates a balanced posting batch,
8. creates finance journal entry and journal lines,
9. creates AP subledger payment transaction,
10. applies the payment to oldest open AP transactions,
11. updates open AP balances and status,
12. marks the supplier payment as posted,
13. writes audit/evidence events.

## Accounting Shape

For a supplier payment of 11,500 SAR:

| Account | Debit | Credit |
|---|---:|---:|
| Accounts Payable | 11,500 | 0 |
| Cash / Bank | 0 | 11,500 |

This reduces the supplier payable and reduces cash/bank.

## Safety Rules

- Only `approved` supplier payments can post.
- Payment amount must be greater than zero.
- Supplier and branch are required.
- Fiscal period must be open.
- Duplicate normal posting is blocked.
- Payment cannot exceed open AP balance unless `p_allow_unapplied = true`.
- Existing callers to `purchasing_post_supplier_payment(payment_id)` now use this server-side logic.

## What v402 Does Not Do Yet

v402 does not implement:

- bank statement matching,
- payment reversal,
- multi-currency FX revaluation,
- check printing,
- approval workflow UI,
- supplier statement screen redesign.

Those should come after the first posting workflows are proven stable.

## QA

Run:

```bash
npm run qa:v402
npm run qa:all
supabase db reset
```

## Next Workflow

Recommended next real server-side workflow:

`v403 POS Day Settlement Posting`
