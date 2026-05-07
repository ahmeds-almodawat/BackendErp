-- v366 Enterprise Truth & Security Repair
-- Purpose:
-- 1) Add reusable permission/branch guard helpers for RPCs.
-- 2) Add conservative RLS guard policies for late-stage tables that previously had RLS enabled but no policy.
-- 3) Create private document buckets with authenticated storage policies.
--
-- Important design decision for this ZIP:
-- Existing setup persistence tables (v301) use text IDs for branches/stores/items/suppliers.
-- Later migrations are patched to keep those foreign keys as text until a clean UUID baseline is created.

create extension if not exists pgcrypto;

create or replace function public.app_assert_permission(required_permission text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if required_permission is null or btrim(required_permission) = '' then
    raise exception 'permission key is required' using errcode = '22023';
  end if;

  if not coalesce(public.app_current_user_has_permission(required_permission), false) then
    raise exception 'permission denied: %', required_permission using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.app_assert_permission(text) from public;
revoke all on function public.app_assert_permission(text) from anon;
do $$
begin
  if to_regprocedure('public.app_assert_permission(text)') is not null then
    execute 'grant execute on function public.app_assert_permission(text) to authenticated';
  end if;
end;
$$;

create or replace function public.app_current_user_can_access_branch(
  target_branch_id text,
  requested_access text default 'view'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and (
      target_branch_id is null
      or public.app_current_user_has_permission('settings.manage')
      or public.app_current_user_has_permission('branches.manage')
      or exists (
        select 1
        from public.branch_user_assignments bua
        where bua.user_id = auth.uid()
          and bua.branch_id = target_branch_id
          and case lower(coalesce(requested_access, 'view'))
            when 'post' then bua.can_post
            when 'approve' then bua.can_approve or bua.can_post
            when 'create' then bua.can_create or bua.can_approve or bua.can_post
            else bua.can_view or bua.can_create or bua.can_approve or bua.can_post
          end
      )
    );
$$;

revoke all on function public.app_current_user_can_access_branch(text, text) from public;
revoke all on function public.app_current_user_can_access_branch(text, text) from anon;
do $$
begin
  if to_regprocedure('public.app_current_user_can_access_branch(text, text)') is not null then
    execute 'grant execute on function public.app_current_user_can_access_branch(text, text) to authenticated';
  end if;
end;
$$;

-- Tighten core access tables.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'app_user_roles')
     and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'app_user_roles' and policyname = 'v366_user_roles_manage_read') then
    create policy v366_user_roles_manage_read on public.app_user_roles
      for select to authenticated using (
        user_id = auth.uid()
        or public.app_current_user_has_permission('users.manage')
        or public.app_current_user_has_permission('roles.manage')
        or public.app_current_user_has_permission('settings.manage')
      );
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'app_user_roles')
     and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'app_user_roles' and policyname = 'v366_user_roles_manage_write') then
    create policy v366_user_roles_manage_write on public.app_user_roles
      for all to authenticated using (
        public.app_current_user_has_permission('users.manage')
        or public.app_current_user_has_permission('roles.manage')
        or public.app_current_user_has_permission('settings.manage')
      ) with check (
        public.app_current_user_has_permission('users.manage')
        or public.app_current_user_has_permission('roles.manage')
        or public.app_current_user_has_permission('settings.manage')
      );
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'branch_user_assignments')
     and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'branch_user_assignments' and policyname = 'v366_branch_assignments_read') then
    create policy v366_branch_assignments_read on public.branch_user_assignments
      for select to authenticated using (
        user_id = auth.uid()
        or public.app_current_user_has_permission('users.manage')
        or public.app_current_user_has_permission('branches.manage')
        or public.app_current_user_has_permission('settings.manage')
      );
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'branch_user_assignments')
     and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'branch_user_assignments' and policyname = 'v366_branch_assignments_write') then
    create policy v366_branch_assignments_write on public.branch_user_assignments
      for all to authenticated using (
        public.app_current_user_has_permission('users.manage')
        or public.app_current_user_has_permission('branches.manage')
        or public.app_current_user_has_permission('settings.manage')
      ) with check (
        public.app_current_user_has_permission('users.manage')
        or public.app_current_user_has_permission('branches.manage')
        or public.app_current_user_has_permission('settings.manage')
      );
  end if;
