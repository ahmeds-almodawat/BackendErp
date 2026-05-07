# v33 — Native Foodics Menu Import

## Purpose

v33 replaces the generic menu template import with a native Foodics menu bundle importer.

## Supported files

- Foodics products export
- Foodics products ingredients export
- Foodics products modifiers export

## Key behavior

- Product SKU becomes ERP menu item code.
- Foodics products create/update ERP menu items.
- Foodics ingredients create zero-cost inventory items if missing.
- Foodics ingredients create multi-line recipes.
- Foodics modifiers are stored as modifier group links for future POS logic.
- Future sales uploads auto-map by exact SKU.

## Important limitation

The uploaded modifiers file links products to modifier groups, but does not include individual modifier option products/prices/recipes. For full add-on inventory deduction, the ERP still needs a Foodics modifier options export or equivalent option-level data.
