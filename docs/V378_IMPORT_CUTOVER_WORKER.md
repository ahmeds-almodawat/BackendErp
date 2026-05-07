# v378 Import Cutover Worker

Date: 2026-05-06

## Goal

v378 adds the resumable backend worker foundation for large CSV/Excel import cutover jobs.

It is intentionally validation/cutover-evidence first. It does not post finance, COGS, VAT, inventory, or supplier ledger effects yet.

## Added Tables

| Table | Purpose |
|---|---|
| `import_cutover_runs` | Tracks a worker import cutover run, source table, target table, cursor, row counts, and validation summary. |
| `import_cutover_applied_rows` | Idempotent row-level evidence to prevent duplicate cutover effects. |
| `import_cutover_events` | Audit/evidence stream for enqueue, source detection, batch completion, warnings, and errors. |

## Added RPCs

| RPC | Purpose |
|---|---|
| `worker_import_cutover_source_table` | Detects the best available import staging source table. |
| `worker_enqueue_import_cutover` | Enqueues an `import.cutover` worker job with idempotency. |
| `worker_acquire_import_cutover_job` | Acquires only import cutover worker jobs. |
| `worker_run_import_cutover_batch` | Processes a resumable validation/cutover batch and writes checkpoints/artifacts. |

## Source Table Detection

The worker looks for staging tables in this order:

1. `import_staging_rows`
2. `setup_import_staging_rows`
3. `master_data_import_rows`
4. `foodics_staging_rows`
5. `pos_staging_rows`
6. `sales_pos_staging_rows`

If no source table exists, the worker completes with a warning artifact instead of pretending a cutover happened.

## Safety

- RPCs are service-role only.
- Rows are tracked with source IDs and row hashes.
- Duplicate row application is blocked by unique indexes.
- Every batch writes checkpoint/artifact evidence.
- Final business posting remains blocked until module-specific posting authority exists.

## QA

Run:

```bash
npm run qa:v378
npm run qa:all
```

## Next Patch

v379 should add report snapshot worker execution so heavy dashboards/reports use generated backend snapshots instead of blocking the UI.
