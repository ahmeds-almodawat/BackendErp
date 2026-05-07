# v401 Purchase Invoice Server Posting

Date: 2026-05-06

## Goal

v401 implements the first real backend-authoritative ERP posting workflow:

**Purchase Invoice → Inventory Movement/Balance → AP Subledger → VAT Input → GL Posting Batch + Finance Journal**

This replaces the previous foundation behavior where `purchasing_post_purchase_invoice(...)` only marked the invoice as posted.

## Added RPC

| RPC | Purpose |
|---|---|
| `purchasing_post_purchase_invoice_server(invoice_id, fiscal_period_id, posting_date, account_map)` | Validates and posts a purchase invoice inside the database transaction. |
| `purchasing_post_purchase_invoice(invoice_id)` | Compatibility wrapper now calling the real server-side posting RPC. |

## What the RPC validates

1. Caller has `finance.post` or `purchasing.approve`.
2. Invoice exists and is locked `FOR UPDATE`.
3. Invoice is `approved` or `validated`, not draft.
4. Branch and store are present.
5. Invoice has lines.
6. Header totals reconcile to line net amount plus VAT.
7. Fiscal period exists and is open.
8. Duplicate source posting does not already exist.
9. Posting batch validates before final posting.

## What the RPC writes

| Target | Result |
|---|---|
| `posting_batches` | Official v311 posting batch for source `purchase_invoice`. |
| `posting_batch_lines` | Balanced DR inventory, DR VAT input, CR AP. |
| `finance_journal_entries_backend` | Posted finance journal for finance reports. |
| `finance_journal_lines_backend` | Journal lines matching the posting batch. |
| `ap_subledger_transactions` | Supplier payable transaction. |
| `vat_transactions` | Input VAT transaction when VAT exists. |
| `inventory_stock_movements` | Purchase receipt movement per invoice line. |
| `inventory_stock_balances` | Upserted stock-on-hand and average cost per store/item. |
| `posting_source_locks` | Source document lock to prevent duplicate posting. |
| `purchase_invoices` | Status, posting batch id, fiscal period id, posted timestamp, metadata. |
| `purchase_invoice_server_posting_events` | Audit/evidence events for the posting. |

## Default account mapping

The RPC accepts an optional `account_map` JSON object:

```json
{
  "inventory_account": "1200",
  "vat_input_account": "1310",
  "ap_account": "2100"
}
```

If omitted, these defaults are used.

## What v401 does not do yet

v401 does not complete supplier payment posting, POS settlement, production posting, or VAT settlement. It establishes the first real pattern so those can follow safely.

## QA

Run:

```bash
npm run qa:v401
npm run qa:all
supabase db reset
```

## Manual smoke test idea

After seeding a supplier, branch, store, item, open fiscal period, approved invoice, and invoice lines, call:

```sql
select public.purchasing_post_purchase_invoice_server('<invoice-id>'::uuid);
```

Expected outcome: one posting batch, balanced lines, finance journal, AP subledger row, VAT input row if VAT exists, inventory movement rows, updated stock balances, and invoice status `posted`.
