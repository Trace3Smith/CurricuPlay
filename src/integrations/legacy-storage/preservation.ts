/** These are the only browser records eligible for a Games export. Never include auth data. */
export const legacyKeys = [
  'curricuplay.game.v1',
  'curricuplay.reviews.v1',
  'curricuplay.four-corners.v1',
  'curricuplay.four-corners.timer.v1',
  'curricuplay.sessions.v1',
] as const;
export const backupKey = 'classthread.legacy-backup.v1';
type StorageReader = Pick<Storage, 'getItem'>;
export interface BrowserArchive {
  format: 'classthread-browser-archive';
  version: 1;
  capturedAt: string;
  sourceOrigin: string;
  records: Record<typeof legacyKeys[number], string | null>;
}

export function captureBrowserState(storage: StorageReader, origin: string, now = new Date()): BrowserArchive {
  return {
    format: 'classthread-browser-archive', version: 1,
    capturedAt: now.toISOString(), sourceOrigin: origin,
    records: Object.fromEntries(legacyKeys.map(key => [key, storage.getItem(key)])) as BrowserArchive['records'],
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

export async function downloadBrowserState(archive: BrowserArchive) {
  const checksums = Object.fromEntries(await Promise.all(legacyKeys.map(async key => {
    const raw = archive.records[key];
    if (raw === null) return [key, null];
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    return [key, Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')];
  })));
  const blob = new Blob([JSON.stringify({ ...archive, checksums }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `classthread-browser-backup-${archive.capturedAt.slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
