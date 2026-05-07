-- v456-v470 Restaurant Operations Workflow Evidence
-- Adds evidence tables for material request fulfillment decisions, reservation/transfer/issue proof,
-- supplier split planning, and Batch No. / FEFO governance. This migration is evidence-first
-- and does not mutate live stock or finance postings.

create extension if not exists pgcrypto;

create table if not exists public.restaurant_ops_workflow_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null default 'restaurant_ops_workflow',
  status text not null default 'draft' check (status in ('draft', 'ready_for_pilot', 'needs_review', 'blocked')),
  score numeric not null default 0,
  open_request_count integer not null default 0,
  reservation_count integer not null default 0,
  transfer_count integer not null default 0,
  internal_issue_count integer not null default 0,
  shortage_po_group_count integer not null default 0,
  batch_control_count integer not null default 0,
  evidence jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.restaurant_ops_material_request_decisions (
  id uuid primary key default gen_random_uuid(),
  request_id text,
  request_ref text,
  request_line_id text,
  branch_id text,
  requesting_store_id text,
  source_store_id text,
  item_id text,
  requested_qty numeric not null default 0,
  on_hand_qty numeric not null default 0,
  reserved_qty numeric not null default 0,
  free_qty numeric not null default 0,
  reserve_qty numeric not null default 0,
  shortage_qty numeric not null default 0,
  decision text not null default 'review' check (decision in ('reserve_transfer', 'reserve_issue', 'partial_reserve_shortage_po', 'shortage_po', 'refuse', 'delete', 'review')),
  supplier_id text,
  decision_by uuid,
  decision_at timestamptz,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.restaurant_ops_fulfillment_documents (
  id uuid primary key default gen_random_uuid(),
  request_id text,
  request_ref text,
  fulfillment_type text not null check (fulfillment_type in ('store_transfer', 'internal_issue', 'production_issue', 'shortage_po', 'refusal')),
  source_store_id text,
  destination_store_id text,
  destination_cost_center_id text,
  production_batch_id text,
  supplier_id text,
  document_ref text not null,
  status text not null default 'draft' check (status in ('draft', 'posted', 'cancelled', 'closed')),
  line_count integer not null default 0,
  total_qty numeric not null default 0,
  evidence jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create table if not exists public.restaurant_ops_supplier_split_plan (
  id uuid primary key default gen_random_uuid(),
  request_id text,
  request_ref text,
  supplier_id text,
  supplier_name text,
  po_ref text,
  status text not null default 'planned' check (status in ('planned', 'po_created', 'cancelled', 'closed')),
  line_count integer not null default 0,
  estimated_value numeric not null default 0,
  lines jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.restaurant_ops_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  entity_type text,
  entity_id text,
  message text,
  details jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists restaurant_ops_snapshots_created_idx on public.restaurant_ops_workflow_snapshots(created_at desc, status);
create index if not exists restaurant_ops_mr_decisions_request_idx on public.restaurant_ops_material_request_decisions(request_ref, item_id, decision);
create index if not exists restaurant_ops_fulfillment_request_idx on public.restaurant_ops_fulfillment_documents(request_ref, fulfillment_type, status);
create index if not exists restaurant_ops_supplier_split_request_idx on public.restaurant_ops_supplier_split_plan(request_ref, supplier_id, status);
create index if not exists restaurant_ops_events_created_idx on public.restaurant_ops_events(created_at desc, event_type, severity);

alter table public.restaurant_ops_workflow_snapshots enable row level security;
alter table public.restaurant_ops_material_request_decisions enable row level security;
alter table public.restaurant_ops_fulfillment_documents enable row level security;
alter table public.restaurant_ops_supplier_split_plan enable row level security;
alter table public.restaurant_ops_events enable row level security;

drop policy if exists restaurant_ops_snapshots_read_authenticated_v456 on public.restaurant_ops_workflow_snapshots;
create policy restaurant_ops_snapshots_read_authenticated_v456 on public.restaurant_ops_workflow_snapshots for select to authenticated using (true);

drop policy if exists restaurant_ops_decisions_read_authenticated_v456 on public.restaurant_ops_material_request_decisions;
create policy restaurant_ops_decisions_read_authenticated_v456 on public.restaurant_ops_material_request_decisions for select to authenticated using (true);

drop policy if exists restaurant_ops_fulfillment_read_authenticated_v456 on public.restaurant_ops_fulfillment_documents;
create policy restaurant_ops_fulfillment_read_authenticated_v456 on public.restaurant_ops_fulfillment_documents for select to authenticated using (true);

drop policy if exists restaurant_ops_supplier_split_read_authenticated_v456 on public.restaurant_ops_supplier_split_plan;
create policy restaurant_ops_supplier_split_read_authenticated_v456 on public.restaurant_ops_supplier_split_plan for select to authenticated using (true);

drop policy if exists restaurant_ops_events_read_authenticated_v456 on public.restaurant_ops_events;
create policy restaurant_ops_events_read_authenticated_v456 on public.restaurant_ops_events for select to authenticated using (true);

create or replace function public.restaurant_ops_workflow_snapshot_v456()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb := '{}'::jsonb;
  v_table text;
  v_count bigint;
  v_tables text[] := array[
    'material_requests',
    'inventory_reservations',
    'internal_stock_issues',
    'stock_transfers',
    'purchase_orders',
    'goods_receipts',
    'inventory_lots',
    'restaurant_ops_material_request_decisions',
    'restaurant_ops_fulfillment_documents',
    'restaurant_ops_supplier_split_plan'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass('public.' || v_table) is not null then
      execute format('select count(*) from public.%I', v_table) into v_count;
      v_result := v_result || jsonb_build_object(v_table, v_count);
    else
      v_result := v_result || jsonb_build_object(v_table, null);
    end if;
  end loop;

  return v_result || jsonb_build_object(
    'version', 'v456-v470',
    'purpose', 'Restaurant material request to reservation/transfer/issue/shortage-PO workflow evidence',
    'generatedAt', now()
  );
end;
$$;

revoke all on function public.restaurant_ops_workflow_snapshot_v456() from public;
grant execute on function public.restaurant_ops_workflow_snapshot_v456() to authenticated;

insert into public.restaurant_ops_events(event_type, severity, entity_type, entity_id, message, details)
values (
  'v456_v470.installed',
  'info',
  'migration',
  '20260506245600',
  'Restaurant operations workflow evidence tables installed.',
  jsonb_build_object('features', array['material request decisioning', 'reservation evidence', 'store transfer/internal issue proof', 'supplier split plan', 'batch no / FEFO governance'])
);
