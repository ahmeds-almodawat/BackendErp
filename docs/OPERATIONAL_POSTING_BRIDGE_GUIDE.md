# Operational Posting Bridge Guide

Operational modules must eventually create finance posting batches:

- Purchase invoice ? AP + inventory/expense/VAT
- Supplier payment ? bank/cash + AP
- Sales POS batch ? revenue/VAT/payment clearing/COGS
- Inventory movement ? inventory valuation + variance/COGS
- Production batch ? ingredient consumption + output capitalization

The bridge maps source documents to the required RPC and finance posting batch.
