# v380 Finance Reconciliation Worker

Date: 2026-05-06

## Goal

v380 adds a finance reconciliation worker on top of the v375 lease runtime.

This patch records reconciliation evidence and mismatch findings. It does **not** post, reverse, modify, or close accounting records.

## Added Tables

| Table | Purpose |
|---|---|
| `finance_reconciliation_runs` | Worker run header with scope, period, branch, source counts, totals, and evidence. |
| `finance_reconciliation_checks` | Individual reconciliation checks such as debit/credit equality. |
| `finance_reconciliation_mismatches` | Unresolved mismatch evidence requiring review. |
| `finance_reconciliation_events` | Worker lifecycle and evidence events. |

## Added RPCs

| RPC | Purpose |
|---|---|
| `worker_finance_reconciliation_source_counts` | Count available finance/reconciliation source tables. |
| `worker_enqueue_finance_reconciliation` | Enqueue an idempotent `finance.reconciliation` job. |
| `worker_acquire_finance_reconciliation_job` | Acquire only finance reconciliation work. |
| `worker_run_finance_reconciliation_batch` | Run evidence checks, write artifacts, and complete/fail the job. |
| `worker_finance_reconciliation_event` | Record finance reconciliation worker evidence. |

## What It Checks First

The first reconciliation check is trial-balance style debit/credit equality from `finance_journal_lines_backend` when that table exists.

If no source table exists, the worker completes with a warning artifact rather than pretending reconciliation was fully proven.

## Security Posture

- Worker RPCs are revoked from `public` and `authenticated`.
- Worker RPCs are granted to `service_role` only.
- Authenticated users get read-only visibility through RLS policies for operational review.

## QA

Run:

```bash
npm run qa:v380
npm run qa:all
```

## Next Patch

v381 should add backup/archive worker evidence and restore proof foundations.
