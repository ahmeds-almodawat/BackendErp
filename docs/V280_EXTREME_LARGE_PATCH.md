# v280 Extreme Large Patch

## Purpose
Move the local ERP prototype closer to pilot backend readiness without breaking the local Foodics and inventory testing flow.

## Added
- Enterprise v280 module.
- Setup backend sync workbench.
- Setup JSON payload export.
- Local/Supabase dry-run service.
- Setup validation service.
- Central posting orchestrator map.
- Backend wiring plan.
- Refactor starter map.
- QA matrix.
- Pilot report factory.
- Safe local actions.

## Still not finished
- Full Supabase Auth UI.
- Full setup pages reading/writing Supabase tables.
- Server-side posting logic.
- Real attachments upload to Supabase Storage.
- Full RLS testing with multiple users.
- Complete App.tsx modular refactor.

## Next recommended patch
v281: Setup/Inventory/Finance module extraction and real backend repository fallback.
