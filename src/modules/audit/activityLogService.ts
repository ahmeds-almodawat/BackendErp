export type ActivitySeverity = "info" | "warning" | "critical";

export interface ActivityLogEntry {
  id: string;
  userId: string;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  severity: ActivitySeverity;
  description: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface ActivityLogInput {
  userId: string;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  severity?: ActivitySeverity;
  description: string;
  metadata?: Record<string, unknown>;
}

const activityLogBuffer: ActivityLogEntry[] = [];

export function createActivityLogEntry(input: ActivityLogInput): ActivityLogEntry {
  return {
    id: crypto.randomUUID(),
    userId: input.userId,
    action: input.action,
    module: input.module,
    entityType: input.entityType,
    entityId: input.entityId,
    severity: input.severity ?? "info",
    description: input.description,
    metadata: input.metadata,
    createdAt: new Date().toISOString(),
  };
}

export function recordLocalActivity(input: ActivityLogInput): ActivityLogEntry {
  const entry = createActivityLogEntry(input);
  activityLogBuffer.unshift(entry);
  return entry;
}

export function listLocalActivity(): ActivityLogEntry[] {
  return [...activityLogBuffer];
}
