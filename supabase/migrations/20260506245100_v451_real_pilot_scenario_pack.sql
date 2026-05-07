-- v451 Real Pilot Scenario Pack
-- Adds pilot scenario evidence tables and helper RPCs for one-month pilot validation.

create extension if not exists pgcrypto;

create table if not exists public.pilot_scenario_seed_sets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  entity_counts jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','ready','executing','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pilot_scenario_steps (
  id uuid primary key default gen_random_uuid(),
  seed_set_id uuid references public.pilot_scenario_seed_sets(id) on delete cascade,
  step_key text not null,
  sequence integer not null,
  module text not null,
  title text not null,
  actor text,
  expected_backend_proof jsonb not null default '[]'::jsonb,
  expected_reports jsonb not null default '[]'::jsonb,
  pass_criteria jsonb not null default '[]'::jsonb,
  risk_if_failed text,
  created_at timestamptz not null default now(),
  unique(seed_set_id, step_key)
);

create table if not exists public.pilot_scenario_runs (
  id uuid primary key default gen_random_uuid(),
  seed_set_id uuid references public.pilot_scenario_seed_sets(id) on delete set null,
  run_code text not null unique,
  status text not null default 'planned' check (status in ('planned','running','blocked','completed','failed','archived')),
  branch_id text,
  period_key text,
  started_by uuid,
  started_at timestamptz,
  completed_at timestamptz,
  readiness_score numeric not null default 0,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pilot_scenario_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.pilot_scenario_runs(id) on delete cascade,
  step_key text not null,
  status text not null default 'pending' check (status in ('pending','passed','warning','failed','skipped')),
  evidence jsonb not null default '{}'::jsonb,
  notes text,
  completed_by uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(run_id, step_key)
);

create table if not exists public.pilot_scenario_reconciliation_checks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.pilot_scenario_runs(id) on delete cascade,
  check_key text not null,
  area text not null,
  severity text not null default 'warning' check (severity in ('info','warning','critical')),
  status text not null default 'pending' check (status in ('pending','passed','warning','failed','skipped')),
  expected_result text,
  evidence_source text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.pilot_scenario_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.pilot_scenario_runs(id) on delete set null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  message text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists pilot_scenario_steps_seed_idx on public.pilot_scenario_steps(seed_set_id, sequence);
create index if not exists pilot_scenario_runs_status_idx on public.pilot_scenario_runs(status, period_key, created_at desc);
create index if not exists pilot_scenario_results_run_idx on public.pilot_scenario_results(run_id, status, step_key);
create index if not exists pilot_scenario_checks_run_idx on public.pilot_scenario_reconciliation_checks(run_id, status, severity);
create index if not exists pilot_scenario_events_run_idx on public.pilot_scenario_events(run_id, event_type, created_at desc);

alter table public.pilot_scenario_seed_sets enable row level security;
alter table public.pilot_scenario_steps enable row level security;
alter table public.pilot_scenario_runs enable row level security;
alter table public.pilot_scenario_results enable row level security;
alter table public.pilot_scenario_reconciliation_checks enable row level security;
alter table public.pilot_scenario_events enable row level security;

drop policy if exists pilot_scenario_seed_sets_read_authenticated_v451 on public.pilot_scenario_seed_sets;
create policy pilot_scenario_seed_sets_read_authenticated_v451 on public.pilot_scenario_seed_sets for select to authenticated using (true);

drop policy if exists pilot_scenario_steps_read_authenticated_v451 on public.pilot_scenario_steps;
create policy pilot_scenario_steps_read_authenticated_v451 on public.pilot_scenario_steps for select to authenticated using (true);

drop policy if exists pilot_scenario_runs_read_authenticated_v451 on public.pilot_scenario_runs;
create policy pilot_scenario_runs_read_authenticated_v451 on public.pilot_scenario_runs for select to authenticated using (true);

drop policy if exists pilot_scenario_results_read_authenticated_v451 on public.pilot_scenario_results;
create policy pilot_scenario_results_read_authenticated_v451 on public.pilot_scenario_results for select to authenticated using (true);

drop policy if exists pilot_scenario_checks_read_authenticated_v451 on public.pilot_scenario_reconciliation_checks;
create policy pilot_scenario_checks_read_authenticated_v451 on public.pilot_scenario_reconciliation_checks for select to authenticated using (true);

