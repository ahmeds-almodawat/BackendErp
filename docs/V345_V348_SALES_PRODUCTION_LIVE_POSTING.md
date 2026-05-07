# v345-v348 Sales/POS and Production Live Posting Gate

This patch adds live posting foundations for:

- v345 Foodics/POS import live foundation
- v346 Sales/POS posting to finance bridge
- v347 Recipe backend cutover
- v348 Production batch live posting

Important:

- This is a live gate foundation.
- No AppShell rewrite.
- No migration is applied automatically.
- Final production posting must later connect POS revenue, VAT, payment clearing, COGS, inventory consumption, production output, and reversal flows.
