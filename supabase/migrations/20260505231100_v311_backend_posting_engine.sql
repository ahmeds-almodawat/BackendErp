-- v311 Backend Posting Engine foundation
-- Adds additive posting-engine tables, RPCs, indexes, RLS, and immutability guards.
-- This migration intentionally preserves the existing v309 finance tables and only layers
-- a newer posting-engine foundation beside them.

create extension if not exists pgcrypto;

create table if not exists public.posting_batches (
  id uuid primary key default gen_random_uuid(),
  legacy_finance_batch_id uuid references public.finance_posting_batches(id) on delete set null,
  batch_ref text not null unique,
  source_type text not null check (
    source_type in (
      'manual_journal',
      'opening_balance',
      'purchase_invoice',
      'supplier_payment',
      'sales_pos_batch',
      'inventory_adjustment',
      'production_batch',
      'depreciation_run',
      'bank_reconciliation'
    )
  ),
  source_id text not null,
  source_document_no text,
  source_module text,
  branch_id text not null references public.branches(id) on delete restrict,
  fiscal_period_id uuid not null references public.fiscal_periods(id) on delete restrict,
  posting_date date not null default current_date,
  status text not null default 'draft' check (
    status in ('draft', 'pending_approval', 'approved', 'posted', 'reversed', 'cancelled', 'voided')
  ),
  direction text not null default 'normal' check (direction in ('normal', 'reversal')),
  reversal_of_batch_id uuid references public.posting_batches(id) on delete restrict,
  currency_code text not null default 'SAR',
  description text,
  total_debit numeric(18,2) not null default 0 check (total_debit >= 0),
  total_credit numeric(18,2) not null default 0 check (total_credit >= 0),
  validation_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  posted_at timestamptz,
  last_validated_at timestamptz
);

create table if not exists public.posting_batch_lines (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.posting_batches(id) on delete cascade,
  line_no integer not null,
  account_code text not null,
  description text,
  branch_id text references public.branches(id) on delete set null,
  cost_center_id uuid,
  debit numeric(18,2) not null default 0 check (debit >= 0),
  credit numeric(18,2) not null default 0 check (credit >= 0),
  source_line_id text,
  dimensions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, line_no),
  constraint posting_batch_lines_single_sided_amount check (
    (debit > 0 and credit = 0) or (credit > 0 and debit = 0)
  )
);

