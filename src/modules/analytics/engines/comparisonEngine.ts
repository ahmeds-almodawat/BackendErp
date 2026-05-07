export type ComparisonPreset = 'yesterday' | 'sameDayLastWeek' | 'sameDayLastYear' | 'previousSameLength' | 'previousMonth' | 'custom';
export type DateBounds = { from: string; to: string };

const asDate = (value: string) => new Date(`${value}T00:00:00`);
const iso = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (value: string, days: number) => { const d = asDate(value); d.setDate(d.getDate() + days); return iso(d); };
const daysBetweenInclusive = (from: string, to: string) => Math.max(1, Math.round((asDate(to).getTime() - asDate(from).getTime()) / 86400000) + 1);
const shiftMonth = (value: string, months: number) => { const d = asDate(value); return iso(new Date(d.getFullYear(), d.getMonth() + months, d.getDate())); };

export function buildComparisonBounds(preset: ComparisonPreset, current: DateBounds, custom?: DateBounds): DateBounds {
  if (!current.from || !current.to) return { from: '', to: '' };
  if (preset === 'custom') return custom ?? { from: '', to: '' };
  if (preset === 'yesterday') return { from: addDays(current.to, -1), to: addDays(current.to, -1) };
  if (preset === 'sameDayLastWeek') return { from: addDays(current.from, -7), to: addDays(current.to, -7) };
  if (preset === 'sameDayLastYear') return { from: addDays(current.from, -364), to: addDays(current.to, -364) };
  if (preset === 'previousMonth') return { from: shiftMonth(current.from, -1), to: shiftMonth(current.to, -1) };
  const days = daysBetweenInclusive(current.from, current.to);
  const to = addDays(current.from, -1);
  return { from: addDays(to, -(days - 1)), to };
}
