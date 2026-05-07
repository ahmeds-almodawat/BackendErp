# ERP v220 Smooth Trial Data Pack

This folder contains a complete, small, consistent sample dataset to test the ERP workflow quickly.

## Recommended upload sequence

1. Setup / master data:
   - 01_setup_master_data/01_branches_setup.csv
   - 01_setup_master_data/02_stores_setup.csv
   - 01_setup_master_data/03_items_setup_zero_cost.csv
   - 01_setup_master_data/04_cost_centers_setup.csv
   - 01_setup_master_data/05_suppliers_setup_full.csv
   - 01_setup_master_data/06_chart_accounts_setup.csv

2. Opening inventory:
   - 02_inventory_opening_and_count/01_opening_stock_upload.csv

3. Foodics native menu bundle:
   - 03_foodics_menu_native/01_foodics_products_export.csv
   - 03_foodics_menu_native/02_foodics_products_ingredients_export.csv
   - 03_foodics_menu_native/03_foodics_products_modifiers_export.csv

4. Foodics sales files:
   - 04_foodics_sales/01_foodics_orders_headers_export.csv
   - 04_foodics_sales/02_foodics_order_lines_export.csv
   - 04_foodics_sales/03_foodics_payments_export.csv
   Optional:
   - 04_foodics_sales/04_optional_branch_sales_summary.csv
   - 04_foodics_sales/05_optional_payment_summary.csv

5. Monthly stock count AFTER full ERP posting:
   - 02_inventory_opening_and_count/02_monthly_stock_count_after_sales_upload.csv

## Expected high-level results

- Order headers: 14
- Done orders: 12
- Void orders: 1
- Returned orders: 1
- Recognized gross after void/return: 1311.0
- Payment total: 1311.0
- Sales vs payments difference: 0.0
- VAT output: 171.0
- Theoretical COGS from recipes: 180.36
- Opening inventory value: 4901.0
- Inventory value after sales: 4720.64
- Stock count shortage value: 34.16
- Stock count surplus value: 3.75

## Testing notes

- Use Sales Accounting Only first to test the sales/VAT/payment flow.
- Use Full ERP Posting after opening stock is uploaded and Foodics menu/recipes are imported.
- Void order ORD-005 should be reported but excluded from sales posting.
- Returned order ORD-006 should reduce sales and payments.
- Monthly stock count file is designed to be uploaded after full ERP posting to generate controlled shortages/surpluses.
