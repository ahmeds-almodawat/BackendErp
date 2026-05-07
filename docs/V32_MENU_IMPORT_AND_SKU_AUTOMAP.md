# V32 — Foodics Menu Import + SKU Auto Mapping

## Purpose
V32 adds a Foodics menu/product import step before monthly sales posting.

The ERP uses Foodics SKU as the primary mapping key:

Foodics SKU = ERP Menu Item Code

This means the user does not need to map every POS item on every monthly upload. Exact SKU matches are mapped automatically; manual mapping is only required for exceptions.

## Added Features
- New Sales / POS Trial tab: Menu Import.
- Upload Foodics menu/products CSV.
- Create or update ERP menu items from the menu file.
- Auto-map current Foodics sales SKUs to ERP menu items by exact SKU.
- Manual mapping remains available for exceptions.
- Manual mappings remain persisted in local Foodics session storage.
- Menu upload creates sales menu items only; recipes remain separately controlled because recipes affect inventory and food cost.

## Recommended Workflow
1. Load or create ERP branches and stores.
2. Upload Foodics menu/product file in Sales / POS Trial > Menu Import.
3. Import/update menu items.
4. Upload monthly Foodics sales files.
5. Click Auto map by SKU.
6. Manually map only remaining exceptions.
7. Validate.
8. Post report-only, sales accounting-only, or full ERP posting.

## Professional Rule
SKU should be treated as the stable POS-to-ERP key. Names can change, Arabic labels can differ, and spelling can vary, but SKU should remain stable.
