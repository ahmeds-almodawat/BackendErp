export type DeploymentEnvironment = "development" | "staging" | "production";
export type DeploymentStatus = "planned" | "running" | "succeeded" | "failed" | "rolled_back";

export interface DeploymentEvent {
  id: string;
  environment: DeploymentEnvironment;
  version: string;
  status: DeploymentStatus;
  notes?: string;
  createdAt: string;
}

export function createDeploymentEvent(input: {
  environment: DeploymentEnvironment;
  version: string;
  status: DeploymentStatus;
  notes?: string;
}): DeploymentEvent {
  return {
    id: crypto.randomUUID(),
    environment: input.environment,
    version: input.version,
    status: input.status,
    notes: input.notes,
    createdAt: new Date().toISOString(),
  };
}

export function summarizeDeploymentEvents(events: DeploymentEvent[]) {
  return {
    total: events.length,
    succeeded: events.filter((event) => event.status === "succeeded").length,
    failed: events.filter((event) => event.status === "failed").length,
    rolledBack: events.filter((event) => event.status === "rolled_back").length,
  };
}
