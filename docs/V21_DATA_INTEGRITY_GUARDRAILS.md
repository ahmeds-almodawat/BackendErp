# V21 — Data Integrity + Posting Guardrails

This release focuses on preventing bad local-trial data before moving to more modules.

## Implemented

1. **Balanced opening balances**
   - Opening balances are now posted as a multi-line batch.
   - The system blocks posting unless total debits equal total credits.
   - Locked/closed fiscal periods block opening-balance posting.
   - Required cost-center dimensions are validated before posting.

2. **Supplier payment allocation**
   - Supplier payment vouchers are now allocated to a specific posted supplier invoice.
   - Overpayment against the selected invoice is blocked.
   - Locked/closed fiscal periods block payment posting.
   - The payment journal uses the invoice branch instead of a generic company dimension.

3. **Permission enforcement expansion**
   - Material-request approval, PO approval, GRN posting, supplier-invoice posting, and supplier-payment posting now check the permission engine.
   - This is still local enforcement; Supabase Edge Functions should enforce the same logic later.

4. **Soft-delete direction**
   - Setup delete buttons were changed toward deactivation instead of hard delete for critical master data.
   - Used records should never be physically deleted in production.

## Still remaining

- Full backend persistence and RLS.
- Real XLSX import engine.
- Document attachments.
- Supplier statements and AP payment run batching.
- Stronger stock-count variance workflow.
- Full document PDF printing.
