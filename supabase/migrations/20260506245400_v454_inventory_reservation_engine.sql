-- v454 Inventory Reservation + Internal Issue Evidence
-- Adds reservation/issue tables that match the local v454 material-request decision engine.

create extension if not exists pgcrypto;

create table if not exists public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  reservation_date date not null default current_date,
  request_id text,
  request_ref text,
  request_line_id text,
  branch_id text,
  store_id text not null,
  item_id text not null,
  qty numeric not null check (qty > 0),
  status text not null default 'reserved' check (status in ('reserved','issued','released','cancelled')),
  reserved_by uuid references auth.users(id),
  issued_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.internal_stock_issues (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  issue_date date not null default current_date,
  request_id text,
  request_ref text,
  from_store_id text not null,
  to_store_id text not null,
  item_id text not null,
  qty numeric not null check (qty > 0),
  status text not null default 'posted' check (status in ('draft','posted','cancelled')),
  movement_out_id text,
  movement_in_id text,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_reservation_events (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references public.inventory_reservations(id) on delete set null,
  issue_id uuid references public.internal_stock_issues(id) on delete set null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  message text,
  details jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists inventory_reservations_request_idx on public.inventory_reservations(request_ref, request_line_id, status);
create index if not exists inventory_reservations_stock_idx on public.inventory_reservations(store_id, item_id, status);
create index if not exists internal_stock_issues_request_idx on public.internal_stock_issues(request_ref, status, issue_date desc);
create index if not exists inventory_reservation_events_idx on public.inventory_reservation_events(event_type, created_at desc);

alter table public.inventory_reservations enable row level security;
alter table public.internal_stock_issues enable row level security;
alter table public.inventory_reservation_events enable row level security;

drop policy if exists inventory_reservations_read_authenticated_v454 on public.inventory_reservations;
create policy inventory_reservations_read_authenticated_v454 on public.inventory_reservations for select to authenticated using (true);

drop policy if exists internal_stock_issues_read_authenticated_v454 on public.internal_stock_issues;
create policy internal_stock_issues_read_authenticated_v454 on public.internal_stock_issues for select to authenticated using (true);

drop policy if exists inventory_reservation_events_read_authenticated_v454 on public.inventory_reservation_events;
create policy inventory_reservation_events_read_authenticated_v454 on public.inventory_reservation_events for select to authenticated using (true);

create or replace function public.inventory_reservation_snapshot_v454()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'reservedQty', coalesce((select sum(qty) from public.inventory_reservations where status = 'reserved'), 0),
    'issuedQty', coalesce((select sum(qty) from public.inventory_reservations where status = 'issued'), 0),
    'reservationRows', coalesce((select count(*) from public.inventory_reservations), 0),
    'issueRows', coalesce((select count(*) from public.internal_stock_issues), 0)
  );
$$;

do $$
begin
  if to_regprocedure('public.inventory_reservation_snapshot_v454()') is not null then
    execute 'grant execute on function public.inventory_reservation_snapshot_v454() to authenticated';
  end if;
end;
$$;
