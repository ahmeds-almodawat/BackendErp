# V10 Professional Workflow Upgrade

This version upgrades the MVP from a basic trial into a cleaner operational workflow shell.

## Main fixes

- Setup is no longer a one-way wizard only. Every master data area has create, edit, delete, and clear-form actions.
- Supplier master now includes bank name, bank account/IBAN, representative name, representative phone, contact name, phone, and email.
- Item master no longer requires a unit price. Standard cost is optional. The real cost is calculated from purchase invoice line unit prices and stock ledger movements.
- Purchasing now uses purchase invoices with multiple item lines, not one purchase per item.
- Posting a purchase invoice updates stock ledger, AP/cash/bank, VAT input, and accounting journals.
- Finance module is expanded into subpages: Overview, GL, AP, AR, Banking, Fixed Assets, VAT, Statements, and KPIs.

## Recommended test

1. Setup > Branches: create restaurant.
2. Setup > Stores: create branch store.
3. Setup > Suppliers: create supplier with bank and representative.
4. Setup > Items: create two raw materials without standard cost.
5. Purchasing: create one supplier invoice with two item lines and post it.
6. Inventory: confirm both items increased in the receiving store.
7. Finance > AP: confirm supplier balance.
8. Finance > GL: confirm generated journal.
9. Finance > VAT: confirm VAT input.
10. Finance > Fixed Assets: add a sample asset and confirm monthly depreciation.
