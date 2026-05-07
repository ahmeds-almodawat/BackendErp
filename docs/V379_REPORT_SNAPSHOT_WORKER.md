# v379 Report Snapshot Worker

Date: 2026-05-06

## Goal

v379 moves heavy reporting/dashboard refreshes into the worker runtime so management screens can read durable snapshots instead of recomputing large datasets in the browser.

This patch is intentionally snapshot-first. It does **not** claim every financial report is final accounting truth yet. It builds the safe worker lane that later report builders can use.

## Added Tables

| Table | Purpose |
|---|---|
| `report_snapshot_runs` | One durable snapshot generation run per report/job with scope, freshness, status, row counts, findings, and payload. |
| `report_snapshot_sources` | Source table evidence for each snapshot, including row counts and freshness time. |
| `report_snapshot_artifacts` | Generated snapshot payloads, JSON evidence, and future export links. |
| `report_snapshot_events` | Event timeline for started/completed/failed/warning report snapshot work. |

## Added RPCs

| RPC | Purpose |
|---|---|
| `worker_report_snapshot_source_counts` | Detect available report source tables and count rows. |
| `worker_enqueue_report_snapshot` | Enqueue an idempotent `report.snapshot` worker job. |
| `worker_acquire_report_snapshot_job` | Acquire only report snapshot jobs with a lease. |
| `worker_run_report_snapshot_batch` | Generate one snapshot payload, write sources/artifacts/checkpoint, and complete or retry/dead-letter. |
| `worker_report_snapshot_event` | Write report snapshot event evidence. |

## Source Tables Checked

The snapshot worker checks for available sources such as:

- `finance_journal_lines_backend`
- `finance_journal_entries_backend`
- `posting_batches`
- `inventory_stock_balances`
- `inventory_rebuild_balances`
- `pos_replay_applied_rows`
- `import_cutover_applied_rows`
- `sales_pos_batches`
- `purchase_invoices`
- `supplier_payments`
- `worker_jobs`

If no source tables are available, the worker completes safely with a warning artifact instead of pretending a trusted report was generated.

## Security Posture

- Snapshot runtime tables have RLS enabled.
- Authenticated users can read snapshot evidence.
- Direct writes are not granted to authenticated users.
- Worker RPCs are revoked from `public` and `authenticated`.
- Worker RPCs are granted to `service_role` only.

## What v379 Does Not Do Yet

v379 does not finalize trial balance, P&L, VAT, AP aging, inventory valuation, COGS, or branch P&L formulas.

It creates the durable worker lane and source/freshness/artifact evidence needed before those reports can become production-trusted.

## QA

Run:

```bash
npm run qa:v379
npm run qa:all
```

## Next Patch

v380 should add finance reconciliation worker foundations:

1. enqueue reconciliation jobs,
2. compare trial-balance style debit/credit balance where source tables exist,
3. emit mismatch reports,
4. store reconciliation artifacts,
5. checkpoint and dead-letter safely.
