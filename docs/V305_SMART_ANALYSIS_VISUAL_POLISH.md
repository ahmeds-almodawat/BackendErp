# V305 — Smart Analysis Visual Polish

This patch implements the requested visual polish on top of v304.

## Scope

- Keeps the existing v304 Smart Analysis page and sidebar structure.
- Improves KPI card hierarchy so titles and explanatory text are readable instead of being much smaller than the KPI numbers.
- Adds clearer chart containers, larger line chart captions, larger bar labels, and stronger doughnut center formatting.
- Keeps custom period, graph shape, individual KPI color, and secondary accent color controls.

## UX principle

Numbers remain prominent, but not at the expense of labels. Executive users should immediately understand what each KPI means without zooming in.

## QA

- Run `npm run build`.
- Open Smart Analysis.
- Confirm the card title, hint, KPI value, chart labels, and color controls are all readable on desktop and responsive widths.
