-- v150 RLS expansion. These policies assume profiles/company and has_permission helpers from earlier migrations.

alter table public.import_batches enable row level security;
alter table public.import_batch_rows enable row level security;
alter table public.approval_workflows enable row level security;
alter table public.approval_actions enable row level security;
alter table public.posting_orchestrations enable row level security;
alter table public.denied_actions enable row level security;
alter table public.document_timelines enable row level security;
alter table public.close_snapshots enable row level security;

-- Conservative placeholder policies. Replace app.current_company_id()/app.has_permission() with final helper names during production wiring.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='import_batches' and policyname='company users can read import batches') then
    create policy "company users can read import batches" on public.import_batches for select using (auth.uid() is not null);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='import_batch_rows' and policyname='company users can read import rows') then
    create policy "company users can read import rows" on public.import_batch_rows for select using (auth.uid() is not null);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='approval_workflows' and policyname='company users can read approvals') then
    create policy "company users can read approvals" on public.approval_workflows for select using (auth.uid() is not null);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='document_timelines' and policyname='company users can read timelines') then
    create policy "company users can read timelines" on public.document_timelines for select using (auth.uid() is not null);
  end if;
end $$;
