# V24 — Purchasing + Finance Document Workflow Polish

This phase deepens the current modules instead of adding new ones.

## Added

- Purchasing Document Pack tab.
- Printable HTML document outputs for:
  - Purchase Order
  - Goods Receipt Note
  - Supplier Invoice Match
  - Payment Voucher
- Document audit-card CSV export.
- Purchasing document control timeline.
- Attachment placeholder controls for quotation, delivery note, supplier invoice image, and payment proof.
- Finance tabs:
  - AP Payment Run
  - Supplier Statements
- AP payment run posts one invoice-allocated payment voucher per open invoice.
- Supplier statement shows invoices, payments, and running balance.

## Local-mode limitations

- Print outputs are HTML downloads now; immutable PDF should be created server-side after Supabase migration.
- Attachments are placeholders now; production needs Supabase Storage.
- Approval comments need a persistent table in the backend phase.

## Test flow

1. Load fast trial scenario.
2. Purchasing → Document Pack.
3. Download PO / GRN / Invoice / Payment Voucher HTML.
4. Finance → AP Payment Run.
5. Filter supplier and export payment plan.
6. Finance → Supplier Statements.
7. Export supplier statement CSV.
