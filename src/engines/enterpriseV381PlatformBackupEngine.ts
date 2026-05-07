export type V381BackupScope = 'full-platform' | 'operations-only' | 'finance-only' | 'master-data-only';

export interface V381BackupManifest {
  version: string;
  generatedAt: string;
  scope: V381BackupScope;
  appName: string;
  stateHash: string;
  stateBytes: number;
  fileCount: number;
  entityCounts: Record<string, number>;
  totals?: Record<string, unknown>;
  warnings: string[];
  restoreMode: 'replace-current-local-state';
}

export interface V381BackupPackage {
  manifest: V381BackupManifest;
  blob: Blob;
  filename: string;
}

export interface V381RestorePreview {
  ok: boolean;
  manifest?: V381BackupManifest;
  state?: any;
  source: 'zip' | 'json' | 'unknown';
  warnings: string[];
  error?: string;
}

const BACKUP_VERSION = 'v381 Platform Backup Package';
const APP_NAME = 'Restaurant ERP';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function v381EntityCounts(state: any): Record<string, number> {
  const counts: Record<string, number> = {};
  if (!isPlainObject(state)) return counts;
  for (const [key, value] of Object.entries(state)) {
    if (Array.isArray(value)) counts[key] = value.length;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

export function v381BackupWarnings(state: any): string[] {
  const warnings: string[] = [];
  const counts = v381EntityCounts(state);
  if (!Object.keys(counts).length) warnings.push('Backup state has no array-based entity collections.');
  if (!counts.branches) warnings.push('No branches detected in backup state.');
  if (!counts.items) warnings.push('No items detected in backup state.');
  if (!counts.journals) warnings.push('No journal entries detected in backup state.');
  if (!Array.isArray(state?.audits) || state.audits.length === 0) warnings.push('No audit trail rows detected in backup state.');
  return warnings;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function fnv1aHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function writeU16(out: number[], value: number) {
  out.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeU32(out: number[], value: number) {
  out.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function readU16(view: DataView, offset: number) {
  return view.getUint16(offset, true);
}

function readU32(view: DataView, offset: number) {
  return view.getUint32(offset, true);
}

function dateStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function sanitizeTotals(totals: any): Record<string, unknown> {
  if (!isPlainObject(totals)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(totals)) {
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') out[key] = value;
  }
  return out;
}

function createStoredZip(files: Array<{ name: string; content: string | Uint8Array }>): Blob {
  const localParts: Uint8Array[] = [];
  const central: number[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = typeof file.content === 'string' ? encoder.encode(file.content) : file.content;
    const crc = crc32(data);

    const local: number[] = [];
    writeU32(local, 0x04034b50);
    writeU16(local, 20);
    writeU16(local, 0);
    writeU16(local, 0);
    writeU16(local, 0);
    writeU16(local, 0);
    writeU32(local, crc);
    writeU32(local, data.length);
    writeU32(local, data.length);
    writeU16(local, nameBytes.length);
    writeU16(local, 0);
    const localBytes = new Uint8Array([...local, ...nameBytes, ...data]);
    localParts.push(localBytes);

    writeU32(central, 0x02014b50);
    writeU16(central, 20);
    writeU16(central, 20);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU32(central, crc);
    writeU32(central, data.length);
    writeU32(central, data.length);
    writeU16(central, nameBytes.length);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU32(central, 0);
    writeU32(central, offset);
    central.push(...nameBytes);

    offset += localBytes.length;
  }

  const centralOffset = offset;
  const centralBytes = new Uint8Array(central);
  const end: number[] = [];
  writeU32(end, 0x06054b50);
  writeU16(end, 0);
  writeU16(end, 0);
  writeU16(end, files.length);
  writeU16(end, files.length);
  writeU32(end, centralBytes.length);
  writeU32(end, centralOffset);
  writeU16(end, 0);

  return new Blob([...localParts, centralBytes, new Uint8Array(end)], { type: 'application/zip' });
}

async function parseStoredZip(file: File): Promise<Record<string, string>> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const files: Record<string, string> = {};
  let offset = 0;

  while (offset + 30 <= bytes.length && readU32(view, offset) === 0x04034b50) {
    const compression = readU16(view, offset + 8);
    const compressedSize = readU32(view, offset + 18);
    const uncompressedSize = readU32(view, offset + 22);
    const nameLen = readU16(view, offset + 26);
    const extraLen = readU16(view, offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLen + extraLen;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLen));
    const data = bytes.slice(dataStart, dataStart + compressedSize);

    if (compression !== 0) throw new Error(`Unsupported compressed ZIP entry: ${name}. Use a v381 backup ZIP exported by this ERP.`);
    if (compressedSize !== uncompressedSize) throw new Error(`Invalid stored ZIP entry size for ${name}.`);
    files[name] = decoder.decode(data);
    offset = dataStart + compressedSize;
  }

  return files;
}

export async function createV381PlatformBackupPackage(state: any, totals: any = {}, scope: V381BackupScope = 'full-platform'): Promise<V381BackupPackage> {
  const stateJson = JSON.stringify(state ?? {}, null, 2);
  const manifest: V381BackupManifest = {
    version: BACKUP_VERSION,
    generatedAt: new Date().toISOString(),
    scope,
    appName: APP_NAME,
    stateHash: fnv1aHash(stateJson),
    stateBytes: encoder.encode(stateJson).length,
    fileCount: 5,
    entityCounts: v381EntityCounts(state),
    totals: sanitizeTotals(totals),
    warnings: v381BackupWarnings(state),
    restoreMode: 'replace-current-local-state',
  };

  const summary = {
    generatedAt: manifest.generatedAt,
    entityCounts: manifest.entityCounts,
    totals: manifest.totals,
    auditRows: Array.isArray(state?.audits) ? state.audits.length : 0,
    warningCount: manifest.warnings.length,
  };

  const files = [
    { name: 'manifest.json', content: JSON.stringify(manifest, null, 2) },
    { name: 'erp-state.json', content: stateJson },
    { name: 'summary.json', content: JSON.stringify(summary, null, 2) },
    { name: 'audit-extract.json', content: JSON.stringify(Array.isArray(state?.audits) ? state.audits : [], null, 2) },
    { name: 'restore-instructions.txt', content: 'Restore from the ERP Backup / Restore page. This package replaces the current local ERP state after confirmation. Keep a separate copy before restoring.\n' },
  ];

  return {
    manifest,
    blob: createStoredZip(files),
    filename: `restaurant-erp-${scope}-backup-${dateStamp()}.zip`,
  };
}

export async function previewV381RestoreFile(file: File): Promise<V381RestorePreview> {
  try {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.zip') || lower.endsWith('.erpbackup')) {
      const zipFiles = await parseStoredZip(file);
      const manifestText = zipFiles['manifest.json'];
      const stateText = zipFiles['erp-state.json'];
      if (!manifestText || !stateText) throw new Error('ZIP backup must contain manifest.json and erp-state.json.');
      const manifest = JSON.parse(manifestText) as V381BackupManifest;
      const state = JSON.parse(stateText);
      const hash = fnv1aHash(JSON.stringify(state, null, 2));
      const warnings = [...(manifest.warnings ?? [])];
      if (manifest.stateHash && manifest.stateHash !== hash) warnings.push('State hash differs after parsing. Continue only if this backup came from a trusted source.');
      return { ok: true, manifest, state, source: 'zip', warnings };
    }

    const text = await file.text();
    const parsed = JSON.parse(text);
    const state = parsed?.state && isPlainObject(parsed.state) ? parsed.state : parsed;
    const manifest: V381BackupManifest = parsed?.manifest && isPlainObject(parsed.manifest)
      ? parsed.manifest as V381BackupManifest
      : {
        version: 'Legacy JSON backup',
        generatedAt: new Date().toISOString(),
        scope: 'full-platform',
        appName: APP_NAME,
        stateHash: fnv1aHash(JSON.stringify(state, null, 2)),
        stateBytes: encoder.encode(JSON.stringify(state, null, 2)).length,
        fileCount: 1,
        entityCounts: v381EntityCounts(state),
        warnings: ['Legacy JSON backup detected. Restore is allowed, but ZIP manifest evidence is not available.'],
        restoreMode: 'replace-current-local-state',
      };
    return { ok: true, manifest, state, source: 'json', warnings: manifest.warnings ?? [] };
  } catch (error) {
    return { ok: false, source: 'unknown', warnings: [], error: error instanceof Error ? error.message : String(error) };
  }
}

export function downloadV381Blob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}
