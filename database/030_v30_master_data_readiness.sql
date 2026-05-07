-- V30 Master Data Readiness + Foodics Mapping Center
-- Backend design notes for production Supabase migration.

create table if not exists public.foodics_mapping_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  profile_name text not null,
  profile_type text not null check (profile_type in ('branch','item','payment','order_type','cashier')),
  foodics_key text not null,
  foodics_label text,
  erp_target_id text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id, profile_type, foodics_key)
);

create table if not exists public.sales_import_readiness_checks (
  id uuid primary key default gen_random_uuid(),
  sales_import_batch_id uuid,
  check_key text not null,
  check_status text not null check (check_status in ('ready','warning','blocked')),
  detail text,
  created_at timestamptz not null default now()
);

create table if not exists public.sales_import_posting_modes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_en text not null,
  name_ar text not null,
  posts_gl boolean not null default false,
  posts_inventory boolean not null default false,
  requires_recipe boolean not null default false,
  requires_cost boolean not null default false
);

insert into public.sales_import_posting_modes (code, name_en, name_ar, posts_gl, posts_inventory, requires_recipe, requires_cost)
values
('report_only','Report only','تقارير فقط', false, false, false, false),
('sales_accounting_only','Sales accounting only','ترحيل المبيعات مالياً فقط', true, false, false, false),
('full_erp_posting','Full ERP posting','ترحيل كامل مع المخزون', true, true, true, true)
on conflict (code) do nothing;