end $$;

-- Conservative guard policies for late-stage backend/live tables.
-- These prevent accidental open access, while avoiding complete dead tables in staging.
do $$
declare
  tbl text;
  guarded_tables text[] := array[
    'finance_journal_entries_backend',
    'finance_journal_lines_backend',
    'inventory_stock_movements',
    'inventory_stock_balances',
    'inventory_stock_adjustments',
    'inventory_stock_counts',
    'inventory_stock_count_lines',
    'inventory_lot_tracking',
    'purchase_invoices',
    'purchase_invoice_lines',
    'supplier_payments',
    'sales_pos_batches',
    'production_batches',
    'production_batch_lines',
    'stock_transfer_requests',
    'posting_batches',
    'posting_batch_lines',
    'bank_accounts',
    'bank_transactions',
    'bank_reconciliation_runs',
    'vat_settlement_runs',
    'period_close_runs',
    'live_opening_stock_batches',
    'live_purchase_receipts',
    'live_sales_posting_runs',
    'live_vat_settlement_runs',
    'live_audit_events',
    'final_enterprise_readiness_snapshots',
    'reporting_truth_snapshots',
    'reporting_truth_findings'
  ];
begin
  foreach tbl in array guarded_tables loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = tbl) then
      execute format('alter table public.%I enable row level security', tbl);

      if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = tbl and policyname = 'v366_enterprise_read_guard') then
        execute format(
          'create policy %I on public.%I for select to authenticated using (public.app_current_user_has_permission(''settings.manage'') or public.app_current_user_has_permission(''reports.view'') or public.app_current_user_has_permission(''finance.view'') or public.app_current_user_has_permission(''inventory.view''))',
          'v366_enterprise_read_guard',
          tbl
        );
      end if;

      if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = tbl and policyname = 'v366_enterprise_write_guard') then
        execute format(
          'create policy %I on public.%I for all to authenticated using (public.app_current_user_has_permission(''settings.manage'')) with check (public.app_current_user_has_permission(''settings.manage''))',
          'v366_enterprise_write_guard',
          tbl
        );
      end if;
    end if;
  end loop;
end $$;

-- Private storage buckets for enterprise source documents.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('supplier-documents', 'supplier-documents', false, 52428800, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']::text[]),
  ('purchase-documents', 'purchase-documents', false, 52428800, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']::text[]),
  ('finance-documents', 'finance-documents', false, 52428800, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']::text[]),
  ('stock-count-documents', 'stock-count-documents', false, 52428800, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'v366_enterprise_docs_read') then
    create policy v366_enterprise_docs_read on storage.objects
      for select to authenticated using (
        bucket_id in ('supplier-documents', 'purchase-documents', 'finance-documents', 'stock-count-documents')
        and (
          public.app_current_user_has_permission('settings.manage')
          or public.app_current_user_has_permission('finance.view')
          or public.app_current_user_has_permission('purchasing.create')
          or public.app_current_user_has_permission('inventory.view')
          or owner = auth.uid()
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'v366_enterprise_docs_insert') then
    create policy v366_enterprise_docs_insert on storage.objects
      for insert to authenticated with check (
        bucket_id in ('supplier-documents', 'purchase-documents', 'finance-documents', 'stock-count-documents')
        and (
          public.app_current_user_has_permission('settings.manage')
          or public.app_current_user_has_permission('finance.post')
          or public.app_current_user_has_permission('purchasing.create')
          or public.app_current_user_has_permission('inventory.adjust')
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'v366_enterprise_docs_update_delete') then
    create policy v366_enterprise_docs_update_delete on storage.objects
      for all to authenticated using (
        bucket_id in ('supplier-documents', 'purchase-documents', 'finance-documents', 'stock-count-documents')
        and public.app_current_user_has_permission('settings.manage')
      ) with check (
        bucket_id in ('supplier-documents', 'purchase-documents', 'finance-documents', 'stock-count-documents')
        and public.app_current_user_has_permission('settings.manage')
      );
  end if;
end $$;
