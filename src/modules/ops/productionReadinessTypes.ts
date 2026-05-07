export type ProductionReadinessArea =
  | "auth"
  | "access_control"
  | "database"
  | "posting"
  | "imports"
  | "reporting"
  | "backup"
  | "deployment"
  | "performance"
  | "observability"
  | "security"
  | "documentation";

export type ProductionReadinessStatus = "ready" | "warning" | "blocked" | "not_checked";
export type ProductionReadinessSeverity = "info" | "warning" | "critical";

export interface ProductionReadinessCheck {
  key: string;
  area: ProductionReadinessArea;
  label: string;
  requiredForGoLive: boolean;
  status: ProductionReadinessStatus;
}

export interface ProductionReadinessFinding {
  id: string;
  area: ProductionReadinessArea;
  severity: ProductionReadinessSeverity;
  message: string;
  action: string;
}

export interface ProductionReadinessSummary {
  readinessScore: number;
  status: ProductionReadinessStatus;
  criticalCount: number;
  warningCount: number;
  blockedAreas: ProductionReadinessArea[];
  findings: ProductionReadinessFinding[];
}

export interface BackupRestoreTest {
  id: string;
  environment: "staging" | "production";
  status: "planned" | "passed" | "failed";
  testedAt?: string;
  notes?: string;
}

export interface SystemHealthCheck {
  key: string;
  label: string;
  ok: boolean;
  message: string;
}
