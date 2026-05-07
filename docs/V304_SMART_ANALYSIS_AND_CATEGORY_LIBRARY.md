# V304 — Smart Analysis and Category Library

## Purpose

This patch adds a custom analytics workbench and improves master-data quality for item/menu categories.

## Smart Analysis

A new **Smart Analysis** route was added in the Command sidebar group.

Capabilities:
- Custom period filtering.
- KPI selection based on the executive dashboard KPI list.
- Auto or forced graph shape selection.
- Per-KPI graph color customization.
- Secondary accent color customization.

The page is designed for executive/board review scenarios where the normal homepage dashboard is excellent but the user needs ad-hoc views for a specific month, quarter, year, or custom period.

## Category Library

A new **Setup → Categories** tab was added to keep the sidebar clean and keep category administration inside master data.

Supported category types:
- Inventory item categories.
- Menu item categories.

The tab allows creating new category values and renaming existing categories across linked records.

## Items/Menu Items dropdown flow

The category fields in Setup → Items and Setup → Menu Items are no longer simple free-text fields. They now use dropdowns built from existing category values.

The first dropdown option is **+ Create new category**. Selecting it opens a new input field. On save, the category is added to the category library and linked to the item/menu item.

## Build validation

`npm run build` passed successfully after the patch.