create table if not exists public.posting_validation_findings (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.posting_batches(id) on delete cascade,
  severity text not null check (severity in ('ok', 'warning', 'critical')),
  finding_code text not null,
  field_name text,
  message text not null,
  action_required text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.posting_reversals (
  id uuid primary key default gen_random_uuid(),
  original_batch_id uuid not null references public.posting_batches(id) on delete restrict,
  reversal_batch_id uuid not null unique references public.posting_batches(id) on delete restrict,
  reason text not null,
  reversed_by uuid references auth.users(id),
  reversed_at timestamptz not null default now(),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  unique (original_batch_id)
);

create table if not exists public.posting_source_locks (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id text not null,
  branch_id text not null references public.branches(id) on delete restrict,
  batch_id uuid references public.posting_batches(id) on delete set null,
  locked_by uuid references auth.users(id),
  locked_at timestamptz not null default now(),
  released_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_posting_batches_branch_period_status
  on public.posting_batches(branch_id, fiscal_period_id, status);
create index if not exists idx_posting_batches_source_lookup
  on public.posting_batches(source_type, source_id, branch_id);
create index if not exists idx_posting_batches_posting_date
  on public.posting_batches(posting_date desc);
create unique index if not exists idx_posting_batches_reversal_unique
  on public.posting_batches(reversal_of_batch_id)
  where reversal_of_batch_id is not null;
create unique index if not exists idx_posting_batches_source_doc_active
  on public.posting_batches(source_type, source_id, branch_id)
  where direction = 'normal' and status not in ('cancelled', 'voided');

create index if not exists idx_posting_batch_lines_batch
  on public.posting_batch_lines(batch_id, line_no);
create index if not exists idx_posting_batch_lines_account
  on public.posting_batch_lines(account_code);
create index if not exists idx_posting_batch_lines_branch
  on public.posting_batch_lines(branch_id);

create index if not exists idx_posting_validation_findings_batch
  on public.posting_validation_findings(batch_id, severity, created_at desc);

create index if not exists idx_posting_reversals_original
  on public.posting_reversals(original_batch_id);
create index if not exists idx_posting_reversals_reversal
  on public.posting_reversals(reversal_batch_id);

create index if not exists idx_posting_source_locks_batch
  on public.posting_source_locks(batch_id);
create index if not exists idx_posting_source_locks_branch
  on public.posting_source_locks(branch_id, locked_at desc);
create unique index if not exists idx_posting_source_locks_active
  on public.posting_source_locks(source_type, source_id, branch_id)
  where released_at is null;

create or replace function public.posting_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.finance_can_post_to_period(period_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.fiscal_periods
    where id = period_id
      and status = 'open'
  );
$$;

create or replace function public.posting_guard_before_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duplicate_id uuid;
begin
  if coalesce(trim(new.source_type), '') = '' then
    raise exception 'Posting batch must have source type.';
  end if;

  if new.branch_id is null then
    raise exception 'Posting batch must have branch id.';
  end if;

  if new.fiscal_period_id is null then
    raise exception 'Posting batch must have fiscal period id.';
  end if;

  if new.direction = 'reversal' and new.reversal_of_batch_id is null then
    raise exception 'Reversal posting must reference original posting batch.';
  end if;

  if new.status = 'posted' and not public.finance_can_post_to_period(new.fiscal_period_id) then
    raise exception 'Closed or locked fiscal periods cannot be posted.';
  end if;

  if new.direction = 'normal' then
    select id
    into v_duplicate_id
    from public.posting_batches
    where source_type = new.source_type
      and source_id = new.source_id
      and branch_id = new.branch_id
      and direction = 'normal'
      and status not in ('cancelled', 'voided')
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    limit 1;

    if v_duplicate_id is not null then
      raise exception 'Duplicate source document prevented by v311 posting engine.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.posting_guard_immutable_rows()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_status text;
begin
  if tg_table_name = 'posting_batches' then
    if old.status in ('posted', 'reversed', 'voided') then
      raise exception 'Posted batches are immutable. Create a reversal instead.';
    end if;

    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  select status
  into v_batch_status
  from public.posting_batches
  where id = coalesce(old.batch_id, new.batch_id);

  if v_batch_status in ('posted', 'reversed', 'voided') then
    raise exception 'Posted batch lines are immutable. Create a reversal instead.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_posting_batches_set_updated_at on public.posting_batches;
create trigger trg_posting_batches_set_updated_at
before update on public.posting_batches
for each row
execute function public.posting_set_updated_at();

drop trigger if exists trg_posting_batch_lines_set_updated_at on public.posting_batch_lines;
create trigger trg_posting_batch_lines_set_updated_at
before update on public.posting_batch_lines
for each row
execute function public.posting_set_updated_at();

drop trigger if exists trg_posting_batches_before_post on public.posting_batches;
create trigger trg_posting_batches_before_post
before insert or update on public.posting_batches
for each row
execute function public.posting_guard_before_post();

drop trigger if exists trg_posting_batches_immutable on public.posting_batches;
create trigger trg_posting_batches_immutable
before update or delete on public.posting_batches
for each row
execute function public.posting_guard_immutable_rows();

drop trigger if exists trg_posting_batch_lines_immutable on public.posting_batch_lines;
create trigger trg_posting_batch_lines_immutable
before update or delete on public.posting_batch_lines
for each row
execute function public.posting_guard_immutable_rows();

create or replace function public.finance_lock_posting_source(
  source_type text,
  source_id text,
  branch_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock_id uuid;
begin
  if coalesce(trim(source_type), '') = '' then
    raise exception 'source_type is required';
  end if;

  if coalesce(trim(source_id), '') = '' then
    raise exception 'source_id is required';
  end if;

  if branch_id is null then
    raise exception 'branch_id is required';
  end if;

  select id
  into v_lock_id
  from public.posting_source_locks
  where source_type = trim(source_type)
    and source_id = trim(source_id)
    and branch_id = finance_lock_posting_source.branch_id
    and released_at is null
  limit 1;

  if v_lock_id is not null then
    return v_lock_id;
  end if;

  insert into public.posting_source_locks (
    source_type,
    source_id,
    branch_id,
    locked_by
  )
  values (
    trim(source_type),
    trim(source_id),
    branch_id,
    auth.uid()
  )
  returning id into v_lock_id;

  return v_lock_id;
exception
  when unique_violation then
    select id
    into v_lock_id
    from public.posting_source_locks
    where source_type = trim(finance_lock_posting_source.source_type)
      and source_id = trim(finance_lock_posting_source.source_id)
      and branch_id = finance_lock_posting_source.branch_id
      and released_at is null
    limit 1;

    return v_lock_id;
end;
$$;

drop function if exists public.finance_validate_posting_batch(uuid);
create or replace function public.finance_validate_posting_batch(batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_v311 boolean := false;
  v_source_type text;
  v_source_id text;
  v_branch_id text;
  v_fiscal_period_id uuid;
  v_status text;
  v_direction text := 'normal';
  v_reversal_of_batch_id uuid;
  v_total_debit numeric := 0;
  v_total_credit numeric := 0;
  v_line_count integer := 0;
  v_invalid_line_count integer := 0;
  v_duplicate_count integer := 0;
  v_source_lock_exists boolean := false;
  v_findings jsonb := '[]'::jsonb;
  v_critical_count integer := 0;
  v_warning_count integer := 0;
begin
  select
    true,
    pb.source_type,
    pb.source_id,
    pb.branch_id,
    pb.fiscal_period_id,
    pb.status,
    pb.direction,
    pb.reversal_of_batch_id
  into
    v_is_v311,
    v_source_type,
    v_source_id,
    v_branch_id,
    v_fiscal_period_id,
    v_status,
    v_direction,
    v_reversal_of_batch_id
  from public.posting_batches pb
  where pb.id = batch_id;

  if found then
    select
      coalesce(sum(line.debit), 0),
      coalesce(sum(line.credit), 0),
      count(*),
      count(*) filter (
        where line.debit < 0
          or line.credit < 0
          or (line.debit = 0 and line.credit = 0)
          or (line.debit > 0 and line.credit > 0)
      )
    into
      v_total_debit,
      v_total_credit,
      v_line_count,
      v_invalid_line_count
    from public.posting_batch_lines line
    where line.batch_id = batch_id;

    select count(*)
    into v_duplicate_count
    from public.posting_batches duplicate_batch
    where duplicate_batch.source_type = v_source_type
      and duplicate_batch.source_id = v_source_id
      and duplicate_batch.branch_id = v_branch_id
      and duplicate_batch.direction = 'normal'
      and duplicate_batch.status not in ('cancelled', 'voided')
      and duplicate_batch.id <> batch_id;

    select exists (
      select 1
      from public.posting_source_locks lock_row
      where lock_row.source_type = v_source_type
        and lock_row.source_id = v_source_id
        and lock_row.branch_id = v_branch_id
        and lock_row.released_at is null
    )
    into v_source_lock_exists;
  else
    select
      batch_row.source_document_type,
      coalesce(batch_row.source_document_id, ''),
      max(line.branch_id),
      null::uuid,
      batch_row.status,
      'normal',
      null::uuid
    into
      v_source_type,
      v_source_id,
      v_branch_id,
      v_fiscal_period_id,
      v_status,
      v_direction,
      v_reversal_of_batch_id
    from public.finance_posting_batches batch_row
    left join public.finance_posting_batch_lines line on line.batch_id = batch_row.id
    where batch_row.id = batch_id
    group by batch_row.source_document_type, batch_row.source_document_id, batch_row.status;

    if not found then
      return jsonb_build_object(
        'ok', false,
        'critical_count', 1,
        'warning_count', 0,
        'findings', jsonb_build_array(
          jsonb_build_object(
            'severity', 'critical',
            'code', 'BATCH_NOT_FOUND',
            'message', 'Posting batch was not found in v311 or legacy v309 tables.',
            'action', 'Verify the batch id before calling finance_validate_posting_batch.'
          )
        )
      );
    end if;

    select
      coalesce(sum(line.debit), 0),
      coalesce(sum(line.credit), 0),
      count(*),
      count(*) filter (
        where line.debit < 0
          or line.credit < 0
          or (line.debit = 0 and line.credit = 0)
          or (line.debit > 0 and line.credit > 0)
      )
    into
      v_total_debit,
      v_total_credit,
      v_line_count,
      v_invalid_line_count
    from public.finance_posting_batch_lines line
    where line.batch_id = batch_id;
  end if;

  if coalesce(trim(v_source_type), '') = '' then
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity', 'critical',
      'code', 'SOURCE_TYPE_REQUIRED',
      'message', 'Posting batch must have source type.',
      'action', 'Assign a supported posting contract before posting.'
    ));
    v_critical_count := v_critical_count + 1;
  end if;

  if v_branch_id is null then
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity', 'critical',
      'code', 'BRANCH_REQUIRED',
      'message', 'Posting batch must have branch id.',
      'action', 'Populate branch scope before posting.'
    ));
    v_critical_count := v_critical_count + 1;
  end if;

  if v_is_v311 and v_fiscal_period_id is null then
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity', 'critical',
      'code', 'FISCAL_PERIOD_REQUIRED',
      'message', 'Posting batch must have fiscal period id.',
      'action', 'Map the batch to an open fiscal period before posting.'
    ));
    v_critical_count := v_critical_count + 1;
  elsif not v_is_v311 then
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity', 'warning',
      'code', 'LEGACY_PERIOD_GAP',
      'message', 'Legacy v309 batches do not store fiscal_period_id in the batch header.',
      'action', 'Migrate legacy batches into posting_batches before enforcing period locks centrally.'
    ));
    v_warning_count := v_warning_count + 1;
  end if;

  if v_line_count = 0 then
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity', 'critical',
      'code', 'LINES_REQUIRED',
      'message', 'Posting batch has no posting lines.',
      'action', 'Add balanced debit and credit lines before posting.'
    ));
    v_critical_count := v_critical_count + 1;
  end if;

  if v_invalid_line_count > 0 then
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity', 'critical',
      'code', 'LINE_AMOUNT_INVALID',
      'message', format('%s line(s) contain invalid amounts. Each line must carry one positive debit or one positive credit.', v_invalid_line_count),
      'action', 'Correct the invalid line amounts before posting.'
    ));
    v_critical_count := v_critical_count + 1;
  end if;

  if abs(v_total_debit - v_total_credit) >= 0.01 then
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity', 'critical',
      'code', 'BATCH_NOT_BALANCED',
      'message', format('Debit %.2f does not equal credit %.2f.', v_total_debit, v_total_credit),
      'action', 'Balance the batch before approval or posting.'
    ));
    v_critical_count := v_critical_count + 1;
  end if;

  if v_is_v311 and v_status = 'posted' and not public.finance_can_post_to_period(v_fiscal_period_id) then
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity', 'critical',
      'code', 'PERIOD_BLOCKED',
      'message', 'Closed or locked fiscal periods cannot be posted.',
      'action', 'Reopen the period or move the posting into an open period.'
    ));
    v_critical_count := v_critical_count + 1;
  elsif not v_is_v311 and v_status = 'posted' then
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity', 'warning',
      'code', 'LEGACY_PERIOD_ENFORCEMENT',
      'message', 'Legacy v309 posted batches cannot prove fiscal-period enforcement from the batch header alone.',
      'action', 'Use posting_batches for period-safe server-side posting.'
    ));
    v_warning_count := v_warning_count + 1;
  end if;

  if v_is_v311 and v_direction = 'reversal' and v_reversal_of_batch_id is null then
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity', 'critical',
      'code', 'REVERSAL_REFERENCE_REQUIRED',
      'message', 'Reversal posting must reference original posting batch.',
      'action', 'Populate reversal_of_batch_id before posting the reversal.'
    ));
    v_critical_count := v_critical_count + 1;
  end if;

  if v_is_v311 and coalesce(trim(v_source_id), '') = '' then
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity', 'warning',
      'code', 'SOURCE_DOCUMENT_ID_RECOMMENDED',
      'message', 'Duplicate source document prevention is designed, but source_id is blank.',
      'action', 'Store the source document id before approval or posting.'
    ));
    v_warning_count := v_warning_count + 1;
  elsif v_is_v311 and v_duplicate_count > 0 then
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity', 'critical',
      'code', 'DUPLICATE_SOURCE_DOCUMENT',
      'message', 'Duplicate source document detected for the same source id and branch.',
      'action', 'Block posting and review existing batches or locks.'
    ));
    v_critical_count := v_critical_count + 1;
  elsif v_is_v311 and not v_source_lock_exists then
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity', 'warning',
      'code', 'SOURCE_LOCK_RECOMMENDED',
      'message', 'Duplicate source document prevention is designed through posting_source_locks, but no active lock was found.',
      'action', 'Call finance_lock_posting_source before final posting.'
    ));
    v_warning_count := v_warning_count + 1;
  elsif not v_is_v311 then
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity', 'warning',
      'code', 'LEGACY_DUPLICATE_DESIGN',
      'message', 'Legacy v309 batches do not use posting_source_locks for duplicate prevention.',
      'action', 'Migrate the posting workflow to v311 posting_batches and posting_source_locks.'
    ));
    v_warning_count := v_warning_count + 1;
  end if;

  if v_is_v311 then
    delete from public.posting_validation_findings
    where batch_id = finance_validate_posting_batch.batch_id;

    insert into public.posting_validation_findings (
      batch_id,
      severity,
      finding_code,
      field_name,
      message,
      action_required,
      details
    )
    select
      finance_validate_posting_batch.batch_id,
      finding ->> 'severity',
      finding ->> 'code',
      finding ->> 'field',
      finding ->> 'message',
      finding ->> 'action',
      jsonb_strip_nulls(
        finding
        - 'severity'
        - 'code'
        - 'field'
        - 'message'
        - 'action'
      )
    from jsonb_array_elements(v_findings) as finding;

    update public.posting_batches
    set total_debit = round(v_total_debit, 2),
        total_credit = round(v_total_credit, 2),
        validation_snapshot = jsonb_build_object(
          'ok', v_critical_count = 0,
          'critical_count', v_critical_count,
          'warning_count', v_warning_count,
          'findings', v_findings,
          'totals', jsonb_build_object(
            'debit', round(v_total_debit, 2),
            'credit', round(v_total_credit, 2),
            'line_count', v_line_count,
            'imbalance', round(v_total_debit - v_total_credit, 2)
          )
        ),
        last_validated_at = now(),
        updated_at = now()
    where id = finance_validate_posting_batch.batch_id;
  end if;

  return jsonb_build_object(
    'ok', v_critical_count = 0,
    'critical_count', v_critical_count,
    'warning_count', v_warning_count,
    'findings', v_findings
  );
