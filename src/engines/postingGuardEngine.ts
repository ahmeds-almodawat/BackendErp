export type PostingGuardResult = {
  allowed: boolean;
  blockers: string[];
  warnings: string[];
  recommendedStatus: 'draft' | 'submitted' | 'approved' | 'posted' | 'blocked';
};

const arr = (value: unknown): any[] => Array.isArray(value) ? value : [];
const num = (value: unknown) => Number(value || 0);

export function checkPostingGuard(state: any, eventKey: string): PostingGuardResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const openPeriod = arr(state?.fiscalPeriods).some((p) => p.status === 'open');
  if (!openPeriod) blockers.push('No open fiscal period.');
  const roles = arr(state?.roles);
  const permissions = new Set(roles.flatMap((r) => arr(r.permissions)));
  const needed: Record<string, string[]> = {
    foodics_full_post: ['sales.post'],
    stock_count_post: ['inventory.adjustment.approve'],
    supplier_payment_post: ['purchasing.payment.post'],
    manual_journal_post: ['finance.journal.post'],
    production_post: ['production.batch.post'],
  };
  (needed[eventKey] || []).forEach((p) => { if (!permissions.has(p)) warnings.push(`Permission not covered by any role: ${p}`); });
  if (eventKey === 'manual_journal_post') {
    const drafts = arr(state?.journals).filter((j) => j.status === 'draft');
    const bad = drafts.filter((j) => {
      const debit = arr(j.lines).reduce((s, l) => s + num(l.debit), 0);
      const credit = arr(j.lines).reduce((s, l) => s + num(l.credit), 0);
      return Math.abs(debit - credit) > 0.01;
    });
    if (bad.length) blockers.push(`${bad.length} draft journals are unbalanced.`);
  }
  return { allowed: blockers.length === 0, blockers, warnings, recommendedStatus: blockers.length ? 'blocked' : warnings.length ? 'approved' : 'posted' };
}
