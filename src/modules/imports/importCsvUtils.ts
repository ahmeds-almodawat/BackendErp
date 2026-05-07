export type CsvParseResult = { headers: string[]; rows: Array<Record<string, string>> };

export function normalizeImportKey(value: string) {
  return value.toLowerCase().replace(/[\s_\-./\\]+/g, '').trim();
}

export function parseCsvText(text: string): CsvParseResult {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (ch === ',' && !quoted) {
      row.push(current.trim());
      current = '';
      continue;
    }
    if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(current.trim());
      current = '';
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      continue;
    }
    current += ch;
  }

  row.push(current.trim());
  if (row.some((cell) => cell !== '')) rows.push(row);
  const headers = rows[0] ?? [];
  return {
    headers,
    rows: rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']))),
  };
}

export function numberValue(value: string | undefined, fallback = 0) {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : fallback;
}
