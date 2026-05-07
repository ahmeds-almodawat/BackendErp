export type SubledgerType = "ap" | "ar";

export interface SubledgerTransaction {
  id: string;
  subledgerType: SubledgerType;
  partyId: string;
  partyName?: string;
  branchId?: string;
  documentNo: string;
  documentDate: string;
  dueDate?: string;
  debit: number;
  credit: number;
  balance: number;
  status: "open" | "partially_paid" | "paid" | "cancelled" | "reversed";
}

export interface AgingBucket {
  label: string;
  fromDay: number;
  toDay?: number;
  amount: number;
}

export interface PartyAgingSummary {
  partyId: string;
  partyName?: string;
  totalBalance: number;
  buckets: AgingBucket[];
  overdueAmount: number;
}

export function daysBetween(fromDate: string, toDate: string): number {
  const from = new Date(fromDate);
  const to = new Date(toDate);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return 0;
  }

  return Math.floor((to.getTime() - from.getTime()) / 86400000);
}

export function classifyAgingBucket(ageDays: number): string {
  if (ageDays <= 30) return "0-30";
  if (ageDays <= 60) return "31-60";
  if (ageDays <= 90) return "61-90";
  return "90+";
}

export function buildAgingSummary(transactions: SubledgerTransaction[], asOfDate: string): PartyAgingSummary[] {
  const byParty = new Map<string, PartyAgingSummary>();

  transactions
    .filter((transaction) => transaction.status !== "paid" && transaction.status !== "cancelled" && transaction.status !== "reversed")
    .forEach((transaction) => {
      const party = byParty.get(transaction.partyId) ?? {
        partyId: transaction.partyId,
        partyName: transaction.partyName,
        totalBalance: 0,
        overdueAmount: 0,
        buckets: [
          { label: "0-30", fromDay: 0, toDay: 30, amount: 0 },
          { label: "31-60", fromDay: 31, toDay: 60, amount: 0 },
          { label: "61-90", fromDay: 61, toDay: 90, amount: 0 },
          { label: "90+", fromDay: 91, amount: 0 },
        ],
      };

      const dueDate = transaction.dueDate ?? transaction.documentDate;
      const age = Math.max(0, daysBetween(dueDate, asOfDate));
      const bucketLabel = classifyAgingBucket(age);
      const bucket = party.buckets.find((item) => item.label === bucketLabel);

      if (bucket) {
        bucket.amount += transaction.balance;
      }

      party.totalBalance += transaction.balance;

      if (age > 0) {
        party.overdueAmount += transaction.balance;
      }

      byParty.set(transaction.partyId, party);
    });

  return Array.from(byParty.values());
}
