export type AppErrorSeverity = "info" | "warning" | "error" | "critical";

export interface AppErrorLog {
  id: string;
  referenceId: string;
  severity: AppErrorSeverity;
  module: string;
  message: string;
  technicalDetails?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export function formatErrorReference(date = new Date()): string {
  return `ERR-${date.getFullYear()}-${date.getTime().toString(36).toUpperCase()}`;
}

export function createAppErrorLog(input: {
  severity: AppErrorSeverity;
  module: string;
  message: string;
  technicalDetails?: string;
  metadata?: Record<string, unknown>;
}): AppErrorLog {
  return {
    id: crypto.randomUUID(),
    referenceId: formatErrorReference(),
    severity: input.severity,
    module: input.module,
    message: input.message,
    technicalDetails: input.technicalDetails,
    metadata: input.metadata,
    createdAt: new Date().toISOString(),
  };
}

export function createUserSafeErrorMessage(log: AppErrorLog): string {
  return `Action failed. Reference ID: ${log.referenceId}`;
}
