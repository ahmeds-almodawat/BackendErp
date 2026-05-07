export interface BackupPolicy {
  environment: "staging" | "production";
  dailyDatabaseBackup: boolean;
  backupBeforeMigration: boolean;
  restoreTestRequired: boolean;
  retentionDays: number;
}

export interface BackupRun {
  id: string;
  environment: "staging" | "production";
  backupType: "scheduled" | "pre_migration" | "manual";
  status: "succeeded" | "failed";
  createdAt: string;
}

export interface RestoreTest {
  id: string;
  environment: "staging" | "production";
  status: "passed" | "failed" | "not_tested";
  testedAt?: string;
}

export const defaultBackupPolicy: BackupPolicy = {
  environment: "production",
  dailyDatabaseBackup: true,
  backupBeforeMigration: true,
  restoreTestRequired: true,
  retentionDays: 30,
};

export function evaluateBackupReadiness(policy: BackupPolicy, lastRestoreTest?: RestoreTest) {
  const findings: string[] = [];

  if (!policy.dailyDatabaseBackup) findings.push("Production requires daily database backup.");
  if (!policy.backupBeforeMigration) findings.push("Production requires backup before migrations.");
  if (policy.restoreTestRequired && lastRestoreTest?.status !== "passed") {
    findings.push("Backup is not trusted until restore was tested on staging.");
  }

  return {
    ok: findings.length === 0,
    findings,
  };
}
