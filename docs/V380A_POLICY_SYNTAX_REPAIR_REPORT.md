# v380a Policy Syntax Repair Report

Generated: 2026-05-06T13:02:02.937Z

Changed files: 4
Policies repaired: 17

| File | Policy | Table |
|---|---|---|
| supabase/migrations/20260506237500_v375_worker_lease_runtime.sql | worker_jobs_read_authenticated_v375 | public.worker_jobs |
| supabase/migrations/20260506237500_v375_worker_lease_runtime.sql | worker_job_runs_read_authenticated_v375 | public.worker_job_runs |
| supabase/migrations/20260506237500_v375_worker_lease_runtime.sql | worker_job_leases_read_authenticated_v375 | public.worker_job_leases |
| supabase/migrations/20260506237500_v375_worker_lease_runtime.sql | worker_job_checkpoints_read_authenticated_v375 | public.worker_job_checkpoints |
| supabase/migrations/20260506237500_v375_worker_lease_runtime.sql | worker_job_artifacts_read_authenticated_v375 | public.worker_job_artifacts |
| supabase/migrations/20260506237500_v375_worker_lease_runtime.sql | worker_dead_letters_read_authenticated_v375 | public.worker_dead_letters |
| supabase/migrations/20260506237500_v375_worker_lease_runtime.sql | worker_audit_events_read_authenticated_v375 | public.worker_audit_events |
| supabase/migrations/20260506237600_v376_inventory_rebuild_worker.sql | inventory_rebuild_runs_read_authenticated_v376 | public.inventory_rebuild_runs |
| supabase/migrations/20260506237600_v376_inventory_rebuild_worker.sql | inventory_rebuild_balances_read_authenticated_v376 | public.inventory_rebuild_balances |
| supabase/migrations/20260506237600_v376_inventory_rebuild_worker.sql | inventory_rebuild_events_read_authenticated_v376 | public.inventory_rebuild_events |
| supabase/migrations/20260506237700_v377_pos_replay_worker.sql | pos_replay_runs_read_authenticated_v377 | public.pos_replay_runs |
| supabase/migrations/20260506237700_v377_pos_replay_worker.sql | pos_replay_applied_rows_read_authenticated_v377 | public.pos_replay_applied_rows |
| supabase/migrations/20260506237700_v377_pos_replay_worker.sql | pos_replay_events_read_authenticated_v377 | public.pos_replay_events |
| supabase/migrations/20260506238000_v380_finance_reconciliation_worker.sql | finance_reconciliation_runs_read_authenticated_v380 | public.finance_reconciliation_runs |
| supabase/migrations/20260506238000_v380_finance_reconciliation_worker.sql | finance_reconciliation_checks_read_authenticated_v380 | public.finance_reconciliation_checks |
| supabase/migrations/20260506238000_v380_finance_reconciliation_worker.sql | finance_reconciliation_mismatches_read_authenticated_v380 | public.finance_reconciliation_mismatches |
| supabase/migrations/20260506238000_v380_finance_reconciliation_worker.sql | finance_reconciliation_events_read_authenticated_v380 | public.finance_reconciliation_events |

All detected `CREATE POLICY IF NOT EXISTS` statements were rewritten to PostgreSQL-compatible `DROP POLICY IF EXISTS` + `CREATE POLICY` syntax.