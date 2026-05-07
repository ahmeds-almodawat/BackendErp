# v366 Enterprise Loose-End Scan

Generated: 2026-05-07T21:42:32.938Z

Critical: 1
Warnings: 3

| Severity | Area | Finding | Action |
|---|---|---|---|
| critical | Supabase migrations | supabase/migrations/20260502180000_v180_production_wiring.sql still declares a master-data FK as uuid | Use text for current branches/stores/items/suppliers IDs or complete a full UUID baseline migration. |
| warning | Edge Functions | 18 functions still contain skeleton/dry-run markers: supabase/functions/approval-workflow/index.ts, supabase/functions/attachment-signer/index.ts, supabase/functions/attachment-vault/index.ts, supabase/functions/attachment-vault-v200/index.ts, supabase/functions/auth-bootstrap/index.ts, supabase/functions/backup-export/index.ts, supabase/functions/finance-posting/index.ts, supabase/functions/foodics-post/index.ts, supabase/functions/foodics-staging/index.ts, supabase/functions/inventory-posting/index.ts, supabase/functions/master-data-sync/index.ts, supabase/functions/posting-orchestrator/index.ts... | Do not treat those functions as production posting authority until implemented and tested. |
| warning | RLS | 106 RLS-enabled tables have no direct static policy detected: ap_subledger_transactions, app_error_logs, app_role_permissions, approval_actions, appshell_refactor_tasks, ar_subledger_transactions, auth_session_events, backend_connection_events, backend_cutover_checks, backend_gate_check_findings, backend_gate_check_runs, backend_gate_checks, backup_runs, bank_accounts, bank_reconciliation_runs, bank_statement_lines, close_snapshots, customers, cutover_rehearsal_runs, cutover_rehearsal_steps... | Confirm dynamic v366 guard policies cover these tables, or add explicit module policies. |
| warning | RPC security | 25 authenticated security-definer grants need permission review: public.finance_validate_posting_batch, public.reporting_create_truth_snapshot, public.purchasing_post_purchase_invoice_server, public.purchasing_post_purchase_invoice, public.purchasing_post_supplier_payment_server, public.purchasing_post_supplier_payment, public.pos_day_payment_account, public.sales_post_pos_day_server, public.sales_post_pos_batch, public.live_sales_post_pos_batch, public.production_post_batch_server, public.production_post_batch | Require app_assert_permission(...) or scoped checks inside every sensitive RPC. |

