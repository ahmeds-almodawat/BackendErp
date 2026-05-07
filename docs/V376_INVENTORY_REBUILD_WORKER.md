# v376 Inventory Rebuild Worker

Date: 2026-05-06

## Goal

v376 adds the first business worker on top of the v375 lease runtime: a resumable, auditable inventory rebuild worker.

This patch intentionally focuses on inventory balance rebuilds only. It does not yet implement POS replay, import cutover, report snapshots, finance reconciliation, or backup/archive workers.

## Added Backend Objects

| Object | Purpose |
|---|---|
| `inventory_rebuild_runs` | Tracks each inventory rebuild job, scope, cutoff, checkpoint, status, source table, and summary. |
| `inventory_rebuild_balances` | Stores rebuilt balances by branch/store/item/lot for the rebuild run. |
| `inventory_rebuild_events` | Stores rebuild lifecycle evidence. |
| `worker_enqueue_inventory_rebuild(...)` | Enqueues an idempotent `inventory.rebuild` job through the v375 runtime. |
| `worker_acquire_inventory_rebuild_job(...)` | Acquires only `inventory.rebuild` jobs and creates lease/run records. |
| `worker_run_inventory_rebuild_batch(...)` | Runs the rebuild, writes balances, checkpoints, artifacts, audit events, and completes/fails the worker job. |
| `worker_inventory_rebuild_source_table()` | Finds the available inventory movement source table. |

## Source Table Compatibility

The worker looks for movement data in this order:

1. `public.inventory_stock_movements`
2. `public.stock_movements`
3. `public.inventory_movements`
4. `public.local_inventory_movements`

If no movement source table exists, the worker completes safely with a warning artifact instead of pretending balances were rebuilt.

## Runtime Flow

```text
enqueue inventory.rebuild
  -> acquire inventory.rebuild lease
  -> detect movement source table
  -> rebuild scoped balances
  -> write checkpoint
  -> write artifact/evidence
  -> complete job
```

On failure, the worker marks the run failed, releases the lease, schedules retry or dead-letters the job when attempts are exhausted.

## Security Posture

- RPC execution is revoked from `public`.
- RPC execution is granted to `service_role`.
- Browser/UI should not call the worker RPCs directly.
- Later UI should enqueue work through audited Edge Functions once v382 backend mode is ready.

## QA

Run:

```bash
npm run qa:v376
npm run qa:all
```

The QA validates table names, source-table detection, idempotent enqueue, acquire-only inventory job logic, checkpoints, artifacts, retry/dead-letter handling, service-role grants, and package wiring.

## Next Patch

v377 should implement the POS Replay Worker for Foodics/POS imports with duplicate prevention and resumable replay.
