# V18 Core ERP Stabilization

This version focuses on making the existing modules behave like a professional ERP core instead of isolated demo screens.

## Main upgrade

Purchasing is now separated into a real document cycle:

1. Material Request
2. Purchase Order
3. Goods Receipt Note (GRN)
4. Supplier Invoice Matching
5. Supplier Payment Voucher
6. Purchasing Registers and Control Center

## Accounting model

The professional control now separates receiving from invoicing:

- GRN posts inventory and Goods Received Not Invoiced (GRNI):
  - Dr Inventory
  - Cr Goods Received Not Invoiced

- Supplier invoice matching clears GRNI and recognizes VAT/AP:
  - Dr Goods Received Not Invoiced
  - Dr VAT Input
  - Cr Accounts Payable

- Supplier payment voucher reduces AP and cash/bank:
  - Dr Accounts Payable
  - Cr Bank/Cash

## Inventory impact

GRN creates:

- Stock movements
- Inventory lots
- Bin/shelf readiness
- Expiry readiness
- Audit trail

## Why this matters

This fixes the earlier weakness where purchase invoices directly created inventory/AP. That can be used for simple businesses, but a more serious ERP needs PO/GRN/invoice separation so finance can control:

- delivered not invoiced
- invoiced not delivered
- quantity variance
- price variance
- supplier balance
- payment vouchers

## Remaining recommended work

- Enforce permission checks on posting buttons
- Add formal price/quantity variance thresholds
- Add partial invoice per GRN line
- Add payment run and approval workflow
- Add Excel import mapping for each purchasing document
- Add real Supabase persistence and RLS