end;
$$;
do $$
begin
  if to_regprocedure('public.finance_validate_posting_batch(uuid)') is not null then
    execute 'grant execute on function public.finance_validate_posting_batch(uuid) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.finance_can_post_to_period(uuid)') is not null then
    execute 'grant execute on function public.finance_can_post_to_period(uuid) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.finance_lock_posting_source(text, text, uuid)') is not null then
    execute 'grant execute on function public.finance_lock_posting_source(text, text, uuid) to authenticated';
  end if;
end;
$$;

alter table public.posting_batches enable row level security;
alter table public.posting_batch_lines enable row level security;
alter table public.posting_validation_findings enable row level security;
alter table public.posting_reversals enable row level security;
alter table public.posting_source_locks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'posting_batches' and policyname = 'posting_batches_finance_read'
  ) then
    create policy posting_batches_finance_read on public.posting_batches
      for select to authenticated using (
        public.app_current_user_has_permission('finance.view')
        or public.app_current_user_has_permission('finance.post')
        or public.app_current_user_has_permission('settings.manage')
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'posting_batches' and policyname = 'posting_batches_finance_write'
  ) then
    create policy posting_batches_finance_write on public.posting_batches
      for all to authenticated using (
        public.app_current_user_has_permission('finance.post')
        or public.app_current_user_has_permission('settings.manage')
      )
      with check (
        public.app_current_user_has_permission('finance.post')
        or public.app_current_user_has_permission('settings.manage')
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'posting_batch_lines' and policyname = 'posting_batch_lines_finance_read'
  ) then
    create policy posting_batch_lines_finance_read on public.posting_batch_lines
      for select to authenticated using (
        public.app_current_user_has_permission('finance.view')
        or public.app_current_user_has_permission('finance.post')
        or public.app_current_user_has_permission('settings.manage')
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'posting_batch_lines' and policyname = 'posting_batch_lines_finance_write'
  ) then
    create policy posting_batch_lines_finance_write on public.posting_batch_lines
      for all to authenticated using (
        public.app_current_user_has_permission('finance.post')
        or public.app_current_user_has_permission('settings.manage')
      )
      with check (
        public.app_current_user_has_permission('finance.post')
        or public.app_current_user_has_permission('settings.manage')
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'posting_validation_findings' and policyname = 'posting_validation_findings_finance_read'
  ) then
    create policy posting_validation_findings_finance_read on public.posting_validation_findings
      for select to authenticated using (
        public.app_current_user_has_permission('finance.view')
        or public.app_current_user_has_permission('finance.post')
        or public.app_current_user_has_permission('settings.manage')
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'posting_reversals' and policyname = 'posting_reversals_finance_read'
  ) then
    create policy posting_reversals_finance_read on public.posting_reversals
      for select to authenticated using (
        public.app_current_user_has_permission('finance.view')
        or public.app_current_user_has_permission('finance.post')
        or public.app_current_user_has_permission('settings.manage')
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'posting_reversals' and policyname = 'posting_reversals_finance_write'
  ) then
    create policy posting_reversals_finance_write on public.posting_reversals
      for all to authenticated using (
        public.app_current_user_has_permission('finance.reverse')
        or public.app_current_user_has_permission('settings.manage')
      )
      with check (
        public.app_current_user_has_permission('finance.reverse')
        or public.app_current_user_has_permission('settings.manage')
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'posting_source_locks' and policyname = 'posting_source_locks_finance_read'
  ) then
    create policy posting_source_locks_finance_read on public.posting_source_locks
      for select to authenticated using (
        public.app_current_user_has_permission('finance.post')
        or public.app_current_user_has_permission('settings.manage')
      );
  end if;
end $$;
