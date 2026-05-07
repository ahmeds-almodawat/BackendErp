export type DataQualitySeverity = 'ok' | 'warning' | 'critical';
export type DataQualityCheck = { key: string; label: string; severity: DataQualitySeverity; action: string };

export function summarizeQuality(checks: DataQualityCheck[]) {
  const critical = checks.filter((check) => check.severity === 'critical').length;
  const warning = checks.filter((check) => check.severity === 'warning').length;
  const ok = checks.filter((check) => check.severity === 'ok').length;
  const score = Math.max(0, Math.round(((ok + warning * 0.5) / Math.max(checks.length, 1)) * 100));
  return { score, critical, warning, ok };
}
