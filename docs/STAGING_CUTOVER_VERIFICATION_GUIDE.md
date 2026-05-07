# Staging Cutover Verification Guide

Before production:

1. Apply migrations to staging.
2. Run staging verification.
3. Register and execute RLS dry-run cases.
4. Load UAT seed data.
5. Execute full UAT scenarios.
6. Run cutover rehearsal.
7. Record final enterprise readiness snapshot.
8. Only proceed when readiness is green and backup/restore is proven.
