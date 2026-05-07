-- V21 Data Integrity + Posting Guardrails
-- Backend design notes for Supabase implementation.

-- 1) Opening balances must be one balanced journal batch.
-- Suggested constraint: server-side posting function rejects batches where debit != credit.

-- 2) Supplier payments should allocate to invoice balances.
alter table if exists supplier_payments add column if not exists invoice_ref text;

-- Suggested future table:
create table if not exists supplier_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null,
  supplier_invoice_id uuid not null,
  allocated_amount numeric(14,2) not null check (allocated_amount > 0),
  created_at timestamptz not null default now()
);

-- 3) Critical master data should be deactivated, not deleted.
-- Example pattern:
-- alter table items add column if not exists active boolean not null default true;

-- 4) Server-side permission checks should be enforced in all posting RPCs.
-- Examples:
-- post_grn(...), post_supplier_invoice(...), post_supplier_payment(...), post_opening_balance(...)
-- should validate user permission, scope, fiscal period status, and document lifecycle.
