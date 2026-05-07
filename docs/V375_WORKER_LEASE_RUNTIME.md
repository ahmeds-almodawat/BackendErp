# v375 Worker Lease Runtime

Date: 2026-05-06

## Goal

v375 turns the v374 worker schema into a real backend runtime contract for queued heavy work.

It adds service-role RPCs for:

1. enqueueing idempotent jobs,
2. acquiring jobs with active leases,
3. heartbeat and checkpoint updates,
4. safe completion,
5. failure, retry, and dead-letter transition,
6. stale lease expiry,
7. artifact/evidence registration.

## Added RPCs

| RPC | Purpose | Caller |
|---|---|---|
| `worker_enqueue_job` | Create an idempotent queued job. | Edge Function / service worker |
| `worker_acquire_job` | Atomically acquire the next eligible job with `FOR UPDATE SKIP LOCKED`. | Worker |
| `worker_heartbeat` | Extend lease and persist checkpoint/progress. | Worker |
| `worker_complete_job` | Release lease, mark run/job complete, store result artifact. | Worker |
| `worker_fail_job` | Release lease and either schedule retry or dead-letter. | Worker |
| `worker_expire_stale_leases` | Mark expired leases and schedule retry/dead-letter. | Scheduled worker/admin job |
| `worker_record_artifact` | Attach validation reports, exports, snapshots, or evidence. | Worker |

## Security Posture

- RPC execution is revoked from `public` and `authenticated`.
- RPC execution is granted to `service_role` only.
- The browser should never call these RPCs directly.
- UI should request work through audited Edge Functions once v376+ workers are implemented.

## What v375 Does Not Do Yet

v375 does not implement the business processors themselves. It does not rebuild inventory, replay POS, cut over imports, generate report snapshots, reconcile finance, or run backups.

Those start in v376-v381.

## QA

Run:

```bash
npm run qa:v375
npm run qa:all
```

The QA validates that the v375 migration includes the required runtime tables, RPCs, service-role grant posture, idempotency, lease expiry, checkpointing, retry, dead-letter, and artifact handling.
