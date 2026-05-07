export interface FinalEnterpriseReadinessInput {
  stagingVerified: boolean;
  rlsDryRunPassed: boolean;
  uatSeedDataVerified: boolean;
  cutoverRehearsalPassed: boolean;
  backupRestorePassed: boolean;
  supportReady: boolean;
  auditReady: boolean;
}

export function calculateFinalEnterpriseReadiness(input: FinalEnterpriseReadinessInput) {
  const checks = [
    { key: "staging_verified", ok: input.stagingVerified, weight: 20 },
    { key: "rls_dry_run_passed", ok: input.rlsDryRunPassed, weight: 20 },
    { key: "uat_seed_data_verified", ok: input.uatSeedDataVerified, weight: 10 },
    { key: "cutover_rehearsal_passed", ok: input.cutoverRehearsalPassed, weight: 20 },
    { key: "backup_restore_passed", ok: input.backupRestorePassed, weight: 15 },
    { key: "support_ready", ok: input.supportReady, weight: 7.5 },
    { key: "audit_ready", ok: input.auditReady, weight: 7.5 },
  ];

  const score = checks.reduce((sum, check) => sum + (check.ok ? check.weight : 0), 0);
  const failed = checks.filter((check) => !check.ok).map((check) => check.key);

  return {
    score,
    status: failed.length === 0 && score >= 95 ? "ready" : score >= 75 ? "warning" : "blocked",
    failed,
    checks,
  };
}
