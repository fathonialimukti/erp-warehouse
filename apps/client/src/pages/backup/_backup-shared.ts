import { trpcClient } from '../../lib/trpc';

/** One backup file's meta, as returned by `backup.create` / `backup.upload` and as the
 *  `backups[]` entries of `backup.list` (which also carries the server's `appVersion`). */
export type BackupFileInfo = Awaited<
  ReturnType<typeof trpcClient.backup.list.query>
>['backups'][number];

/** Shared react-query cache key for the backup list (page + modals invalidate this). */
export const BACKUPS_QUERY_KEY = ['backups'];

/** Human-readable byte size, e.g. "1.2 MB". */
export const formatBytes = (sizeBytes: number): string => {
  if (sizeBytes < 1024) return `${sizeBytes.toLocaleString()} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = sizeBytes;
  let unitIndex = -1;
  do {
    value /= 1024;
    unitIndex += 1;
  } while (value >= 1024 && unitIndex < units.length - 1);
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${units[unitIndex]}`;
};

/** Sum of all per-table row counts. */
export const sumTableCounts = (tableCounts: Record<string, number>): number =>
  Object.values(tableCounts).reduce((total, count) => total + count, 0);

/** Decode base64 (UTF-8 JSON) into a downloadable Blob and trigger a save. */
export const downloadBase64AsFile = (fileName: string, base64: string): void => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

/** Read a File as raw base64 (no data-url prefix). */
export const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const separatorIndex = result.indexOf(',');
      resolve(separatorIndex >= 0 ? result.slice(separatorIndex + 1) : result);
    };
    reader.readAsDataURL(file);
  });
