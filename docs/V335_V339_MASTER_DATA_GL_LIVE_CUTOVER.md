# v335-v339 Master Data and GL Live Cutover Gate

This patch adds the first live cutover gate after the enterprise backend gate.

Included:

- v335 live master data cutover service
- v336 master data import approval bridge
- v337 live manual journal posting gateway
- v338 opening balance cutover foundation
- v339 real GL report request foundation

Rules:

- No AppShell rewrite.
- No migration is applied automatically.
- Supabase mode still requires env variables and tested RLS.
- Posted financial data must be reversed, not edited or deleted.
