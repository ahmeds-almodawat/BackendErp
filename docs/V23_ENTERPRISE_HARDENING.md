# V23 Enterprise Hardening

This release focuses on making the existing ERP prototype feel more like a controlled business system rather than isolated module screens.

## Added in v23

- Control Center enterprise hardening tab.
- Document pack readiness tab for PO, GRN, invoice matching, payment voucher, journal voucher, and stock count variance.
- Backend migration checklist for Supabase production readiness.
- Board-grade reporting workspace with executive, branch P&L, inventory valuation, supplier spend, menu engineering, and finance pack views.
- CSV exports from the current board-report view.
- Early refactor skeleton under `src/engines/` for accounting, inventory costing, and permission logic.

## Important remaining gaps

This remains a local-first prototype. Real production requires Supabase Auth, PostgreSQL tables, RLS, server-side posting functions, storage, audit triggers, backups, and concurrency protection.

## Priority after v23

1. Move posting engines to server-side functions.
2. Add attachment storage and document print templates.
3. Build real PDF/Excel exports.
4. Harden every module button with permission checks.
5. Centralize inventory cost and unit-conversion logic.
