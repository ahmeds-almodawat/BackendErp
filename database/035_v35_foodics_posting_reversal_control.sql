-- V35 Foodics Posting & Reversal Control — backend design notes
-- This file documents the production database direction for Foodics batch approval, posting, and reversal.

create table if not exists public.foodics_import_batches (
  id uuid primary key default gen_random_uuid(),
  batch_ref text not null,
  posting_mode text not null check (posting_mode in ('report','sales','full')),
  status text not null check (status in ('uploaded','validated','approved','report_only','posted_sales','posted_full','reversed')),
  order_count integer default 0,
  line_count integer default 0,
  payment_count integer default 0,
  order_gross numeric(14,2) default 0,
  payment_total numeric(14,2) default 0,
  reconciliation_difference numeric(14,2) default 0,
  validation_summary jsonb default '{}'::jsonb,
  approved_by uuid null,
  approved_at timestamptz null,
  posted_by uuid null,
  posted_at timestamptz null,
  reversed_by uuid null,
  reversed_at timestamptz null,
  reversal_reason text null,
  created_at timestamptz not null default now(),
  unique(batch_ref, posting_mode, status) deferrable initially immediate
);

create table if not exists public.foodics_import_batch_links (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.foodics_import_batches(id),
  source_module text not null,
  source_id uuid null,
  source_ref text null,
  link_type text not null,
  created_at timestamptz not null default now()
);

-- Production posting should be handled by server-side functions, not browser code:
-- approve_foodics_batch(batch_id)
-- post_foodics_sales_accounting(batch_id)
-- post_foodics_full_erp(batch_id)
-- reverse_foodics_batch(batch_id, reason)
