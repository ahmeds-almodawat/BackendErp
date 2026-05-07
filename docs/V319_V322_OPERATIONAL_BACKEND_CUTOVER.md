# v319-v322 Operational Backend Cutover

This mega patch combines four operational backend foundations:

- v319 Purchasing/AP Backend Cutover
- v320 Sales/POS Backend Cutover
- v321 Production/Recipe Backend Cutover
- v322 Operational Posting Bridge

## Scope

This patch adds backend foundations, services, templates, docs, and SQL migration files.

It does not rewrite the UI and does not apply migrations automatically.

## Enterprise warning

The RPC functions in this patch are foundation stubs. They mark documents as posted/reconciled, but the next stage must connect them to real finance posting batches, stock movements, VAT, and reconciliation controls.
