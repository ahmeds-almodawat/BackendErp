-- v14 Enterprise Operations Schema Notes
-- Add these objects when moving from local mode to Supabase.

create table if not exists production_recipes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_en text not null,
  name_ar text not null,
  output_item_id uuid not null,
  base_output_qty numeric not null default 1,
  output_unit text not null default 'KG',
  default_expiry_days integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists production_recipe_lines (
  id uuid primary key default gen_random_uuid(),
  production_recipe_id uuid not null references production_recipes(id) on delete cascade,
  item_id uuid not null,
  qty numeric not null,
  unit text not null,
  wastage_pct numeric not null default 0
);

-- production_batches should reference production_recipe_id and capture planned/actual/yield/expiry.
-- Posting should create stock ledger and GL journals atomically.
