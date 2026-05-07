# v340-v344 Inventory and Purchasing Live Posting Gate

This patch adds live posting foundations for:

- v340 opening stock live posting
- v341 purchase receipt live posting
- v342 stock count and adjustment live posting
- v343 purchase invoice live posting bridge
- v344 supplier payment live posting bridge

Important:

- This is still a live gate foundation.
- No AppShell rewrite.
- No migration is applied automatically.
- The SQL functions register live posting runs and prepare the backend bridge.
- Final production posting must later connect to official GL, AP, VAT, stock ledger, and reversal flows.
