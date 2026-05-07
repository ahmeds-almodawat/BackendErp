-- v45 Combined Enterprise Controls design notes
-- Future Supabase tables/functions:
-- monthly_close_periods, close_check_results, food_cost_variance_rows, purchase_variance_rows, finance_close_packs
-- Edge functions should enforce period close, inventory close, Foodics batch close, and finance close.

create table if not exists public.monthly_close_periods (
  id uuid primary key default gen_random_uuid(),
  period_code text not null unique,
  start_date date not null,
  end_date date not null,
  status text not null default 'open',
  closed_by uuid,
  closed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.close_check_results (
  id uuid primary key default gen_random_uuid(),
  period_code text not null,
  check_key text not null,
  status text not null,
  risk_note text,
  created_at timestamptz default now()
);
