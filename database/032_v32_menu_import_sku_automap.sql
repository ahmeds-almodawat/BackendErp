-- V32 Foodics menu import and SKU auto mapping design notes
-- Future Supabase implementation should persist imported Foodics menu items,
-- mapping profiles, and manual mapping exceptions.

create table if not exists public.pos_menu_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'foodics',
  file_name text,
  imported_by uuid,
  imported_at timestamptz not null default now(),
  rows_total integer not null default 0,
  rows_created integer not null default 0,
  rows_updated integer not null default 0,
  rows_skipped integer not null default 0,
  status text not null default 'imported'
);

create table if not exists public.pos_item_mappings (
  id uuid primary key default gen_random_uuid(),
  source_system text not null default 'foodics',
  pos_sku text not null,
  pos_name text,
  menu_item_id uuid,
  mapping_method text not null default 'sku_exact',
  confidence numeric(5,2) not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_system, pos_sku)
);
