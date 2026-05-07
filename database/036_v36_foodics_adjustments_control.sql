-- v36 Foodics adjustments control design
-- Adds normalized design notes for discounts, voids, returns, and refund payments.

create table if not exists public.foodics_adjustment_controls (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid,
  adjustment_type text not null check (adjustment_type in ('discount','void','return','refund_payment')),
  foodics_order_reference text,
  original_order_reference text,
  branch_reference text,
  sku text,
  payment_method_name text,
  amount numeric default 0,
  vat_amount numeric default 0,
  treatment_policy text not null,
  status text not null default 'detected',
  created_at timestamptz not null default now()
);

-- Posting policy:
-- discounts: revenue posted net, analytical control row retained
-- voids: excluded from GL/inventory posting, reviewed as operational exception
-- returns: negative revenue/VAT; prepared food inventory not restored by default
-- refund payments: credit mapped cash/card/receivable account
