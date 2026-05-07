-- v310 Enterprise Foundation Cutover
-- Purpose:
-- Adds production-grade foundation tables for branches, permissions, fiscal periods,
-- activity logs, and import staging. This is a foundation layer and does not replace
-- existing app tables yet.

create extension if not exists pgcrypto;

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_en text not null,
  name_ar text not null,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  is_head_office boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_permissions (
  key text primary key,
  module text not null,
  label text not null,
  description text,
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high', 'critical')),
  production_required boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.app_roles (
  key text primary key,
  name text not null,
  description text,
  is_system_role boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.app_role_permissions (
  role_key text not null references public.app_roles(key) on delete cascade,
  permission_key text not null references public.app_permissions(key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_key, permission_key)
);

create table if not exists public.app_user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_key text not null references public.app_roles(key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_key)
);

create table if not exists public.branch_user_assignments (
  user_id uuid not null references auth.users(id) on delete cascade,
  branch_id text not null references public.branches(id) on delete cascade,
  can_view boolean not null default true,
  can_create boolean not null default false,
  can_approve boolean not null default false,
  can_post boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, branch_id)
);

create table if not exists public.fiscal_periods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  fiscal_year int not null,
  fiscal_month int check (fiscal_month between 1 and 12),
  starts_at date not null,
  ends_at date not null,
  status text not null default 'open' check (status in ('open', 'locked', 'closed')),
  closed_by uuid references auth.users(id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint fiscal_period_date_order check (starts_at <= ends_at)
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  action text not null,
  module text not null,
  entity_type text,
  entity_id text,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.import_staging_files (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  file_name text not null,
  file_mime_type text,
  file_size_bytes bigint,
  status text not null default 'uploaded' check (
    status in ('uploaded', 'mapped', 'validated', 'has_errors', 'approved', 'posted', 'rolled_back', 'cancelled')
  ),
  storage_path text,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now(),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  posted_by uuid references auth.users(id),
  posted_at timestamptz,
  total_rows int not null default 0,
  valid_rows int not null default 0,
  error_rows int not null default 0,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.import_staging_rows (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.import_staging_files(id) on delete cascade,
  row_number int not null,
  raw_data jsonb not null default '{}'::jsonb,
  mapped_data jsonb not null default '{}'::jsonb,
  is_valid boolean not null default false,
  created_at timestamptz not null default now(),
  unique (file_id, row_number)
);

create table if not exists public.import_validation_errors (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.import_staging_files(id) on delete cascade,
  row_id uuid references public.import_staging_rows(id) on delete cascade,
  row_number int,
  field_name text,
  error_code text not null,
  error_message text not null,
  severity text not null default 'error' check (severity in ('warning', 'error', 'critical')),
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_logs_user_created on public.activity_logs(user_id, created_at desc);
create index if not exists idx_activity_logs_module_created on public.activity_logs(module, created_at desc);
create index if not exists idx_import_staging_files_status on public.import_staging_files(status);
-- v310 compatibility repair:
-- Earlier migrations may have created public.import_staging_rows without these v310 columns.
alter table public.import_staging_rows add column if not exists file_id uuid;
alter table public.import_staging_rows add column if not exists row_number integer;
alter table public.import_staging_rows add column if not exists raw_data jsonb not null default '{}'::jsonb;
alter table public.import_staging_rows add column if not exists mapped_data jsonb not null default '{}'::jsonb;
alter table public.import_staging_rows add column if not exists is_valid boolean not null default false;
alter table public.import_staging_rows add column if not exists created_at timestamptz not null default now();

do $$
begin
  if to_regclass('public.import_staging_files') is not null
     and not exists (
       select 1
       from pg_constraint
       where conname = 'import_staging_rows_file_id_fkey'
         and conrelid = 'public.import_staging_rows'::regclass
     )
  then
    alter table public.import_staging_rows
      add constraint import_staging_rows_file_id_fkey
      foreign key (file_id) references public.import_staging_files(id) on delete cascade;
  end if;
end;
$$;

create unique index if not exists import_staging_rows_file_row_uidx
on public.import_staging_rows(file_id, row_number)
where file_id is not null and row_number is not null;

create index if not exists idx_import_staging_rows_file on public.import_staging_rows(file_id);
create index if not exists idx_import_validation_errors_file on public.import_validation_errors(file_id);
create index if not exists idx_branch_user_assignments_user on public.branch_user_assignments(user_id);
create index if not exists idx_branch_user_assignments_branch on public.branch_user_assignments(branch_id);

insert into public.app_permissions (key, module, label, description, risk_level, production_required)
values
  ('users.manage', 'access', 'Manage users', 'Create, update, deactivate, and assign users.', 'critical', true),
  ('roles.manage', 'access', 'Manage roles', 'Create roles and assign permissions.', 'critical', true),
  ('branches.manage', 'branches', 'Manage branches', 'Create and maintain branches and branch assignments.', 'high', true),
  ('setup.manage', 'setup', 'Manage setup', 'Maintain master data.', 'high', true),
  ('finance.view', 'finance', 'View finance', 'View finance records and finance reports.', 'high', true),
  ('finance.post', 'finance', 'Post finance transactions', 'Post journals, invoices, payments, openings, and adjustments.', 'critical', true),
  ('finance.reverse', 'finance', 'Reverse finance transactions', 'Reverse official posted accounting batches.', 'critical', true),
  ('inventory.view', 'inventory', 'View inventory', 'View stock, movements, costing, and valuation reports.', 'medium', true),
  ('inventory.adjust', 'inventory', 'Adjust inventory', 'Create stock adjustments, counts, wastage, and movement corrections.', 'critical', true),
  ('purchasing.create', 'purchasing', 'Create purchasing records', 'Create suppliers, purchase invoices, and purchase documents.', 'high', true),
  ('purchasing.approve', 'purchasing', 'Approve purchasing', 'Approve purchase invoices and purchasing workflows.', 'critical', true),
  ('sales.import', 'sales', 'Import sales/POS reports', 'Import POS/Foodics reports into staging.', 'high', true),
  ('reports.view', 'analytics', 'View reports', 'View Smart Analysis and reports.', 'medium', true),
  ('reports.export', 'analytics', 'Export reports', 'Export reporting outputs.', 'medium', true),
  ('imports.create', 'imports', 'Create imports', 'Upload and stage import files.', 'high', true),
  ('imports.approve', 'imports', 'Approve imports', 'Approve import batches before official posting.', 'critical', true),
  ('settings.manage', 'setup', 'Manage settings', 'Change production and system settings.', 'critical', true)
on conflict (key) do update set
  module = excluded.module,
  label = excluded.label,
  description = excluded.description,
  risk_level = excluded.risk_level,
  production_required = excluded.production_required;

insert into public.app_roles (key, name, description, is_system_role)
values
  ('owner', 'Owner / System Administrator', 'Full system authority.', true),
  ('finance_manager', 'Finance Manager', 'Finance posting, reporting, and period control.', true),
  ('inventory_manager', 'Inventory Manager', 'Inventory control and stock adjustments.', true),
  ('branch_manager', 'Branch Manager', 'Branch-level operations and reporting.', true),
  ('report_viewer', 'Report Viewer', 'Read-only reporting access.', true),
  ('import_operator', 'Import Operator', 'Can upload and stage import files.', true)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  is_system_role = excluded.is_system_role;

insert into public.app_role_permissions (role_key, permission_key)
select 'owner', key from public.app_permissions
on conflict do nothing;

insert into public.app_role_permissions (role_key, permission_key)
values
  ('finance_manager', 'finance.view'),
  ('finance_manager', 'finance.post'),
  ('finance_manager', 'finance.reverse'),
  ('finance_manager', 'reports.view'),
  ('finance_manager', 'reports.export'),
  ('inventory_manager', 'inventory.view'),
  ('inventory_manager', 'inventory.adjust'),
  ('inventory_manager', 'reports.view'),
  ('branch_manager', 'reports.view'),
  ('branch_manager', 'purchasing.create'),
  ('branch_manager', 'inventory.view'),
  ('report_viewer', 'reports.view'),
  ('import_operator', 'imports.create'),
  ('import_operator', 'sales.import')
on conflict do nothing;

create or replace function public.app_current_user_has_permission(permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_user_roles ur
    join public.app_role_permissions rp on rp.role_key = ur.role_key
    where ur.user_id = auth.uid()
      and rp.permission_key = permission_key
  );
$$;

create or replace function public.app_log_activity(
  action text,
  module text,
  description text,
  entity_type text default null,
  entity_id text default null,
  severity text default 'info',
  metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.activity_logs (
    user_id,
    action,
    module,
    entity_type,
    entity_id,
    severity,
    description,
    metadata
  )
  values (
    auth.uid(),
    action,
    module,
    entity_type,
    entity_id,
    severity,
    description,
    metadata
  )
  returning id into new_id;

  return new_id;
end;
$$;

alter table public.branches enable row level security;
alter table public.app_permissions enable row level security;
alter table public.app_roles enable row level security;
alter table public.app_role_permissions enable row level security;
alter table public.app_user_roles enable row level security;
alter table public.branch_user_assignments enable row level security;
alter table public.fiscal_periods enable row level security;
alter table public.activity_logs enable row level security;
alter table public.import_staging_files enable row level security;
alter table public.import_staging_rows enable row level security;
alter table public.import_validation_errors enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'branches' and policyname = 'branches_authenticated_read'
  ) then
    create policy branches_authenticated_read on public.branches
      for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'app_permissions' and policyname = 'app_permissions_authenticated_read'
  ) then
    create policy app_permissions_authenticated_read on public.app_permissions
      for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'app_roles' and policyname = 'app_roles_authenticated_read'
  ) then
    create policy app_roles_authenticated_read on public.app_roles
      for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'fiscal_periods' and policyname = 'fiscal_periods_authenticated_read'
  ) then
    create policy fiscal_periods_authenticated_read on public.fiscal_periods
      for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'activity_logs' and policyname = 'activity_logs_user_insert'
  ) then
    create policy activity_logs_user_insert on public.activity_logs
      for insert to authenticated with check (user_id = auth.uid() or user_id is null);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'activity_logs' and policyname = 'activity_logs_admin_read'
  ) then
    create policy activity_logs_admin_read on public.activity_logs
      for select to authenticated using (public.app_current_user_has_permission('settings.manage'));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'import_staging_files' and policyname = 'import_staging_files_owner_read'
  ) then
    create policy import_staging_files_owner_read on public.import_staging_files
      for select to authenticated using (
        uploaded_by = auth.uid()
        or public.app_current_user_has_permission('imports.approve')
        or public.app_current_user_has_permission('settings.manage')
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'import_staging_files' and policyname = 'import_staging_files_create'
  ) then
    create policy import_staging_files_create on public.import_staging_files
      for insert to authenticated with check (
        uploaded_by = auth.uid()
        and public.app_current_user_has_permission('imports.create')
      );
  end if;
end $$;
