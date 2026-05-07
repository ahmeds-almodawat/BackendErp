# v454 Inventory Availability, Reservation, and Internal Issue Engine

## Goal

v454 makes material request decisions safer for restaurant operations.

A material request no longer checks only raw on-hand stock. It now separates:

- on-hand stock,
- reserved stock,
- free stock,
- issued stock,
- real shortage quantity.

## User workflow

1. Kitchen submits a material request.
2. Manager reviews free stock and shortage.
3. Manager can approve/refuse/delete the request.
4. Manager clicks **Reserve Stock** to reserve available quantities.
5. Manager clicks **Issue Reserved** to transfer/issue reserved stock.
6. Manager clicks **Create Shortage PO** only for the remaining shortage.

## Why this matters

Without reservation, two kitchens can consume the same available stock on screen. v454 adds an explicit reservation layer so stock is not double-promised before issue.

## Notes

This is a local/demo ERP shell implementation plus Supabase evidence schema. The production Supabase implementation should later move reservation/issue logic into permission-checked server RPCs.
