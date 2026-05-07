
-- v452 Pilot Automation Safety Evidence
-- Metadata only. The browser automation remains local/demo and must not create production records.
create extension if not exists pgcrypto;
create table if not exists public.pilot_automation_runs (id uuid primary key default gen_random_uuid(), run_key text not null default 'pilot-automation', mode text not null default 'local-demo-only', status text not null default 'draft', started_by uuid, started_at timestamptz not null default now(), completed_at timestamptz, step_count integer not null default 0, applied_step_count integer not null default 0, evidence jsonb not null default '{}'::jsonb, warnings jsonb not null default '[]'::jsonb);
create table if not exists public.pilot_automation_events (id uuid primary key default gen_random_uuid(), run_id uuid references public.pilot_automation_runs(id) on delete set null, step_key text, event_type text not null, severity text not null default 'info', message text, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table if not exists public.pilot_automation_step_catalog (step_key text primary key, sequence integer not null, module text not null, title text not null, safety_level text not null default 'local-demo-only', effect text not null, proof_required text not null, created_at timestamptz not null default now());
insert into public.pilot_automation_step_catalog(step_key, sequence, module, title, safety_level, effect, proof_required) values
('seed.masters',1,'Setup','Create pilot master data','local-demo-only','Creates branch, stores, supplier, items, menu, recipe, accounts, and period.','Master-data counts and audit evidence.'),
('post.purchase.invoice',2,'Purchasing','Create and post purchase invoice','local-demo-only','Creates invoice, stock, AP, VAT, and GL evidence.','Invoice, movements, and balanced journal.'),
('post.supplier.payment',3,'AP','Create and post supplier payment','local-demo-only','Creates payment and AP settlement evidence.','Payment and balanced journal.'),
('post.production.batch',4,'Production','Create and post production batch','local-demo-only','Creates production consumption/output evidence.','Production, movements, and journal.'),
('post.pos.day',5,'Sales','Create and post POS day','local-demo-only','Creates sales, VAT, settlement, and COGS evidence.','Sale, movements, and balanced journal.'),
('post.stock.adjustment',6,'Inventory','Create and post stock adjustment','local-demo-only','Creates damage adjustment and variance evidence.','Adjustment, movement, and journal.'),
('close.vat.period',7,'Finance','Settle VAT and close period','local-demo-only','Creates VAT settlement and close evidence.','VAT journal and period evidence.')
on conflict (step_key) do update set sequence=excluded.sequence,module=excluded.module,title=excluded.title,safety_level=excluded.safety_level,effect=excluded.effect,proof_required=excluded.proof_required;
alter table public.pilot_automation_runs enable row level security;
alter table public.pilot_automation_events enable row level security;
alter table public.pilot_automation_step_catalog enable row level security;
drop policy if exists pilot_automation_runs_read_authenticated_v452 on public.pilot_automation_runs;
create policy pilot_automation_runs_read_authenticated_v452 on public.pilot_automation_runs for select to authenticated using (true);
drop policy if exists pilot_automation_events_read_authenticated_v452 on public.pilot_automation_events;
create policy pilot_automation_events_read_authenticated_v452 on public.pilot_automation_events for select to authenticated using (true);
drop policy if exists pilot_automation_step_catalog_read_authenticated_v452 on public.pilot_automation_step_catalog;
create policy pilot_automation_step_catalog_read_authenticated_v452 on public.pilot_automation_step_catalog for select to authenticated using (true);
create or replace function public.pilot_automation_catalog() returns jsonb language sql stable security definer set search_path = public as $$ select coalesce(jsonb_agg(to_jsonb(c) order by c.sequence), '[]'::jsonb) from public.pilot_automation_step_catalog c; $$;
grant execute on function public.pilot_automation_catalog() to authenticated;
