export type PostingStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "posted"
  | "reversed"
  | "cancelled"
  | "voided";

export const immutablePostingStatuses: PostingStatus[] = [
  "posted",
  "reversed",
  "voided",
];

export function isPostingImmutable(status: PostingStatus): boolean {
  return immutablePostingStatuses.includes(status);
}

export function assertPostingTransitionAllowed(from: PostingStatus, to: PostingStatus): string[] {
  const findings: string[] = [];

  if (isPostingImmutable(from) && to !== "reversed") {
    findings.push(`Cannot change a ${from} posting to ${to}. Use reversal instead.`);
  }

  if (from === "draft" && to === "posted") {
    findings.push("Draft postings must be approved or validated before posting.");
  }

  if (from === "cancelled" && to !== "draft") {
    findings.push("Cancelled postings cannot move forward.");
  }

  return findings;
}
