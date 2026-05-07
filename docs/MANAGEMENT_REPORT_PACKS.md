# Management report packs (v313 foundation)

## Principle

Management packs must **distinguish posted truth from estimates**. When data is missing, the pack must show **incomplete** status and explain what sources are required.

## Packs in v313 module

- **Management Dashboard Pack**
  - summary of finance truth and operational risk
- **Executive KPI Pack**
  - minimal KPIs (net sales, inventory value, supplier payables)
  - flags demo/estimated values when truth aggregates are missing
- **Finance Truth Report**
  - references underlying finance checks (e.g., trial balance)
- **Operational Risk Report**
  - pulls top risks from inventory valuation, sales/payment reconciliation, and supplier aging

## Next backend tasks

- Persist report runs per branch/day/month with explicit source tables (`reporting_report_run_sources`).
- Compute KPIs from posted v311 batches and v312 cutover batches.
- Gate management dashboards for production pilots on `trusted` truth status.

