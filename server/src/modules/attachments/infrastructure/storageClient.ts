import { config } from '../../../config.js';
import { logger } from '../../../shared/logger.js';

/**
 * Klien penyimpanan objek DevHub via HTTP (kompatibel API Supabase Storage).
 * Satu-satunya file yang tahu soal protokol vendor — pesan error yang keluar
 * ke API selalu generik (nama vendor tidak pernah bocor ke klien).
 */
export function isStorageEnabled(): boolean {
  return config.DEVHUB_STORAGE_URL.trim() !== '' && config.DEVHUB_STORAGE_SERVICE_KEY.trim() !== '';
}

export function storageBucket(): string {
  return config.DEVHUB_STORAGE_BUCKET.trim() || 'devhub-attachments';
}

export function maxUploadBytes(): number {
  return config.DEVHUB_STORAGE_UPLOAD_MAX_MB * 1024 * 1024;
}

function baseUrl(): string {
  return config.DEVHUB_STORAGE_URL.trim().replace(/\/$/, '');
}

function headers(extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: config.DEVHUB_STORAGE_SERVICE_KEY,
    Authorization: `Bearer ${config.DEVHUB_STORAGE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function storageError(status: number): Error {
  // Pesan generik untuk klien; detail hanya di log server (tanpa secret).
  logger.warn('Object storage request failed', { status });
  return Object.assign(new Error('File storage is temporarily unavailable'), {
    status: 503,
    code: 'STORAGE_UNAVAILABLE',
  });
}

function encodeKey(storageKey: string): string {
  return storageKey
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

/** Minta URL upload bertanda (client PUT bytes langsung ke storage). */
export async function mintUploadUrl(
  storageKey: string,
): Promise<{ uploadUrl: string; expiresIn: number }> {
  const res = await fetch(
    `${baseUrl()}/storage/v1/object/upload/sign/${storageBucket()}/${encodeKey(storageKey)}`,
    { method: 'POST', headers: headers() },
  );
  if (!res.ok) throw storageError(res.status);
  const body = (await res.json()) as { url?: string; signedUrl?: string; signedURL?: string };
  const url = body.url ?? body.signedUrl ?? body.signedURL;
  if (!url) throw storageError(502);
  return { uploadUrl: url, expiresIn: 300 };
}

/** Minta URL unduh bertanda berumur pendek. */
export async function mintDownloadUrl(
  storageKey: string,
  expiresIn = 60,
): Promise<{ downloadUrl: string; expiresIn: number }> {
  const res = await fetch(
    `${baseUrl()}/storage/v1/object/sign/${storageBucket()}/${encodeKey(storageKey)}`,
    {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ expiresIn }),
    },
  );
  if (!res.ok) throw storageError(res.status);
  const body = (await res.json()) as { signedURL?: string; signedUrl?: string; url?: string };
  const signed = body.signedURL ?? body.signedUrl ?? body.url;
  if (!signed) throw storageError(502);
  const downloadUrl = signed.startsWith('http') ? signed : `${baseUrl()}/storage/v1${signed}`;
  return { downloadUrl, expiresIn };
}

/** Hapus satu objek (best-effort — kegagalan hanya di-log). */
export async function removeObject(storageKey: string): Promise<void> {
  try {
    const res = await fetch(
      `${baseUrl()}/storage/v1/object/${storageBucket()}/${encodeKey(storageKey)}`,
      { method: 'DELETE', headers: headers() },
    );
    if (!res.ok) logger.warn('Object storage delete failed', { status: res.status });
  } catch (err) {
    logger.warn('Object storage delete threw', {
      error: err instanceof Error ? err.message : err,
    });
  }
}
