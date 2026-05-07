# v323-v328 Finance Enterprise Backend Mega Patch

This mega patch adds the enterprise finance backend foundation after the operational backend cutover.

## Included versions

- v323 Finance GL Backend Cutover
- v324 AP/AR Subledger and Aging Foundation
- v325 VAT/Tax Backend Foundation
- v326 Bank Reconciliation Backend Foundation
- v327 Finance Close and Management Truth Pack
- v328 Finance Domain QA Script

## Important warning

This is still a backend foundation layer. The SQL functions are safe starting points, not final audited accounting logic.

Before production:
- test migrations on staging
- test RLS
- test backup/restore
- reconcile subledgers to GL
- ensure every operational posting creates balanced journal lines
- ensure posted records are reversed, not edited/deleted
