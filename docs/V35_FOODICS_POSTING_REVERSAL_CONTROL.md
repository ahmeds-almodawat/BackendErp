# V35 — Foodics Posting & Reversal Control

## Purpose

v35 adds stronger Foodics batch controls so sales imports can be approved, posted, and reversed in a safer audit-oriented flow.

## Workflow

1. Upload Foodics files.
2. Map branches, SKUs, and payment methods.
3. Resolve validation blockers from the Issue Center.
4. Choose posting mode:
   - Report only
   - Sales accounting only
   - Full ERP posting
5. Approve the batch.
6. Post the batch.
7. Reverse only through controlled reversal with reason.

## Posting modes

### Report only
Registers the Foodics batch for review and reconciliation. No journal or inventory movement is created.

### Sales accounting only
Posts sales revenue, VAT output, and payment clearing by mapped payment method. No inventory deduction or COGS is posted.

### Full ERP posting
Posts sales accounting plus recipe-based inventory deduction and theoretical COGS.

## Reversal principle

Do not delete posted records. Reversal creates reversal journals and opposite inventory movements, then keeps the original posting history.

## Remaining backend requirement

In production, approval, posting, and reversal must move to server-side Supabase RPC/Edge Functions with transaction locking and immutable audit triggers.
