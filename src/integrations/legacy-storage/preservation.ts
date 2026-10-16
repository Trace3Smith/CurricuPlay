import { ACTIVE_KEY, HISTORY_KEY, LISTS_KEY } from '../../games/spelling-bee/storage';

/** The pre-ClassThread records kept in the one-time preservation snapshot. Never include auth data. */
export const legacyKeys = [
  'curricuplay.game.v1',
  'curricuplay.reviews.v1',
  'curricuplay.four-corners.v1',
  'curricuplay.four-corners.timer.v1',
  'curricuplay.sessions.v1',
] as const;
/** These are the only browser records eligible for a Games export. Never include auth data. */
export const exportKeys = [...legacyKeys, ACTIVE_KEY, LISTS_KEY, HISTORY_KEY] as const;
export const backupKey = 'classthread.legacy-backup.v1';
type StorageReader = Pick<Storage, 'getItem'>;
export interface BrowserArchive {
  format: 'classthread-browser-archive';
  version: 1;
  capturedAt: string;
  sourceOrigin: string;
  records: Record<typeof legacyKeys[number], string | null>;
}
export interface BrowserExport {
  format: 'classthread-browser-archive';
  version: 2;
  capturedAt: string;
  sourceOrigin: string;
  records: Record<typeof exportKeys[number], string | null>;
}

export function captureBrowserState(storage: StorageReader, origin: string, now = new Date()): BrowserArchive {
  return {
    format: 'classthread-browser-archive', version: 1,
    capturedAt: now.toISOString(), sourceOrigin: origin,
    records: Object.fromEntries(legacyKeys.map(key => [key, storage.getItem(key)])) as BrowserArchive['records'],
  };
}

/**
 * Current Games data for download; the stored preservation snapshot stays version 1.
 * Pass a pre-mount capture as `legacy` to keep its 5 raw values over what legacy components wrote since.
 */
export function captureBrowserExport(storage: StorageReader, origin: string, legacy?: BrowserArchive, now = new Date()): BrowserExport {
  return {
    format: 'classthread-browser-archive', version: 2,
    capturedAt: now.toISOString(), sourceOrigin: origin,
    records: Object.fromEntries(exportKeys.map(key => [key, legacy && key in legacy.records ? legacy.records[key as typeof legacyKeys[number]] : storage.getItem(key)])) as BrowserExport['records'],
  };
}

/** Call before mounting legacy components: their existing recovery effects can write on mount. */
export function preserveBrowserState(storage: Pick<Storage, 'getItem' | 'setItem'>, origin: string) {
  let archive: BrowserArchive | undefined;
  try {
    archive = captureBrowserState(storage, origin);
    if (Object.values(archive.records).some(value => value !== null) && storage.getItem(backupKey) === null) {
      storage.setItem(backupKey, JSON.stringify(archive));
    }
    return { archive, warning: '' };
  } catch {
    return { archive, warning: 'The browser could not save a preservation backup. Download your browser data before clearing storage.' };
  }
}

/** Fingerprints every record the archive holds, so stored version-1 snapshots keep their 5 checksums. */
export async function withChecksums<T extends BrowserArchive | BrowserExport>(archive: T) {
  const records: Record<string, string | null> = archive.records;
  const checksums: Record<string, string | null> = Object.fromEntries(await Promise.all(Object.keys(records).map(async key => {
    const raw = records[key];
    if (raw === null) return [key, null];
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    return [key, Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')];
  })));
  return { ...archive, checksums };
}

export async function downloadBrowserState(archive: BrowserArchive | BrowserExport) {
  const blob = new Blob([JSON.stringify(await withChecksums(archive), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `classthread-browser-backup-${archive.capturedAt.slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
