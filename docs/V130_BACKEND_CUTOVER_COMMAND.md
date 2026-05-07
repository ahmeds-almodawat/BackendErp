# v130 — Backend Cutover Command Center

v130 combines the v122-v130 backend-readiness program into one package. It does not replace the local-first ERP yet; it adds the production cutover command center, backend migrations, API contracts, Edge Function skeletons, QA plan and Supabase migration waves.

## Added
- Enterprise v130 module in the sidebar.
- Backend readiness board and current scores.
- v122-v130 program roadmap.
- Backend domain registry.
- Production API contracts.
- Go-live cutover waves.
- Posting guard requirements.
- QA suite and CSV exports.
- Supabase migrations for cutover runs, API contracts, import staging and posting guard results.
- Edge Function skeletons for master-data-sync, foodics-post, inventory-posting, finance-posting, attachment-signer and report-pack-builder.

## Current score
- Local MVP / prototype: 9.2 / 10
- Serious ERP foundation: 8.4 / 10
- Enterprise design direction: 8.9 / 10
- Production readiness: 5.6 / 10
- Backend/security readiness: 6.0 / 10

## Next milestone
v131 should connect Auth + Setup Master Data Persistence: company, login, branches, stores, suppliers, items, chart of accounts and cost centers to Supabase with local fallback.
