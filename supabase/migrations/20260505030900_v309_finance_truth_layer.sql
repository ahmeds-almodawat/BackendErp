-- v309 Finance Extraction + Backend Truth Layer
create table if not exists public.finance_posting_batches (
  id uuid primary key default gen_random_uuid(),
  source_module text not null,
  source_document_type text not null,
  source_document_id text,
  batch_ref text not null unique,
  posting_date date not null default current_date,
  status text not null default 'draft' check (status in ('draft','validated','posted','rejected','reversed')),
  total_debit numeric not null default 0,
  total_credit numeric not null default 0,
  validation_status text not null default 'pending' check (validation_status in ('pending','passed','failed')),
  validation_findings jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create table if not exists public.finance_posting_batch_lines (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.finance_posting_batches(id) on delete cascade,
  line_no integer not null,
  account_code text not null,
  debit numeric not null default 0,
  credit numeric not null default 0,
  branch_id text,
  cost_center_id uuid,
  memo text,
  dimensions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(batch_id, line_no)
);

create table if not exists public.finance_reconciliation_checks (
  id uuid primary key default gen_random_uuid(),
  check_key text not null,
  batch_id uuid references public.finance_posting_batches(id) on delete cascade,
  source_module text not null,
  severity text not null default 'warning' check (severity in ('ok','warning','critical')),
  finding text not null,
  action_required text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- Auto compatibility columns for later enterprise migrations.
alter table if exists public.finance_reconciliation_checks add column if not exists reconciliation_run_id uuid;
alter table if exists public.finance_reconciliation_checks add column if not exists check_name text;
alter table if exists public.finance_reconciliation_checks add column if not exists status text;
alter table if exists public.finance_reconciliation_checks add column if not exists expected_value numeric;
alter table if exists public.finance_reconciliation_checks add column if not exists actual_value numeric;
alter table if exists public.finance_reconciliation_checks add column if not exists difference_value numeric;
alter table if exists public.finance_reconciliation_checks add column if not exists details jsonb;


create table if not exists public.finance_import_staging_files (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_type text not null check (file_type in ('csv','xlsx','pdf')),
  import_kind text not null,
  mapping_profile jsonb not null default '{}'::jsonb,
  status text not null default 'registered' check (status in ('registered','validated','posted','rejected')),
  row_count integer not null default 0,
  validation_errors jsonb not null default '[]'::jsonb,
  storage_path text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_posting_contracts (
  id uuid primary key default gen_random_uuid(),
  contract_key text not null unique,
  source_module text not null,
  expected_debits text[] not null default '{}',
  expected_credits text[] not null default '{}',
  required_controls text[] not null default '{}',
  risk_level text not null default 'high' check (risk_level in ('low','medium','high','critical')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.finance_posting_contracts (contract_key, source_module, expected_debits, expected_credits, required_controls, risk_level) values
('manual_journal','Finance', array['Any configured debit account'], array['Any configured credit account'], array['balanced_lines','period_open','approval_required'], 'high'),
('purchase_invoice','Purchasing', array['Inventory / Expense','VAT Input'], array['Accounts Payable / Cash'], array['supplier_required','invoice_no_unique','po_grn_match'], 'critical'),
('supplier_payment','Purchasing/AP', array['Accounts Payable'], array['Cash / Bank'], array['invoice_open_balance','payment_method_valid','bank_required'], 'high'),
('sales_pos_batch','Sales/POS', array['Cash / Bank / AR'], array['Sales Revenue','VAT Output'], array['batch_closed','payment_split_balanced','recipe_deduction_linked'], 'critical'),
('inventory_adjustment','Inventory', array['Inventory Gain / Variance'], array['Inventory / Variance'], array['approval_required','reason_required','cost_locked'], 'high'),
('production_batch','Production', array['Semi-finished / Finished Inventory'], array['Raw Material Inventory'], array['recipe_version_locked','wastage_captured','output_qty_required'], 'high'),
('depreciation_run','Fixed Assets', array['Depreciation Expense'], array['Accumulated Depreciation'], array['asset_active','period_not_closed','no_duplicate_run'], 'medium'),
('opening_balance','Finance', array['Opening assets/expenses'], array['Opening liabilities/equity/revenue'], array['single_opening_batch','balanced_lines','locked_after_post'], 'critical'),
('bank_reconciliation','Banking', array['Bank / Clearing'], array['Bank / Clearing'], array['statement_line_matched','difference_explained','approval_required'], 'high')
on conflict (contract_key) do update set source_module = excluded.source_module, expected_debits = excluded.expected_debits, expected_credits = excluded.expected_credits, required_controls = excluded.required_controls, risk_level = excluded.risk_level, updated_at = now();

create or replace function public.finance_validate_posting_batch(p_batch_id uuid)
returns table(severity text, finding text, action_required text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debit numeric;
  v_credit numeric;
  v_lines integer;
begin
  select coalesce(sum(debit),0), coalesce(sum(credit),0), count(*) into v_debit, v_credit, v_lines
  from public.finance_posting_batch_lines
  where batch_id = p_batch_id;

  update public.finance_posting_batches
  set total_debit = v_debit,
      total_credit = v_credit,
      validation_status = case when v_lines > 0 and abs(v_debit - v_credit) < 0.01 then 'passed' else 'failed' end,
      validation_findings = case when v_lines > 0 and abs(v_debit - v_credit) < 0.01 then '[]'::jsonb else jsonb_build_array(jsonb_build_object('severity','critical','finding','Posting batch is not balanced or has no lines','action_required','Fix lines before posting')) end,
      status = case when status = 'draft' and v_lines > 0 and abs(v_debit - v_credit) < 0.01 then 'validated' else status end
  where id = p_batch_id;

  if v_lines = 0 then
    return query select 'critical'::text, 'Posting batch has no lines'::text, 'Add at least two balanced lines before posting'::text;
  elsif abs(v_debit - v_credit) >= 0.01 then
    return query select 'critical'::text, ('Debit ' || v_debit || ' does not equal credit ' || v_credit)::text, 'Correct the batch lines before posting'::text;
  else
    return query select 'ok'::text, 'Posting batch is balanced'::text, 'Ready for approval/posting'::text;
  end if;
end;
$$;

alter table public.finance_posting_batches enable row level security;
alter table public.finance_posting_batch_lines enable row level security;
alter table public.finance_reconciliation_checks enable row level security;
alter table public.finance_import_staging_files enable row level security;
alter table public.finance_posting_contracts enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = split_part('public.finance_posting_batches', '.', 1) and tablename = split_part('public.finance_posting_batches', '.', 2) and policyname = 'finance_posting_batches_authenticated_read') then
    create policy finance_posting_batches_authenticated_read on public.finance_posting_batches for select to authenticated using (true);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = split_part('public.finance_posting_batch_lines', '.', 1) and tablename = split_part('public.finance_posting_batch_lines', '.', 2) and policyname = 'finance_posting_batch_lines_authenticated_read') then
    create policy finance_posting_batch_lines_authenticated_read on public.finance_posting_batch_lines for select to authenticated using (true);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = split_part('public.finance_reconciliation_checks', '.', 1) and tablename = split_part('public.finance_reconciliation_checks', '.', 2) and policyname = 'finance_reconciliation_checks_authenticated_read') then
    create policy finance_reconciliation_checks_authenticated_read on public.finance_reconciliation_checks for select to authenticated using (true);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = split_part('public.finance_import_staging_files', '.', 1) and tablename = split_part('public.finance_import_staging_files', '.', 2) and policyname = 'finance_import_staging_files_authenticated_read') then
    create policy finance_import_staging_files_authenticated_read on public.finance_import_staging_files for select to authenticated using (true);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = split_part('public.finance_posting_contracts', '.', 1) and tablename = split_part('public.finance_posting_contracts', '.', 2) and policyname = 'finance_posting_contracts_authenticated_read') then
    create policy finance_posting_contracts_authenticated_read on public.finance_posting_contracts for select to authenticated using (true);
  end if;
end $$;
