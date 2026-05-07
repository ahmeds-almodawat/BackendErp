export type StockMove = {
  itemId: string;
  storeId: string;
  direction: 'in' | 'out';
  qty: number;
  unitCost: number;
};

export function weightedAverageCost(movements: StockMove[], itemId: string, storeId?: string): number {
  const incoming = movements.filter((move) => move.itemId === itemId && move.direction === 'in' && move.unitCost > 0 && (!storeId || move.storeId === storeId));
  const qty = incoming.reduce((sum, move) => sum + Number(move.qty || 0), 0);
  const value = incoming.reduce((sum, move) => sum + Number(move.qty || 0) * Number(move.unitCost || 0), 0);
  return qty ? value / qty : 0;
}

export function availableStock(args: { onHand: number; reserved?: number; quarantine?: number; expired?: number; inTransitOut?: number; inTransitIn?: number }): number {
  return Number(args.onHand || 0) - Number(args.reserved || 0) - Number(args.quarantine || 0) - Number(args.expired || 0) - Number(args.inTransitOut || 0) + Number(args.inTransitIn || 0);
}
