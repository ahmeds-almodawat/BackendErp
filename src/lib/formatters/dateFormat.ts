export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? "-" : date.toISOString().slice(0, 10);
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? "-" : date.toISOString().replace("T", " ").slice(0, 16);
}

export function formatBusinessPeriod(start: string | Date, end: string | Date): string {
  return `${formatDate(start)} to ${formatDate(end)}`;
}
