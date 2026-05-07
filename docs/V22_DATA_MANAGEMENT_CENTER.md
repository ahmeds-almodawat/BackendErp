# V22 — Data Management Center

This phase upgrades Import / Export from a simple backup page into a real local data management workbench.

## Added

- CSV upload wizard.
- Import type selection.
- Auto column mapping based on common English/Arabic aliases.
- Manual column mapping dropdowns.
- Required field validation.
- Duplicate detection against existing master data and inside the uploaded file.
- Foreign-key validation for branch/store/cost-center/recipe imports.
- Validation preview before posting.
- Error CSV download.
- Saved import mapping profiles.
- Clean CSV template downloads for branches, stores, suppliers, items, menu items, recipe lines, cost centers, and employees.
- JSON backup and restore retained.

## Current local-mode limitation

XLSX support is designed in the database schema, but local browser mode imports CSV only to keep the MVP dependency-light. For testing, save Excel files as CSV. The production version should use a backend parser for XLSX, row-level validation, approval, and rollback.

## Suggested test

1. Open Import / Export.
2. Download `items_template_v22.csv`.
3. Add a few rows in Excel and save as CSV.
4. Upload the CSV.
5. Review the auto-mapping.
6. Validate and import.
7. Try uploading the same file again to test duplicate detection.
