export type FiscalPeriodStatus = "open" | "locked" | "closed";

export interface FiscalPeriod {
  id: string;
  code: string;
  year: number;
  month?: number;
  startsAt: string;
  endsAt: string;
  status: FiscalPeriodStatus;
  closedBy?: string;
  closedAt?: string;
}

export function isPeriodOpen(period: FiscalPeriod | null | undefined): boolean {
  return period?.status === "open";
}

export function assertCanPostToPeriod(period: FiscalPeriod | null | undefined): string[] {
  const findings: string[] = [];

  if (!period) {
    findings.push("Fiscal period is required before posting.");
    return findings;
  }

  if (period.status === "locked") {
    findings.push(`Fiscal period ${period.code} is locked.`);
  }

  if (period.status === "closed") {
    findings.push(`Fiscal period ${period.code} is closed.`);
  }

  return findings;
}
