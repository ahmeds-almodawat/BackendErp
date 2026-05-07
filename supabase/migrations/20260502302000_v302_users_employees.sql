create table if not exists public.employees (
  id text primary key,
  company_id uuid references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  branch_id text references public.branches(id),
  department text,
  job_title text,
  salary numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id, code)
);

create table if not exists public.user_accounts (
  id text primary key,
  company_id uuid references public.companies(id) on delete cascade,
  employee_id text references public.employees(id) on delete restrict,
  auth_user_id uuid references auth.users(id),
  email text not null,
  display_name text,
  status text not null default 'invited' check (status in ('invited','active','disabled')),
  auth_provider text not null default 'local' check (auth_provider in ('local','supabase')),
  must_change_password boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id, email),
  unique(company_id, employee_id)
);

create table if not exists public.user_access_scopes (
  id text primary key,
  company_id uuid references public.companies(id) on delete cascade,
  employee_id text references public.employees(id) on delete cascade,
  role_id text,
  scope_type text not null default 'all',
  scope_id text not null default 'all',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.employees enable row level security;
alter table public.user_accounts enable row level security;
alter table public.user_access_scopes enable row level security;

do $$ begin
  create policy "authenticated read employees" on public.employees for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated read user accounts" on public.user_accounts for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated read access scopes" on public.user_access_scopes for select to authenticated using (true);
exception when duplicate_object then null; end $$;

insert into public.audit_events (action, entity, entity_ref, note, metadata)
values ('migration', 'v302', 'users_employees', 'Added user creation tables with mandatory linked employee pattern', '{}'::jsonb);
