# Import mapping profiles (v312)

## Source types

The v312 `ImportMappingProfileSourceType` union includes:

- `chart_of_accounts`, `items`, `suppliers`, `opening_balances`, `opening_stock`
- `foodics_sales`, `foodics_payments`, `inventory_count`, `purchase_invoices`, `custom_report`

`ImportSourceType` in `importStagingTypes.ts` should stay aligned for staging uploads (v312 added `purchase_invoices`).

## Profile shape

Each `ImportMappingProfile` contains:

- `id`, `sourceType`, `profileName`, `version`, `status`
- `requiredFields` / `optionalFields` (domain field keys)
- `fieldMappings`: `sourceColumn` → `targetField` with optional `required` / `notes`
- `createdAt` / `updatedAt`

## Defaults

`DEFAULT_IMPORT_MAPPING_PROFILES` ships seven ready-to-extend templates (chart, items, suppliers, opening balances, opening stock, Foodics sales, Foodics payments). Extend or replace via DB tables `import_mapping_profiles` and `import_mapping_profile_fields` after migration.

## CSV template

See `templates/v312/import_mapping_profile_template.csv` for a column-oriented layout suitable for bulk authoring profiles before inserting into Supabase.
