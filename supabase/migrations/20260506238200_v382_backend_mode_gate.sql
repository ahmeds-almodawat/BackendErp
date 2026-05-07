-- v382 Backend Mode Cutover Gate
-- Records backend-mode/cutover gate evidence. This is evidence-only and does not
-- modify accounting, inventory, or posting records.

create extension if not exists pgcrypto;

create table if not exists public.backend_mode_gate_snapshots (
  id uuid primary key default gen_random_uuid(),
  runtime_mode text not null default 'local-demo',
  gate_status text not null default 'safe-local',
  gate_score integer not null default 0,
  backend_configured boolean not null default false,
  auth_required boolean not null default false,
  branch_scope_required boolean not null default false,
  demo_data_allowed boolean not null default true,
  service_role_exposure boolean not null default false,
  findings jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.backend_mode_gate_events (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid references public.backend_mode_gate_snapshots(id) on delete set null,
  event_type text not null,
  severity text not null default 'info',
  message text,
  details jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists backend_mode_gate_snapshots_created_idx on public.backend_mode_gate_snapshots(created_at desc, runtime_mode, gate_status);
create index if not exists backend_mode_gate_events_snapshot_idx on public.backend_mode_gate_events(snapshot_id, event_type, created_at desc);

alter table public.backend_mode_gate_snapshots enable row level security;
alter table public.backend_mode_gate_events enable row level security;

drop policy if exists backend_mode_gate_snapshots_read_authenticated_v382 on public.backend_mode_gate_snapshots;
create policy backend_mode_gate_snapshots_read_authenticated_v382
on public.backend_mode_gate_snapshots
for select to authenticated
using (true);

drop policy if exists backend_mode_gate_events_read_authenticated_v382 on public.backend_mode_gate_events;
create policy backend_mode_gate_events_read_authenticated_v382
on public.backend_mode_gate_events
for select to authenticated
using (true);

create or replace function public.backend_mode_gate_event(
  p_snapshot_id uuid,
  p_event_type text,
  p_severity text default 'info',
  p_message text default null,
  p_details jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.backend_mode_gate_events(snapshot_id, event_type, severity, message, details, created_by)
  values (p_snapshot_id, coalesce(nullif(p_event_type, ''), 'backend_mode.event'), coalesce(nullif(p_severity, ''), 'info'), p_message, coalesce(p_details, '{}'::jsonb), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.backend_mode_gate_event(uuid, text, text, text, jsonb) from public;
grant execute on function public.backend_mode_gate_event(uuid, text, text, text, jsonb) to authenticated;
