# Clean Workflow Trial

## What was changed in v9

- Removed default dummy data from the app startup.
- Added one clean local data store in browser localStorage.
- Added optional sample loader only on the Dashboard.
- Added clear workflow screens so live trials are not confusing.
- Added working local relations between setup, inventory, purchasing, production, sales, finance, HR, access control, reports, and import/export.

## Core relations

- Branch -> Store
- Store -> Stock Movement
- Supplier -> Purchase -> AP Journal
- Item -> Stock Movement
- Menu Item -> Recipe Line -> Item
- Sale -> Recipe Deduction -> Stock Movement -> Sales/COGS Journal
- Production -> Raw Material Out -> Semi-Finished Item In -> Production Journal
- Employee -> Role -> Scope -> Permissions
- Employee -> Schedule -> Attendance Punch
- Cost Center -> Branch/Budget

## Limitations before backend

- Data is saved in browser localStorage only.
- There is no multi-user locking yet.
- No real authentication yet.
- No server-side posting controls yet.
- No Supabase RLS yet.
- CSV import is template download only in this version; full mapped import comes after the workflow is approved.
