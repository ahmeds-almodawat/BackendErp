# Reporting Truth model (v313)

## Core entities

- **Snapshot** (`reporting_truth_snapshots`)
  - captures the truth score and counts for a period (optionally branch-scoped)
- **Finding** (`reporting_truth_findings`)
  - explainable risk with severity and optional source pointer
- **Report run** (`reporting_report_runs`)
  - captures the output of a report execution (metrics + findings + truth score)
- **Run sources** (`reporting_report_run_sources`)
  - explicit list of source tables used for that run

## Status meaning

- **trusted**: score ≥ 90 and no critical findings
- **warning**: score < 90 or warning findings exist
- **critical**: critical finding exists or score is very low
- **incomplete**: required source data is missing (must be shown explicitly)

## Explainability contract

Every report output must include:

- `sources[]`: list of tables / upstream sources
- `findings[]`: issues, including “missing data” (do not hide)
- `metrics[]`: values with optional per-metric sources

