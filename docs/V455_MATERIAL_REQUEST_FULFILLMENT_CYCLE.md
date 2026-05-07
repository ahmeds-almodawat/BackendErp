# v455 Material Request Fulfillment Cycle

Date: 2026-05-07

## Goal

v455 makes the end of the material request cycle clear and professional.

A material request should not always become a purchase order. The manager decides whether the requested stock is:

1. refused/deleted,
2. reserved from available stock,
3. moved to the requesting store by store transfer,
4. issued directly to use / cost center consumption, or
5. purchased only for the remaining shortage.

## Business Rule

| Situation | Final document |
|---|---|
| Source store is different from requesting store | Store Transfer |
| Source store is the requesting store | Internal Issue / Consumption |
| Stock is not enough | Shortage-only Purchase Order |
| Request is wrong | Refuse / Delete |

## UI Change

The material request action formerly labelled `Issue Reserved` is now:

`Create Transfer / Issue`

The action automatically creates:

- a store transfer when reserved stock moves between stores, and
- an internal issue when reserved stock is consumed from the requesting store.

## Backend Evidence

The migration adds/extends local Supabase evidence objects for transfer/issue fulfillment:

- `material_request_fulfillment_events`
- `material_request_fulfillment_snapshot_v455()`
- optional fulfillment metadata columns on `internal_stock_issues`
- optional material request link columns on `transfers`

## QA

Run:

```bash
npm run qa:v455
npm run qa:all
```
