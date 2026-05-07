export type PostingIntent = {
  documentType: string;
  reference: string;
  mode: 'report-only' | 'sales-accounting' | 'full-erp' | 'inventory' | 'finance';
  requestedBy?: string;
  period?: string;
};

export type PostingGuardResult = {
  allowed: boolean;
  blockers: string[];
  warnings: string[];
  nextStatus: string;
};

export function evaluatePostingIntent(intent: PostingIntent, state: any): PostingGuardResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!intent.reference) blockers.push('Missing document reference.');
  if (!intent.documentType) blockers.push('Missing document type.');
  if (!Array.isArray(state?.fiscalPeriods) || !state.fiscalPeriods.length) warnings.push('No fiscal periods configured; period lock enforcement is not fully active.');
  if (intent.mode === 'full-erp') {
    const stockMovements = Array.isArray(state?.stockMovements) ? state.stockMovements : [];
    if (!stockMovements.length) blockers.push('No stock movements exist; upload opening stock or purchase invoices before full ERP posting.');
  }
  return { allowed: blockers.length === 0, blockers, warnings, nextStatus: blockers.length ? 'blocked' : 'ready-for-approval' };
}
