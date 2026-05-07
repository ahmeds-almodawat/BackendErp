-- v455 Material Request Fulfillment Cycle
-- Clarifies the end of a material request: store transfer, internal issue, or shortage PO.

create extension if not exists pgcrypto;

create table if not exists public.material_request_fulfillment_events (
  id uuid primary key default gen_random_uuid(),
  request_id text,
  request_ref text,
  fulfillment_ref text,
  fulfillment_mode text not null default 'store_transfer' check (fulfillment_mode in ('store_transfer','internal_issue','production_issue','shortage_po','refused','deleted')),
  source_store_id text,
  destination_store_id text,
  item_id text,
  qty numeric not null default 0,
  status text not null default 'posted',
  details jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

alter table if exists public.internal_stock_issues add column if not exists fulfillment_mode text;
alter table if exists public.internal_stock_issues add column if not exists transfer_id text;
alter table if exists public.internal_stock_issues add column if not exists cost_center_id text;
alter table if exists public.internal_stock_issues add column if not exists production_batch_id text;

alter table if exists public.transfers add column if not exists request_id text;
alter table if exists public.transfers add column if not exists request_ref text;
alter table if exists public.transfers add column if not exists fulfillment_mode text not null default 'store_transfer';

create index if not exists material_request_fulfillment_events_request_idx
  on public.material_request_fulfillment_events(request_id, request_ref, created_at desc);

create index if not exists material_request_fulfillment_events_mode_idx
  on public.material_request_fulfillment_events(fulfillment_mode, status, created_at desc);

alter table public.material_request_fulfillment_events enable row level security;

drop policy if exists material_request_fulfillment_events_read_authenticated_v455 on public.material_request_fulfillment_events;
create policy material_request_fulfillment_events_read_authenticated_v455
  on public.material_request_fulfillment_events
  for select
  to authenticated
  using (true);

create or replace function public.material_request_fulfillment_snapshot_v455()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb := '{}'::jsonb;
  v_events bigint := 0;
  v_transfers bigint := 0;
  v_issues bigint := 0;
begin
  if to_regclass('public.material_request_fulfillment_events') is not null then
    select count(*) into v_events from public.material_request_fulfillment_events;
  end if;

  if to_regclass('public.transfers') is not null then
    execute 'select count(*) from public.transfers where coalesce(fulfillment_mode, '''') = ''store_transfer''' into v_transfers;
  end if;

  if to_regclass('public.internal_stock_issues') is not null then
    execute 'select count(*) from public.internal_stock_issues where coalesce(fulfillment_mode, '''') in (''internal_issue'',''production_issue'')' into v_issues;
  end if;

  v_result := jsonb_build_object(
    'version', 'v455',
    'events', v_events,
    'storeTransfers', v_transfers,
    'internalIssues', v_issues,
    'cycle', jsonb_build_array(
      'Material Request',
      'Reservation',
      'Store Transfer or Internal Issue',
      'Shortage PO only if needed',
      'Closed Request'
    )
  );

  return v_result;
end;
$$;

revoke all on function public.material_request_fulfillment_snapshot_v455() from public;
grant execute on function public.material_request_fulfillment_snapshot_v455() to authenticated;
