-- v31 Foodics persistence / future Supabase design
-- This file is a backend design placeholder for the next migration phase.

create table if not exists public.foodics_import_batches (
  id uuid primary key default gen_random_uuid(),
  batch_ref text not null unique,
  business_date_from date,
  business_date_to date,
  mode text not null check (mode in ('report','sales','full')),
  status text not null check (status in ('uploaded','validated','report_only','posted_sales','posted_full','reversed','cancelled')),
  order_count integer not null default 0,
  line_count integer not null default 0,
  payment_count integer not null default 0,
  order_gross numeric(14,2) not null default 0,
  payment_total numeric(14,2) not null default 0,
  reconciliation_difference numeric(14,2) not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  posted_by uuid,
  posted_at timestamptz,
  reversed_by uuid,
  reversed_at timestamptz,
  reversal_reason text
);

create table if not exists public.foodics_import_mappings (
  id uuid primary key default gen_random_uuid(),
  mapping_type text not null check (mapping_type in ('branch','item','payment_method','cashier','order_type')),
  foodics_key text not null,
  foodics_label text,
  erp_target_id text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(mapping_type, foodics_key)
);

create table if not exists public.foodics_import_files (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.foodics_import_batches(id) on delete cascade,
  file_name text not null,
  detected_kind text not null,
  row_count integer not null default 0,
  uploaded_at timestamptz not null default now()
);
