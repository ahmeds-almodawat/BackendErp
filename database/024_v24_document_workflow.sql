-- V24 document workflow design notes for Supabase production migration

-- Printable documents and immutable files
create table if not exists public.document_files (
  id uuid primary key default gen_random_uuid(),
  document_type text not null,
  document_ref text not null,
  file_name text not null,
  storage_path text,
  mime_type text,
  generated_by uuid,
  generated_at timestamptz default now(),
  is_voided boolean default false
);

-- Approval/comments timeline for all documents
create table if not exists public.document_comments (
  id uuid primary key default gen_random_uuid(),
  document_type text not null,
  document_ref text not null,
  comment text not null,
  action text not null,
  created_by uuid,
  created_at timestamptz default now()
);

-- Supplier statement and payment-run backend tables should allocate payments to invoices.
create table if not exists public.supplier_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  supplier_payment_id uuid not null,
  supplier_invoice_id uuid not null,
  allocated_amount numeric(18,4) not null check (allocated_amount > 0),
  created_at timestamptz default now()
);
