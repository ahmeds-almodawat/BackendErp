# v349-v351 Bank, VAT, and Period Close Live Gate

This patch adds live foundations for:

- v349 bank statement import and reconciliation
- v350 VAT settlement and adjustment
- v351 period close gate

Important:

- No AppShell rewrite.
- No migration is applied automatically.
- Period close is blocked unless critical checks pass.
- Backup, trial balance, inventory, AP, AR, bank, and VAT checks are mandatory before closing.
