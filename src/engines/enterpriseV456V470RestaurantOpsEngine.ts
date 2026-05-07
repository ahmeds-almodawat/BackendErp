export type RestaurantOpsTone = 'good' | 'warn' | 'bad' | 'info' | 'neutral';

export interface RestaurantOpsFinding {
  area: string;
  title: string;
  detail: string;
  tone: RestaurantOpsTone;
  action: string;
}

export interface RestaurantOpsDecisionLine {
  requestRef: string;
  itemName: string;
  requestedQty: number;
  availableQty: number;
  reservedQty: number;
  freeQty: number;
  reserveQty: number;
  shortageQty: number;
  recommendedAction: 'reserve-and-transfer' | 'reserve-and-issue' | 'partial-reserve-shortage-po' | 'shortage-po' | 'review';
  supplierHint: string;
}

export interface RestaurantOpsSupplierSplit {
  supplierName: string;
  supplierId: string;
  lines: Array<{ itemName: string; shortageQty: number; unitCost: number; estimatedValue: number }>;
  estimatedValue: number;
}

export interface RestaurantOpsSnapshot {
  score: number;
  status: 'ready-for-pilot' | 'needs-review' | 'blocked';
  headline: string;
  findings: RestaurantOpsFinding[];
  decisions: RestaurantOpsDecisionLine[];
  supplierSplits: RestaurantOpsSupplierSplit[];
  batchControls: RestaurantOpsFinding[];
  cycle: Array<{ step: string; owner: string; outcome: string; proof: string }>;
}

function list<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function nameOf(record: any, locale: 'en' | 'ar' = 'en') {
  if (!record) return '—';
  return locale === 'ar'
    ? record.nameAr || record.name_ar || record.name || record.nameEn || record.code || record.sku || '—'
    : record.nameEn || record.name_en || record.name || record.nameAr || record.code || record.sku || '—';
}

function itemName(state: any, itemId: string, locale: 'en' | 'ar') {
  const item = list<any>(state?.items).find((x) => x.id === itemId);
  return item ? `${item.sku ? `${item.sku} · ` : ''}${nameOf(item, locale)}` : itemId || '—';
}

function supplierName(state: any, supplierId: string, locale: 'en' | 'ar') {
  const supplier = list<any>(state?.suppliers).find((x) => x.id === supplierId);
  return supplier ? nameOf(supplier, locale) : supplierId || 'Unassigned supplier';
}

function movementQty(state: any, storeId: string, itemId: string) {
  return list<any>(state?.stockMovements)
    .filter((m) => m.storeId === storeId && m.itemId === itemId)
    .reduce((sum, m) => sum + (m.direction === 'in' ? 1 : -1) * num(m.qty), 0);
}

function reservedQty(state: any, storeId: string, itemId: string) {
  const explicit = list<any>(state?.inventoryReservations)
    .filter((r) => r.storeId === storeId && r.itemId === itemId && !['cancelled', 'issued', 'closed'].includes(String(r.status)))
    .reduce((sum, r) => sum + num(r.qty ?? r.reservedQty), 0);

  if (explicit > 0) return explicit;

  return list<any>(state?.materialRequests)
    .filter((r) => r.storeId === storeId && ['submitted', 'approved', 'reserved'].includes(String(r.status)))
    .flatMap((r) => list<any>(r.lines))
    .filter((l) => l.itemId === itemId)
    .reduce((sum, l) => sum + num(l.qty), 0);
}

function averageCost(state: any, itemId: string) {
  const ins = list<any>(state?.stockMovements).filter((m) => m.itemId === itemId && m.direction === 'in' && num(m.qty) > 0);
  const value = ins.reduce((sum, m) => sum + num(m.qty) * num(m.unitCost), 0);
  const qty = ins.reduce((sum, m) => sum + num(m.qty), 0);
  const item = list<any>(state?.items).find((x) => x.id === itemId);
  return qty > 0 ? value / qty : num(item?.standardCost);
}