drop policy if exists pilot_scenario_events_read_authenticated_v451 on public.pilot_scenario_events;
create policy pilot_scenario_events_read_authenticated_v451 on public.pilot_scenario_events for select to authenticated using (true);

create or replace function public.pilot_scenario_catalog()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return jsonb_build_object(
    'version', 'v451',
    'title', 'Real Pilot Scenario Pack',
    'scenario', 'One-month restaurant ERP pilot validation',
    'requiredSteps', jsonb_build_array(
      'opening-balances',
      'purchase-invoice',
      'supplier-payment',
      'pos-day',
      'production-batch',
      'stock-count',
      'vat-close',
      'backup-restore'
    ),
    'criticalChecks', jsonb_build_array(
      'trial-balance-balanced',
      'ap-aging-reconciles',
      'inventory-valuation-reconciles',
      'vat-settlement-reconciles',
      'duplicate-posting-blocked',
      'backup-restore-proof'
    )
  );
end;
$$;

create or replace function public.pilot_record_scenario_result(
  p_run_id uuid,
  p_step_key text,
  p_status text,
  p_evidence jsonb default '{}'::jsonb,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_run_id is null then
    raise exception 'run_id is required';
  end if;

  if p_step_key is null or btrim(p_step_key) = '' then
    raise exception 'step_key is required';
  end if;

  if coalesce(p_status, '') not in ('pending','passed','warning','failed','skipped') then
    raise exception 'invalid pilot scenario result status: %', p_status;
  end if;

  insert into public.pilot_scenario_results(run_id, step_key, status, evidence, notes, completed_by, completed_at)
  values (p_run_id, p_step_key, p_status, coalesce(p_evidence, '{}'::jsonb), p_notes, auth.uid(), now())
  on conflict (run_id, step_key) do update set
    status = excluded.status,
    evidence = excluded.evidence,
    notes = excluded.notes,
    completed_by = excluded.completed_by,
    completed_at = excluded.completed_at
  returning id into v_id;

  insert into public.pilot_scenario_events(run_id, event_type, severity, message, details)
  values (
    p_run_id,
    'pilot.result.recorded',
    case when p_status = 'failed' then 'critical' when p_status = 'warning' then 'warning' else 'info' end,
    'Pilot scenario result recorded',
    jsonb_build_object('stepKey', p_step_key, 'status', p_status)
  );

  return v_id;
end;
$$;

do $$
begin
  if to_regprocedure('public.pilot_scenario_catalog()') is not null then
    execute 'grant execute on function public.pilot_scenario_catalog() to authenticated';
  end if;
  if to_regprocedure('public.pilot_record_scenario_result(uuid, text, text, jsonb, text)') is not null then
    execute 'grant execute on function public.pilot_record_scenario_result(uuid, text, text, jsonb, text) to authenticated';
  end if;
end;
$$;

insert into public.pilot_scenario_seed_sets(code, title, description, entity_counts, status)
values (
  'v451-restaurant-month-pilot',
  'v451 Restaurant Month Pilot',
  'One-month restaurant ERP scenario covering opening balances, purchasing, AP payments, POS, production, stock adjustments, VAT close, reports, and backup/restore.',
  jsonb_build_object(
    'companies', 1,
    'branches', 3,
    'stores', 5,
    'suppliers', 10,
    'items', 100,
    'recipes', 20,
    'users', 7
  ),
  'ready'
)
on conflict (code) do update set
  title = excluded.title,
  description = excluded.description,
  entity_counts = excluded.entity_counts,
  status = excluded.status,
  updated_at = now();

insert into public.pilot_scenario_steps(seed_set_id, step_key, sequence, module, title, actor, expected_backend_proof, expected_reports, pass_criteria, risk_if_failed)
select
  ss.id,
  v.step_key,
  v.sequence,
  v.module,
  v.title,
  v.actor,
  v.expected_backend_proof,
  v.expected_reports,
  v.pass_criteria,
  v.risk_if_failed
from public.pilot_scenario_seed_sets ss
cross join (
  values
    ('opening-balances', 1, 'Inventory / Finance', 'Load opening stock and opening financial balances', 'Finance + Inventory manager', '["import_cutover_runs","inventory_rebuild_runs","posting_batches"]'::jsonb, '["Opening stock valuation","Opening trial balance"]'::jsonb, '["Import approved","Duplicate import blocked","Opening balances reconcile"]'::jsonb, 'All later reports will start from unreliable balances.'),
    ('purchase-invoice', 2, 'Purchasing', 'Post approved purchase invoice', 'Purchasing + Finance', '["purchase_invoice_server_posting_events","posting_batches","inventory_stock_movements","ap_subledger_transactions","vat_transactions"]'::jsonb, '["AP aging","Inventory valuation","VAT input report","Trial balance"]'::jsonb, '["Journal balanced","Inventory increased","AP increased","VAT input recorded","Duplicate posting blocked"]'::jsonb, 'Purchasing may not reconcile to inventory, AP, VAT, or GL.'),
    ('supplier-payment', 3, 'Payments', 'Post supplier payment and allocate AP', 'Finance manager', '["supplier_payment_server_posting_events","supplier_payment_applications","ap_subledger_transactions","posting_batches"]'::jsonb, '["Supplier statement","AP aging","Cash/bank ledger","Trial balance"]'::jsonb, '["AP decreases","Bank/cash decreases","Oldest invoices allocated","Overpayment controlled"]'::jsonb, 'Supplier balances and bank balances will be unreliable.'),
    ('pos-day', 4, 'Sales / POS', 'Post reconciled POS day settlement', 'Branch manager + Finance', '["pos_day_server_posting_events","posting_batches","finance_journal_lines_backend","vat_transactions"]'::jsonb, '["Sales report","VAT output report","Payment settlement report","Trial balance"]'::jsonb, '["Payments equal sales plus VAT","Revenue posted","VAT output posted","Duplicate posting blocked"]'::jsonb, 'Sales, VAT, and payment settlement will not reconcile.'),
    ('production-batch', 5, 'Production', 'Post production batch consumption and output', 'Production manager', '["production_batch_server_posting_events","inventory_stock_movements","posting_batches"]'::jsonb, '["Production variance","Inventory valuation","COGS readiness"]'::jsonb, '["Raw materials decrease","Outputs increase","Variance calculated","Journal balanced"]'::jsonb, 'Recipe cost, wastage, and stock valuation will be unreliable.'),
    ('stock-count', 6, 'Inventory', 'Post stock count or adjustment', 'Inventory manager', '["stock_adjustment_server_posting_events","inventory_stock_movements","posting_batches"]'::jsonb, '["Stock movement report","Inventory valuation","Stock variance account"]'::jsonb, '["Stock variance posted","Balance updated","Negative stock controlled"]'::jsonb, 'Inventory quantities and valuation cannot be trusted.'),
    ('vat-close', 7, 'Finance', 'Post VAT settlement and close fiscal period', 'Finance manager', '["vat_settlement_runs","finance_close_events","fiscal_periods"]'::jsonb, '["VAT settlement","Trial balance","P&L","Balance sheet"]'::jsonb, '["VAT settlement calculated","Unposted blockers checked","Period locked/closed","Reports frozen"]'::jsonb, 'Month-end reports cannot be signed off.'),
    ('backup-restore', 8, 'Administration', 'Backup and restore drill', 'System admin', '["backup_archive_runs","backup_restore_runs","backup_archive_events"]'::jsonb, '["Restore verification summary","Data counts evidence"]'::jsonb, '["Backup created","Restore preview verified","Counts match","Reports reconcile after restore"]'::jsonb, 'No recovery proof if production data is lost or corrupted.')
) as v(step_key, sequence, module, title, actor, expected_backend_proof, expected_reports, pass_criteria, risk_if_failed)
where ss.code = 'v451-restaurant-month-pilot'
on conflict (seed_set_id, step_key) do update set
  sequence = excluded.sequence,
  module = excluded.module,
  title = excluded.title,
  actor = excluded.actor,
  expected_backend_proof = excluded.expected_backend_proof,
  expected_reports = excluded.expected_reports,
  pass_criteria = excluded.pass_criteria,
  risk_if_failed = excluded.risk_if_failed;
