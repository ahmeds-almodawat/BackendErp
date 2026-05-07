-- V11 Professional Finance + VAT mode migration notes
-- Apply after the previous schema when moving to Supabase.

alter table if exists menu_items
  add column if not exists price_includes_vat boolean not null default true;

alter table if exists sales_import_lines
  add column if not exists net_sales numeric(14,2),
  add column if not exists vat_amount numeric(14,2),
  add column if not exists gross_sales numeric(14,2),
  add column if not exists price_includes_vat boolean not null default true;

create table if not exists fiscal_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  period_code text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'open' check (status in ('open','soft_closed','locked')),
  locked_by uuid,
  locked_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists posting_rules (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  description_en text,
  description_ar text,
  debit_rule jsonb not null default '[]'::jsonb,
  credit_rule jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz default now()
);

insert into posting_rules (event_key, description_en, description_ar, debit_rule, credit_rule)
values
('PURCHASE_INVOICE_POSTED','Purchase invoice posts inventory/expense and VAT input','ترحيل فاتورة شراء للمخزون/المصروف وضريبة المدخلات','[{"account":"inventory_or_expense"},{"account":"vat_input"}]','[{"account":"ap_or_cash_bank"}]'),
('SALES_BATCH_POSTED','Sales batch posts net revenue, VAT output, and COGS','ترحيل المبيعات بصافي الإيراد وضريبة المخرجات وتكلفة المبيعات','[{"account":"cash_card_clearing"},{"account":"cogs"}]','[{"account":"sales_revenue"},{"account":"vat_output"},{"account":"inventory"}]'),
('PRODUCTION_BATCH_POSTED','Production transfers raw material value to semi-finished inventory','ترحيل الإنتاج من الخامات إلى المخزون نصف المصنع','[{"account":"semi_finished_inventory"}]','[{"account":"raw_material_inventory"}]'),
('FIXED_ASSET_DEPRECIATION','Monthly fixed asset depreciation','الإهلاك الشهري للأصول الثابتة','[{"account":"depreciation_expense"}]','[{"account":"accumulated_depreciation"}]')
on conflict (event_key) do nothing;
