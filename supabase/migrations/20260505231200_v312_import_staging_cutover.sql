-- v312 Import Staging and Production Cutover foundation
-- Additive only: does not drop or rename v310 import_staging_* tables.

create extension if not exists pgcrypto;

-- --- Mapping profiles (column maps + required fields as JSON for flexibility)
create table if not exists public.import_mapping_profiles (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  profile_name text not null,
  version text not null default '1.0.0',
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  required_fields jsonb not null default '[]'::jsonb,
  optional_fields jsonb not null default '[]'::jsonb,
  field_mappings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, profile_name, version)
);

create table if not exists public.import_mapping_profile_fields (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.import_mapping_profiles(id) on delete cascade,
  source_column text not null,
  target_field text not null,
  is_required boolean not null default false,
  sort_order int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  unique (profile_id, source_column)
);

-- --- Cutover batches (links staging file → profile → branch/date/hash)
create table if not exists public.import_cutover_batches (
  id uuid primary key default gen_random_uuid(),
  staging_file_id uuid not null references public.import_staging_files(id) on delete restrict,
  mapping_profile_id uuid references public.import_mapping_profiles(id) on delete set null,
  branch_id text not null references public.branches(id) on delete restrict,
  business_date date not null,
  file_hash text not null,
  status text not null default 'draft' check (status in ('draft', 'ready', 'posted', 'failed', 'cancelled')),
  rollback_status text not null default 'none' check (rollback_status in ('none', 'requested', 'applied', 'rejected')),
  row_count int not null default 0,
  critical_row_count int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.import_cutover_batch_rows (
  id uuid primary key default gen_random_uuid(),
  cutover_batch_id uuid not null references public.import_cutover_batches(id) on delete cascade,
  staging_row_id uuid references public.import_staging_rows(id) on delete set null,
  row_number int not null,
  status text not null default 'pending' check (status in ('pending', 'posted', 'skipped', 'error')),
  message text,
  created_at timestamptz not null default now(),
  unique (cutover_batch_id, row_number)
);

create table if not exists public.import_rollback_requests (
  id uuid primary key default gen_random_uuid(),
  cutover_batch_id uuid not null references public.import_cutover_batches(id) on delete restrict,
  reason text not null,
  requested_by uuid references auth.users(id),
  status text not null default 'pending' check (status in ('pending', 'applied', 'rejected')),
  applied_correction_batch_id uuid references public.posting_batches(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (cutover_batch_id)
);

create table if not exists public.import_file_hash_locks (
  id uuid primary key default gen_random_uuid(),
  file_hash text not null,
  source_type text not null,
  branch_id text not null references public.branches(id) on delete restrict,
  business_date date not null,
  staging_file_id uuid not null unique references public.import_staging_files(id) on delete restrict,
  locked_at timestamptz not null default now(),
  locked_by uuid references auth.users(id),
  unique (file_hash, source_type, branch_id, business_date)
);

create index if not exists idx_import_mapping_profiles_source on public.import_mapping_profiles(source_type, status);
create index if not exists idx_import_mapping_profile_fields_profile on public.import_mapping_profile_fields(profile_id);
create index if not exists idx_import_cutover_batches_file on public.import_cutover_batches(staging_file_id);
create index if not exists idx_import_cutover_batches_branch_date on public.import_cutover_batches(branch_id, business_date);
create index if not exists idx_import_cutover_batch_rows_batch on public.import_cutover_batch_rows(cutover_batch_id);
create index if not exists idx_import_rollback_requests_batch on public.import_rollback_requests(cutover_batch_id);
create index if not exists idx_import_file_hash_locks_lookup on public.import_file_hash_locks(source_type, branch_id, business_date);

create or replace function public.import_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_import_mapping_profiles_updated on public.import_mapping_profiles;
create trigger trg_import_mapping_profiles_updated
before update on public.import_mapping_profiles
for each row execute function public.import_set_updated_at();

drop trigger if exists trg_import_cutover_batches_updated on public.import_cutover_batches;
create trigger trg_import_cutover_batches_updated
before update on public.import_cutover_batches
for each row execute function public.import_set_updated_at();

-- --- RPC: validate staging file (scan validation errors + structural checks)
create or replace function public.import_validate_staging_file(file_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_crit int := 0;
  v_warn int := 0;
  v_findings jsonb := '[]'::jsonb;
  v_status text;
  v_exists boolean := false;
begin
  select true, status into v_exists, v_status from public.import_staging_files where id = file_id;
  if not v_exists then
    return jsonb_build_object(
      'ok', false,
      'critical_count', 1,
      'warning_count', 0,
      'message', 'Staging file not found.',
      'findings', jsonb_build_array(jsonb_build_object(
        'severity', 'critical',
        'code', 'FILE_NOT_FOUND',
        'message', 'No import_staging_files row for this id.'
      ))
    );
  end if;

  select count(*) filter (where severity = 'critical'),
         count(*) filter (where severity = 'warning')
    into v_crit, v_warn
  from public.import_validation_errors
  where import_validation_errors.file_id = import_validate_staging_file.file_id;

  if v_crit > 0 then
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity', 'critical',
      'code', 'CRITICAL_VALIDATION_ERRORS',
      'message', format('%s critical validation row(s) on file.', v_crit)
    ));
  end if;

  if v_status not in ('mapped', 'validated', 'has_errors', 'approved') and v_status <> 'posted' then
    v_findings := v_findings || jsonb_build_array(jsonb_build_object(
      'severity', 'warning',
      'code', 'STATUS_EARLY',
      'message', format('File status is %s; map and validate before production cutover.', v_status)
    ));
    v_warn := v_warn + 1;
  end if;

  return jsonb_build_object(
    'ok', v_crit = 0,
    'critical_count', v_crit,
    'warning_count', v_warn,
    'message', case when v_crit = 0 then 'Staging validation summary captured.' else 'Critical errors must be fixed before approval.' end,
    'findings', v_findings
  );
end;
$$;

-- --- RPC: approve (requires validated + no critical errors)
create or replace function public.import_approve_staging_file(file_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_crit int := 0;
  v_status text;
  v_error_rows int;
begin
  if not public.app_current_user_has_permission('imports.approve')
     and not public.app_current_user_has_permission('settings.manage') then
    return jsonb_build_object(
      'ok', false,
      'critical_count', 1,
      'warning_count', 0,
      'message', 'Missing imports.approve permission.',
      'findings', jsonb_build_array(jsonb_build_object('severity', 'critical', 'code', 'PERMISSION', 'message', 'Approver permission required.'))
    );
  end if;

  select status, coalesce(error_rows, 0)
  into v_status, v_error_rows
  from public.import_staging_files
  where id = file_id;

  if v_status is null then
    return jsonb_build_object(
      'ok', false,
      'critical_count', 1,
      'warning_count', 0,
      'message', 'Staging file not found.',
      'findings', jsonb_build_array(jsonb_build_object('severity', 'critical', 'code', 'FILE_NOT_FOUND', 'message', 'Unknown file id.'))
    );
  end if;

  select count(*) into v_crit
  from public.import_validation_errors
  where file_id = import_approve_staging_file.file_id and severity = 'critical';

  if v_status <> 'validated' then
    return jsonb_build_object(
      'ok', false,
      'critical_count', 1,
      'warning_count', 0,
      'message', 'Only validated imports can be approved.',
      'findings', jsonb_build_array(jsonb_build_object('severity', 'critical', 'code', 'NOT_VALIDATED', 'message', format('Current status: %s', v_status)))
    );
  end if;

  if v_crit > 0 or v_error_rows > 0 then
    return jsonb_build_object(
      'ok', false,
      'critical_count', greatest(v_crit, 1),
      'warning_count', 0,
      'message', 'Imports with critical errors cannot be approved.',
      'findings', jsonb_build_array(jsonb_build_object('severity', 'critical', 'code', 'BLOCKING_ERRORS', 'message', 'Resolve validation errors first.'))
    );
  end if;

  if v_status in ('approved', 'posted') then
    return jsonb_build_object(
      'ok', false,
      'critical_count', 1,
      'warning_count', 0,
      'message', 'Approved/posted imports cannot be edited.',
      'findings', jsonb_build_array(jsonb_build_object('severity', 'critical', 'code', 'IMMUTABLE', 'message', 'File already approved or posted.'))
    );
  end if;

  update public.import_staging_files
  set status = 'approved',
      approved_by = auth.uid(),
      approved_at = now()
  where id = file_id;

  return jsonb_build_object(
    'ok', true,
    'critical_count', 0,
    'warning_count', 0,
    'message', 'Import approved for cutover.',
    'findings', '[]'::jsonb
  );
end;
$$;

-- --- RPC: create cutover batch shell (approved file + metadata)
create or replace function public.import_create_cutover_batch(file_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_file record;
  v_profile uuid;
  v_branch text;
  v_biz date;
  v_hash text;
  v_crit int := 0;
  v_new_id uuid;
begin
  if not public.app_current_user_has_permission('imports.approve')
     and not public.app_current_user_has_permission('finance.post')
     and not public.app_current_user_has_permission('settings.manage') then
    return jsonb_build_object(
      'ok', false,
      'critical_count', 1,
      'warning_count', 0,
      'message', 'Insufficient permission to create cutover batch.',
      'findings', jsonb_build_array(jsonb_build_object('severity', 'critical', 'code', 'PERMISSION', 'message', 'Finance/import privilege required.'))
    );
  end if;

  select * into v_file from public.import_staging_files where id = file_id;
  if not found then
    return jsonb_build_object(
      'ok', false,
      'critical_count', 1,
      'warning_count', 0,
      'message', 'Staging file not found.',
      'findings', jsonb_build_array(jsonb_build_object('severity', 'critical', 'code', 'FILE_NOT_FOUND', 'message', 'Unknown file id.'))
    );
  end if;

  if v_file.status <> 'approved' and v_file.status <> 'posted' then
    return jsonb_build_object(
      'ok', false,
      'critical_count', 1,
      'warning_count', 0,
      'message', 'Approved imports can be cut over; file is not approved.',
      'findings', jsonb_build_array(jsonb_build_object('severity', 'critical', 'code', 'NOT_APPROVED', 'message', format('Status is %s', v_file.status)))
    );
  end if;

  v_profile := nullif(v_file.metadata ->> 'mapping_profile_id', '')::uuid;
  v_branch := nullif(v_file.metadata ->> 'branch_id', '');
  v_biz := nullif(v_file.metadata ->> 'business_date', '')::date;
  v_hash := coalesce(nullif(trim(v_file.metadata ->> 'file_sha256'), ''), nullif(trim(v_file.metadata ->> 'file_hash'), ''));

  if v_profile is null then
    return jsonb_build_object(
      'ok', false,
      'critical_count', 1,
      'warning_count', 0,
      'message', 'Mapping profile is required before cutover.',
      'findings', jsonb_build_array(jsonb_build_object('severity', 'critical', 'code', 'PROFILE_REQUIRED', 'message', 'metadata.mapping_profile_id missing.'))
    );
  end if;

  if v_branch is null or v_biz is null or v_hash is null or length(v_hash) < 8 then
    return jsonb_build_object(
      'ok', false,
      'critical_count', 1,
      'warning_count', 1,
      'message', 'branch_id, business_date, and file hash are required for duplicate-safe cutover.',
      'findings', jsonb_build_array(jsonb_build_object(
        'severity', 'critical',
        'code', 'METADATA_INCOMPLETE',
        'message', 'Populate metadata.branch_id, metadata.business_date, metadata.file_sha256 (or file_hash).'
      ))
    );
  end if;

  select count(*) into v_crit
  from public.import_validation_errors
  where file_id = import_create_cutover_batch.file_id and severity = 'critical';

  if v_crit > 0 then
    return jsonb_build_object(
      'ok', false,
      'critical_count', v_crit,
      'warning_count', 0,
      'message', 'Rows with critical validation errors cannot be cut over.',
      'findings', jsonb_build_array(jsonb_build_object('severity', 'critical', 'code', 'CRITICAL_ROWS', 'message', 'Fix validation errors first.'))
    );
  end if;

  insert into public.import_cutover_batches (
    staging_file_id,
    mapping_profile_id,
    branch_id,
    business_date,
    file_hash,
    status,
    row_count,
    critical_row_count
  )
  values (
    file_id,
    v_profile,
    v_branch,
    v_biz,
    v_hash,
    'ready',
    coalesce(v_file.total_rows, 0),
    0
  )
  returning id into v_new_id;

  return jsonb_build_object(
    'ok', true,
    'critical_count', 0,
    'warning_count', 0,
    'message', 'Cutover batch created.',
    'findings', jsonb_build_array(jsonb_build_object(
      'severity', 'info',
      'code', 'CUTOVER_BATCH_ID',
      'message', v_new_id::text
    ))
  );
end;
$$;

-- --- RPC: rollback request (correction path; no silent delete)
create or replace function public.import_request_rollback(cutover_batch_id uuid, reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch record;
begin
  if not public.app_current_user_has_permission('imports.approve')
     and not public.app_current_user_has_permission('finance.reverse')
     and not public.app_current_user_has_permission('settings.manage') then
    return jsonb_build_object(
      'ok', false,
      'critical_count', 1,
      'warning_count', 0,
      'message', 'Insufficient permission for rollback request.',
      'findings', jsonb_build_array(jsonb_build_object('severity', 'critical', 'code', 'PERMISSION', 'message', 'Rollback permission required.'))
    );
  end if;

  if coalesce(trim(reason), '') = '' then
    return jsonb_build_object(
      'ok', false,
      'critical_count', 1,
      'warning_count', 0,
      'message', 'Rollback requires a reason.',
      'findings', jsonb_build_array(jsonb_build_object('severity', 'critical', 'code', 'REASON_REQUIRED', 'message', 'Provide reason text.'))
    );
  end if;

  select * into v_batch from public.import_cutover_batches where id = cutover_batch_id;
  if not found then
    return jsonb_build_object(
      'ok', false,
      'critical_count', 1,
      'warning_count', 0,
      'message', 'Cutover batch not found.',
      'findings', jsonb_build_array(jsonb_build_object('severity', 'critical', 'code', 'NOT_FOUND', 'message', 'Unknown cutover batch.'))
    );
  end if;

  if v_batch.status <> 'posted' then
    return jsonb_build_object(
      'ok', false,
      'critical_count', 1,
      'warning_count', 0,
      'message', 'Only posted cutover batches can request rollback.',
      'findings', jsonb_build_array(jsonb_build_object('severity', 'critical', 'code', 'NOT_POSTED', 'message', format('Batch status: %s', v_batch.status)))
    );
  end if;

  if v_batch.rollback_status in ('requested', 'applied') then
    return jsonb_build_object(
      'ok', false,
      'critical_count', 1,
      'warning_count', 0,
      'message', 'Rollback already requested or applied.',
      'findings', jsonb_build_array(jsonb_build_object('severity', 'critical', 'code', 'DUPLICATE_ROLLBACK', 'message', 'Cannot roll back twice.'))
    );
  end if;

  insert into public.import_rollback_requests (cutover_batch_id, reason, requested_by)
  values (cutover_batch_id, trim(reason), auth.uid())
  on conflict (cutover_batch_id) do update
    set reason = excluded.reason,
        requested_by = excluded.requested_by,
        status = 'pending';

  update public.import_cutover_batches
  set rollback_status = 'requested', updated_at = now()
  where id = cutover_batch_id;

  return jsonb_build_object(
    'ok', true,
    'critical_count', 0,
    'warning_count', 0,
    'message', 'Rollback request recorded; apply correction postings separately.',
    'findings', '[]'::jsonb
  );
end;
$$;
do $$
begin
  if to_regprocedure('public.import_validate_staging_file(uuid)') is not null then
    execute 'grant execute on function public.import_validate_staging_file(uuid) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.import_approve_staging_file(uuid)') is not null then
    execute 'grant execute on function public.import_approve_staging_file(uuid) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.import_create_cutover_batch(uuid)') is not null then
    execute 'grant execute on function public.import_create_cutover_batch(uuid) to authenticated';
  end if;
end;
$$;
do $$
begin
  if to_regprocedure('public.import_request_rollback(uuid, text)') is not null then
    execute 'grant execute on function public.import_request_rollback(uuid, text) to authenticated';
  end if;
end;
$$;

alter table public.import_mapping_profiles enable row level security;
alter table public.import_mapping_profile_fields enable row level security;
alter table public.import_cutover_batches enable row level security;
alter table public.import_cutover_batch_rows enable row level security;
alter table public.import_rollback_requests enable row level security;
alter table public.import_file_hash_locks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'import_mapping_profiles' and policyname = 'import_mapping_profiles_read'
  ) then
    create policy import_mapping_profiles_read on public.import_mapping_profiles
      for select to authenticated using (
        public.app_current_user_has_permission('imports.create')
        or public.app_current_user_has_permission('imports.approve')
        or public.app_current_user_has_permission('settings.manage')
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'import_cutover_batches' and policyname = 'import_cutover_batches_read'
  ) then
    create policy import_cutover_batches_read on public.import_cutover_batches
      for select to authenticated using (
        public.app_current_user_has_permission('imports.approve')
        or public.app_current_user_has_permission('finance.post')
        or public.app_current_user_has_permission('settings.manage')
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'import_cutover_batches' and policyname = 'import_cutover_batches_write'
  ) then
    create policy import_cutover_batches_write on public.import_cutover_batches
      for all to authenticated using (
        public.app_current_user_has_permission('imports.approve')
        or public.app_current_user_has_permission('settings.manage')
      )
      with check (
        public.app_current_user_has_permission('imports.approve')
        or public.app_current_user_has_permission('settings.manage')
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'import_rollback_requests' and policyname = 'import_rollback_requests_read'
  ) then
    create policy import_rollback_requests_read on public.import_rollback_requests
      for select to authenticated using (
        public.app_current_user_has_permission('imports.approve')
        or public.app_current_user_has_permission('finance.reverse')
        or public.app_current_user_has_permission('settings.manage')
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'import_rollback_requests' and policyname = 'import_rollback_requests_write'
  ) then
    create policy import_rollback_requests_write on public.import_rollback_requests
      for insert to authenticated with check (
        public.app_current_user_has_permission('imports.approve')
        or public.app_current_user_has_permission('finance.reverse')
        or public.app_current_user_has_permission('settings.manage')
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'import_file_hash_locks' and policyname = 'import_file_hash_locks_read'
  ) then
    create policy import_file_hash_locks_read on public.import_file_hash_locks
      for select to authenticated using (
        public.app_current_user_has_permission('imports.create')
        or public.app_current_user_has_permission('imports.approve')
        or public.app_current_user_has_permission('settings.manage')
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'import_mapping_profile_fields' and policyname = 'import_mapping_profile_fields_read'
  ) then
    create policy import_mapping_profile_fields_read on public.import_mapping_profile_fields
      for select to authenticated using (
        public.app_current_user_has_permission('imports.create')
        or public.app_current_user_has_permission('imports.approve')
        or public.app_current_user_has_permission('settings.manage')
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'import_cutover_batch_rows' and policyname = 'import_cutover_batch_rows_read'
  ) then
    create policy import_cutover_batch_rows_read on public.import_cutover_batch_rows
      for select to authenticated using (
        public.app_current_user_has_permission('imports.approve')
        or public.app_current_user_has_permission('finance.post')
        or public.app_current_user_has_permission('settings.manage')
      );
  end if;
end $$;
