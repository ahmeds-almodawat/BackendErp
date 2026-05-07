# Live Cutover Operating Guide

Recommended order:

1. Verify backend gate.
2. Apply migrations on staging.
3. Verify RLS tests.
4. Import and validate chart of accounts.
5. Import and validate branches, stores, suppliers, and items.
6. Post opening balances.
7. Post first manual journal.
8. Generate trial balance.
9. Reconcile trial balance before enabling purchasing/inventory live posting.
