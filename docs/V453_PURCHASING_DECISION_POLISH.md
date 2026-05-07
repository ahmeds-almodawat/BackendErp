# v453 Purchasing Decision Polish

Date: 2026-05-07

## Purpose

This patch improves the operational purchasing flow after user review:

- Rename GRN lot input to **Batch No.** for clearer restaurant/food receiving language.
- Add material request **Refuse** and **Delete** controls.
- Add **Use Stock** decision when requested stock already exists and no PO is needed.
- Add **Create Shortage PO** decision that creates purchase orders only for missing quantities.
- Clarify that one PO belongs to one supplier and multi-supplier material requests must be split into separate supplier POs.
- Add PO **Cancel / Refuse** and **Delete** controls.

## Business Rule

Material Request approval is not the same as Purchase Order creation.

Recommended cycle:

1. Kitchen / branch creates Material Request.
2. Manager reviews availability.
3. If stock exists, issue/transfer stock and close the request without PO.
4. If stock is short, create PO(s) only for shortage quantities.
5. One PO must be for one supplier. Mixed-supplier requests are split by supplier.
6. Manager can refuse/delete incorrect requests before conversion.
7. PO can be cancelled/refused before receiving. Once received, it should not be deleted; use reversal/return controls later.

## Production Note

This is a UI/local workflow polish patch. In production, supplier selection should come from item-supplier master data, preferred supplier contracts, price lists, and branch/store availability rules.
