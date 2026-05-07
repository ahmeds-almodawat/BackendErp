# Performance Guide

Rules:

- JavaScript bundle above 500 KB is a warning.
- Tables above 1,000 rows should use server-side pagination.
- Tables above 3,000 rows should use virtualization.
- Heavy modules should be lazy-loaded.
- Reports should run from backend snapshots, not browser loops.
