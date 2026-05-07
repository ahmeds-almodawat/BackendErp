# v374 Job Runtime Schema Report

Generated: 2026-05-06T13:13:48.901Z
Migration file: supabase\migrations\20260506374000_v374_job_runtime_schema.sql

Ready tables: 7/7
Incomplete tables: 0
Missing tables: 0

| Table | Status | RLS | Policy | Missing columns | Missing indexes | Action |
|---|---|---:|---:|---|---|---|
| worker_jobs | ready | yes | yes | - | - | Schema contract present. Use v375 to add acquire/heartbeat/release RPCs. |
| worker_job_runs | ready | yes | yes | - | - | Schema contract present. Use v375 to add acquire/heartbeat/release RPCs. |
| worker_job_leases | ready | yes | yes | - | - | Schema contract present. Use v375 to add acquire/heartbeat/release RPCs. |
| worker_job_checkpoints | ready | yes | yes | - | - | Schema contract present. Use v375 to add acquire/heartbeat/release RPCs. |
| worker_job_artifacts | ready | yes | yes | - | - | Schema contract present. Use v375 to add acquire/heartbeat/release RPCs. |
| worker_dead_letters | ready | yes | yes | - | - | Schema contract present. Use v375 to add acquire/heartbeat/release RPCs. |
| worker_audit_events | ready | yes | yes | - | - | Schema contract present. Use v375 to add acquire/heartbeat/release RPCs. |

Next action: Proceed to v375 Worker Lease Runtime: acquire, heartbeat, release, expire, retry, and dead-letter RPCs.