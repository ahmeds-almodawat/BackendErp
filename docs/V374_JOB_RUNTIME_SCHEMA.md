# v374 Job Runtime Schema

Date: 2026-05-06

## Goal

v374 creates the real backend schema required before the app can move from local worker contracts into real backend worker execution.

This patch is intentionally schema-first. It does **not** implement acquire, heartbeat, release, retry, or dead-letter RPCs yet. Those belong in v375.

## Added Runtime Tables

| Table | Purpose |
|---|---|
| `worker_jobs` | Canonical queued job with payload, idempotency key, lane, priority, status, retry policy, branch/store scope, and lifecycle timestamps. |
| `worker_job_runs` | Execution attempt records with attempt number, worker identity, lease token, heartbeat, progress, and error state. |
| `worker_job_leases` | Lease records for safe worker coordination and future lease expiry/release behavior. |
| `worker_job_checkpoints` | Resumable checkpoint/cursor data for large imports, POS replay, inventory rebuild, report snapshots, and reconciliation runs. |
| `worker_job_artifacts` | Job evidence and exports, such as validation reports, snapshots, CSV/JSON evidence, backup manifests, and failure bundles. |
| `worker_dead_letters` | Retry-exhausted jobs requiring review, retry planning, or resolution. |
| `worker_audit_events` | Append-style worker lifecycle evidence for enqueue, acquire, heartbeat, checkpoint, complete, fail, retry, dead-letter, and artifact events. |

## Security Posture

- RLS is enabled for every v374 runtime table.
- Authenticated users receive read-only visibility for staging/ops review.
- Direct authenticated writes are intentionally not granted.
- v375+ should write through service-role workers or tightly permission-checked RPCs.
- v383 should harden this further with production RBAC and branch/module permission scope.

## Why This Matters

v371 defined worker contracts.
v370 simulated resumable queue runs locally.
v374 adds the database tables needed to make those contracts real.

Without v374, heavy tasks like inventory rebuild, POS replay, import cutover, report snapshot generation, reconciliation, and backup/archive work have no durable backend runtime.

## QA

Run:

```bash
npm run qa:v374
npm run qa:all
```

The v374 QA generates:

- `docs/V374_JOB_RUNTIME_SCHEMA_REPORT.md`
- `docs/V374_JOB_RUNTIME_SCHEMA_REGISTRY.json`
- `docs/V374_JOB_RUNTIME_SCHEMA_QA.md`

## Next Patch

v375 should implement:

1. enqueue job RPC
2. acquire lease RPC
3. heartbeat RPC
4. release/complete RPC
5. expire stale leases
6. retry and dead-letter transition
7. service-role worker safety contract
