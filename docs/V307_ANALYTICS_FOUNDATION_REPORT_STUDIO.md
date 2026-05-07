# v307 Analytics Foundation & Report Studio

This patch keeps **Smart Analysis** as the clean single sidebar entry and adds internal workspace modes:

- Report Studio inside Smart Analysis.
- Report Import Center for registering CSV/XLSX/PDF management reports before they become trusted data.
- Foodics-style packs: Today, Payments, Products, Categories, Finance, Inventory / Cost Control.
- Comparison modes: yesterday, same day last week, same day last year, previous same-length period, previous month, and custom comparison period.
- Clickable KPI drilldowns with CSV export.
- Custom KPI Builder with formula, chart type, target, warning/critical thresholds, color, and visibility.
- Management Action Center.
- Data Quality Controls.
- Saved Smart Analysis Views.

Backend contract added:

- `report_import_registrations`
- `custom_kpi_definitions`
- `smart_analysis_views`
- `analytics_data_quality_checks`

Main sidebar stays clean: everything lives inside the Smart Analysis route.
