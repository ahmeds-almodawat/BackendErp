# v377 POS Replay Worker

Date: 2026-05-06

## Goal

v377 adds the first POS/Foodics-safe replay worker on top of the v375 worker lease runtime.

The worker is intentionally conservative. It does not pretend to be a full POS posting engine yet. It creates a resumable, idempotent replay lane that can scan available POS/Foodics staging rows, checkpoint progress, block duplicate effects, and write evidence/artifacts.

## Added Tables

| Table | Purpose |
|---|---|
| `pos_replay_runs` | One runtime record per POS replay job/run with source table, date/branch scope, counters, warning, and lifecycle status. |
| `pos_replay_applied_rows` | Idempotency ledger for replayed source rows. Unique keys prevent duplicate effects during replay/resume. |
| `pos_replay_events` | Append-style evidence for enqueue, acquire, batch, warning, completion, and failure events. |

## Added RPCs

| RPC | Purpose |
|---|---|
| `worker_pos_replay_source_table` | Detect the best available POS/Foodics source table. |
| `worker_enqueue_pos_replay` | Queue a `pos.replay` job with branch/date/batch/dry-run payload. |
| `worker_acquire_pos_replay_job` | Acquire only POS replay jobs and create a lease/run record. |
| `worker_run_pos_replay_batch` | Process one resumable batch, update checkpoint, block duplicates, and complete when finished. |

## Source Table Detection Order

1. `pos_staging_rows`
2. `foodics_staging_rows`
3. `sales_pos_staging_rows`
4. `foodics_orders`
5. `pos_sales_rows`
6. `sales_pos_batches`

If none exists, the worker completes safely with a warning artifact instead of pretending a replay occurred.

## Safety Rules

- RPC execution is revoked from `public` and `authenticated`.
- RPC execution is granted to `service_role` only.
- Replay rows are recorded in `pos_replay_applied_rows` with unique source keys and replay hashes.
- Re-running the same job or replaying after checkpoint resume skips previously applied rows.
- `dryRun=true` is supported and is the default.

## What v377 Does Not Do Yet

v377 does not yet perform final finance posting, VAT posting, COGS posting, payment settlement, or inventory deduction. Those should be connected in later Sales/POS and Finance completion patches once the posting authority is ready.

## QA

Run:

```bash
npm run qa:v377
npm run qa:all
```

## Next Patch

v378 should add resumable import cutover workers for large CSV/Excel imports with validation artifacts and correction reports.
