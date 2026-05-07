# v38 — Starter-Friendly Recipe Control

## Problem

During early implementation, not every Foodics item will have a complete ERP recipe. Blocking the whole Foodics flow because of missing recipes slows down testing and reporting.

## Solution

Recipe gaps now only block Full ERP Posting.

Report-only and Sales Accounting Only modes remain available.

## Controls

- Full ERP Posting still requires recipes because it deducts inventory and posts COGS.
- Sales Accounting Only posts sales, VAT, and payment split without inventory deduction.
- The validation cockpit shows missing recipes as a warning outside Full ERP mode and a blocker inside Full ERP mode.
- The Posting screen includes a starter-friendly recipe control message with quick actions.