function supplierHintForItem(state: any, itemId: string) {
  const lastPurchase = [...list<any>(state?.purchaseInvoices)]
    .reverse()
    .find((invoice) => list<any>(invoice.lines).some((line) => line.itemId === itemId));
  if (lastPurchase?.supplierId) return lastPurchase.supplierId;

  const firstSupplier = list<any>(state?.suppliers).find((s) => s.active !== false);
  return firstSupplier?.id || 'unassigned';
}

export function buildRestaurantOpsSnapshot(state: any, locale: 'en' | 'ar' = 'en'): RestaurantOpsSnapshot {
  const findings: RestaurantOpsFinding[] = [];
  const materialRequests = list<any>(state?.materialRequests);
  const stores = list<any>(state?.stores);
  const items = list<any>(state?.items);
  const lots = list<any>(state?.inventoryLots);
  const transfers = list<any>(state?.transfers);
  const internalIssues = list<any>(state?.internalStockIssues);
  const reservations = list<any>(state?.inventoryReservations);

  const openRequests = materialRequests.filter((r) => ['submitted', 'approved', 'reserved'].includes(String(r.status)));
  const decisions: RestaurantOpsDecisionLine[] = [];
  const supplierMap = new Map<string, RestaurantOpsSupplierSplit>();

  for (const request of openRequests) {
    for (const line of list<any>(request.lines)) {
      const onHand = movementQty(state, request.storeId, line.itemId);
      const reserved = reservedQty(state, request.storeId, line.itemId);
      const free = Math.max(0, onHand - reserved);
      const requested = num(line.qty);
      const reserve = Math.min(free, requested);
      const shortage = Math.max(0, requested - reserve);
      const supplierId = supplierHintForItem(state, line.itemId);
      const action: RestaurantOpsDecisionLine['recommendedAction'] =
        requested <= 0 ? 'review'
          : reserve >= requested ? 'reserve-and-issue'
            : reserve > 0 && shortage > 0 ? 'partial-reserve-shortage-po'
              : shortage > 0 ? 'shortage-po'
                : 'review';

      decisions.push({
        requestRef: request.ref,
        itemName: itemName(state, line.itemId, locale),
        requestedQty: requested,
        availableQty: onHand,
        reservedQty: reserved,
        freeQty: free,
        reserveQty: reserve,
        shortageQty: shortage,
        recommendedAction: action,
        supplierHint: supplierName(state, supplierId, locale),
      });

      if (shortage > 0) {
        const key = supplierId || 'unassigned';
        const existing = supplierMap.get(key) || {
          supplierId: key,
          supplierName: supplierName(state, key, locale),
          lines: [],
          estimatedValue: 0,
        };
        const cost = averageCost(state, line.itemId);
        const estimatedValue = shortage * cost;
        existing.lines.push({ itemName: itemName(state, line.itemId, locale), shortageQty: shortage, unitCost: cost, estimatedValue });
        existing.estimatedValue += estimatedValue;
        supplierMap.set(key, existing);
      }
    }
  }

  const noStockControl = openRequests.length > 0 && decisions.length === 0;
  if (noStockControl) {
    findings.push({ area: 'Material requests', title: 'Open requests have no analyzable lines', detail: 'Review request line data before approval or PO creation.', tone: 'warn', action: 'Fix request line items and quantities.' });
  }

  if (openRequests.length && !reservations.length) {
    findings.push({ area: 'Reservations', title: 'Open requests without reservation evidence', detail: 'Stock can be double-promised unless reservations are recorded before issue or transfer.', tone: 'warn', action: 'Reserve free stock before internal issue / transfer.' });
  }

  if (decisions.some((d) => d.shortageQty > 0)) {
    findings.push({ area: 'Purchasing', title: 'Shortage quantities require supplier split', detail: 'One material request can generate multiple POs, but each PO should belong to one supplier.', tone: 'info', action: 'Create shortage POs grouped by supplier.' });
  }

  if (transfers.length === 0 && internalIssues.length === 0 && reservations.length > 0) {
    findings.push({ area: 'Fulfillment', title: 'Reserved stock not yet fulfilled', detail: 'Reservations should end as store transfer or internal issue, not remain open indefinitely.', tone: 'warn', action: 'Create transfer / issue and close the request.' });
  }

  const expiringLots = lots.filter((lot) => {
    if (!lot.expiryDate) return false;
    const days = Math.ceil((new Date(`${lot.expiryDate}T00:00:00`).getTime() - Date.now()) / 86400000);
    return days <= 7;
  });

  const batchControls: RestaurantOpsFinding[] = [];
  if (!lots.length) {
    batchControls.push({ area: 'Batch control', title: 'No batch/lot records detected', detail: 'Receiving should record Batch No., bin, and expiry for food safety and FEFO.', tone: 'warn', action: 'Require Batch No. and expiry for perishable items.' });
  } else if (expiringLots.length) {
    batchControls.push({ area: 'FEFO', title: `${expiringLots.length} batch(es) near expiry`, detail: 'Near-expiry batches should be issued before newer stock or quarantined.', tone: 'warn', action: 'Review FEFO pick list and quarantine rules.' });
  } else {
    batchControls.push({ area: 'Batch control', title: 'Batch/expiry records available', detail: 'Inventory lots exist and can support FEFO and recall tracking.', tone: 'good', action: 'Keep Batch No. mandatory on receiving.' });
  }

  if (!items.length || !stores.length) {
    findings.push({ area: 'Master data', title: 'Missing item/store master data', detail: 'Workflow cannot run smoothly without items and stores.', tone: 'bad', action: 'Load master data before pilot.' });
  }

  const bad = findings.filter((f) => f.tone === 'bad').length;
  const warn = findings.filter((f) => f.tone === 'warn').length + batchControls.filter((f) => f.tone === 'warn').length;
  const score = Math.max(0, Math.min(100, 92 - bad * 30 - warn * 9 - (decisions.some((d) => d.recommendedAction === 'review') ? 10 : 0)));

  return {
    score,
    status: bad > 0 ? 'blocked' : warn > 2 ? 'needs-review' : 'ready-for-pilot',
    headline: score >= 85 ? 'Restaurant workflow is ready for pilot validation.' : score >= 65 ? 'Restaurant workflow is usable but needs manager review.' : 'Restaurant workflow needs cleanup before pilot.',
    findings: findings.length ? findings : [{ area: 'Workflow', title: 'No major blockers detected', detail: 'Material requests, fulfillment, and supplier split logic are ready for manual pilot testing.', tone: 'good', action: 'Run a real pilot request cycle.' }],
    decisions,
    supplierSplits: [...supplierMap.values()],
    batchControls,
    cycle: [
      { step: 'Material Request', owner: 'Kitchen / branch', outcome: 'Request submitted with needed-by date and lines', proof: 'MR reference and requested quantities' },
      { step: 'Availability Check', owner: 'Store / manager', outcome: 'Free stock and shortages calculated', proof: 'On-hand - reserved = free stock' },
      { step: 'Reservation', owner: 'Storekeeper', outcome: 'Stock held for approved request', proof: 'Reservation reference and expiry' },
      { step: 'Transfer / Issue', owner: 'Storekeeper', outcome: 'Stock moved to kitchen store or consumed to cost center', proof: 'Transfer or internal issue document' },
      { step: 'Shortage PO', owner: 'Purchasing', outcome: 'PO created only for shortage and split by supplier', proof: 'Supplier-specific PO references' },
      { step: 'Close Request', owner: 'Manager', outcome: 'Request cannot remain open after fulfillment', proof: 'Closed MR with audit trail' },
    ],
  };
}

export function restaurantOpsCsv(snapshot: RestaurantOpsSnapshot) {
  const rows = [
    ['section', 'ref_or_area', 'item_or_title', 'requested', 'free', 'reserve', 'shortage', 'action'],
    ...snapshot.decisions.map((d) => ['decision', d.requestRef, d.itemName, d.requestedQty, d.freeQty, d.reserveQty, d.shortageQty, d.recommendedAction]),
    ...snapshot.findings.map((f) => ['finding', f.area, f.title, '', '', '', '', f.action]),
    ...snapshot.batchControls.map((f) => ['batch', f.area, f.title, '', '', '', '', f.action]),
  ];
  return rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
}
