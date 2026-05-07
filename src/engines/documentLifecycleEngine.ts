export const enterpriseStatuses = ['draft','submitted','approved','posted','reversed','closed'] as const;
export type EnterpriseStatus = typeof enterpriseStatuses[number];

export function nextLifecycleAction(status: string) {
  switch (status) {
    case 'draft': return 'Submit for approval';
    case 'submitted': return 'Approve or reject';
    case 'approved': return 'Post document';
    case 'posted': return 'Close or reverse if needed';
    case 'reversed': return 'Review reversal audit';
    case 'closed': return 'Locked for close pack';
    default: return 'Normalize status';
  }
}

export function normalizeDocumentStatus(status: string | undefined) {
  if (!status) return 'draft';
  if (['converted','received','partially_received'].includes(status)) return 'posted';
  if (['cancelled','rejected'].includes(status)) return 'reversed';
  if (enterpriseStatuses.includes(status as EnterpriseStatus)) return status;
  return status;
}
