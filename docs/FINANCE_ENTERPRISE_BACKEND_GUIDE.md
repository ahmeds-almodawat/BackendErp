# Finance Enterprise Backend Guide

Recommended implementation sequence:

1. Manual journals
2. Opening balances
3. Purchase invoice posting
4. Supplier payment posting
5. Sales/POS posting
6. Inventory valuation posting
7. Production posting
8. VAT settlement
9. Bank reconciliation
10. Finance close

A journal is production-safe only when:
- debit equals credit
- period is open
- branch scope is valid
- source document is locked
- posted journal is immutable
- reversal is used for correction
