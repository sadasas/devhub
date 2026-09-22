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

function storageOrigin(): string {
  let base = config.DEVHUB_STORAGE_URL.trim().replace(/\/+$/, '');
  // Terima endpoint S3 (/storage/v1/s3) maupun REST (/storage/v1) —
  // kupas suffix agar tidak double-prefix /storage/v1/object/...
  base = base.replace(/\/storage\/v1\/s3$/, '').replace(/\/storage\/v1$/, '');
  return base;
}

function toAbsoluteStorageUrl(maybeRelative: string): string {
  if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative;
  const origin = storageOrigin();
  if (maybeRelative.startsWith('/storage/v1/')) return `${origin}${maybeRelative}`;
  if (maybeRelative.startsWith('/')) return `${origin}/storage/v1${maybeRelative}`;
  return `${origin}/storage/v1/${maybeRelative}`;
}

function headers(extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: config.DEVHUB_STORAGE_SERVICE_KEY,
    Authorization: `Bearer ${config.DEVHUB_STORAGE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

export function tusEndpoint(): string {
  const override = config.DEVHUB_STORAGE_TUS_ENDPOINT.trim().replace(/\/+$/, '');
  if (override) return override;
  const origin = storageOrigin();
  // Origin bentuk https://<ref>.supabase.co → pakai hostname storage langsung
  // sesuai dokumen resmi (direct storage hostname, performa optimal).
  const m = origin.match(/^https:\/\/([^.]+)\.supabase\.co$/i);
  if (m) return `https://${m[1]}.storage.supabase.co/storage/v1/upload/resumable`;
  if (/\.storage\.supabase\.co$/i.test(origin)) return `${origin}/storage/v1/upload/resumable`;
  return `${origin}/storage/v1/upload/resumable`;
}

async function createSignedUpload(
  storageKey: string,
  expiresIn: number,
): Promise<{ signed: string; token: string }> {
  const res = await fetch(
    `${storageOrigin()}/storage/v1/object/upload/sign/${storageBucket()}/${encodeKey(storageKey)}`,
    { method: 'POST', headers: headers(), body: JSON.stringify({ expiresIn }) },
  );
  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      detail = '';
    }
    throw storageError(res.status, detail);
  }
  const body = (await res.json()) as {
    url?: string;
    signedUrl?: string;
    signedURL?: string;
    token?: string;
  };
  const signed = body.url ?? body.signedUrl ?? body.signedURL;
  if (!signed) throw storageError(502, 'empty sign response');
  return { signed, token: body.token ?? '' };
}

function storageError(status: number, detail?: string): Error {
  // Pesan generik untuk klien; detail hanya di log server (tanpa secret).
  if (detail) {
    logger.warn('Object storage request failed', { status, detail: detail.slice(0, 500) });
  } else {
    logger.warn('Object storage request failed', { status });
  }
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

/** Minta URL upload bertanda (fallback PUT satu request). */
export async function mintUploadUrl(
  storageKey: string,
): Promise<{ uploadUrl: string; expiresIn: number }> {
  const expiresIn = 300;
  const { signed, token } = await createSignedUpload(storageKey, expiresIn);
  let url = signed;
  // Supabase bisa balas token terpisah — gabungkan bila belum ada di URL.
  if (token && !/[?&]token=/.test(url)) {
    url += (url.includes('?') ? '&' : '?') + `token=${encodeURIComponent(token)}`;
  }
  return { uploadUrl: toAbsoluteStorageUrl(url), expiresIn };
}

/** Minta token TUS presigned untuk resumable upload (dokumen resmi Supabase).
 *  Browser upload tanpa service key — token dikirim via header `x-signature`. */
export async function mintTusPresigned(
  storageKey: string,
): Promise<{
  tusEndpoint: string;
  uploadToken: string;
  bucket: string;
  objectName: string;
  expiresIn: number;
}> {
  const expiresIn = 7200; // token presigned berlaku 2 jam per dokumen resmi
  const { token } = await createSignedUpload(storageKey, expiresIn);
  if (!token) throw storageError(502, 'missing presigned token');
  return {
    tusEndpoint: tusEndpoint(),
    uploadToken: token,
    bucket: storageBucket(),
    objectName: storageKey,
    expiresIn,
  };
}

/** Minta URL unduh bertanda berumur pendek. */
export async function mintDownloadUrl(
  storageKey: string,
  expiresIn = 60,
): Promise<{ downloadUrl: string; expiresIn: number }> {
  const res = await fetch(
    `${storageOrigin()}/storage/v1/object/sign/${storageBucket()}/${encodeKey(storageKey)}`,
    {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ expiresIn }),
    },
  );
  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      detail = '';
    }
    throw storageError(res.status, detail);
  }
  const body = (await res.json()) as {
    signedURL?: string;
    signedUrl?: string;
    url?: string;
    token?: string;
  };
  let signed = body.signedURL ?? body.signedUrl ?? body.url;
  if (!signed) throw storageError(502, 'empty sign response');
  if (body.token && !/[?&]token=/.test(signed)) {
    signed += (signed.includes('?') ? '&' : '?') + `token=${encodeURIComponent(body.token)}`;
  }
  return { downloadUrl: toAbsoluteStorageUrl(signed), expiresIn };
}

/** Hapus satu objek (best-effort — kegagalan hanya di-log). */
export async function removeObject(storageKey: string): Promise<void> {
  try {
    const res = await fetch(
      `${storageOrigin()}/storage/v1/object/${storageBucket()}/${encodeKey(storageKey)}`,
      { method: 'DELETE', headers: headers() },
    );
    if (!res.ok) logger.warn('Object storage delete failed', { status: res.status });
  } catch (err) {
    logger.warn('Object storage delete threw', {
      error: err instanceof Error ? err.message : err,
    });
  }
}
