import { z } from 'zod';
import { attachmentSchema, LIMITS } from '../../projects/domain/state.js';

/** Entity yang boleh punya lampiran pada MVP. */
export const ATTACHABLE_ENTITIES = ['tasks', 'issues'] as const;
export type AttachableEntity = (typeof ATTACHABLE_ENTITIES)[number];

/** Batas ukuran per file (byte) — default 10 MB, bisa dioverride env. */
export const DEFAULT_MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Cap lampiran per entity — single-source dari LIMITS state. */
export const MAX_ATTACHMENTS_PER_ENTITY = LIMITS.ATTACHMENTS_PER_ENTITY;

/**
 * Allowlist tipe file upload langsung. executable/script ditolak
 * (lampiran bug: screenshot, log, spec, arsip, rekaman layar).
 * Tipe lain → pakai tautan.
 */
const ALLOWED_MIME_PREFIXES = ['image/', 'text/', 'video/'];
const ALLOWED_MIME_EXACT = new Set([
  'application/pdf',
  'application/json',
  'application/zip',
  'application/x-zip-compressed',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

/**
 * Tebakan mime dari ekstensi nama file — hanya untuk allowlist di atas.
 * Browser/klien kadang mengirim `mime` kosong (mis. berkas tanpa asosiasi
 * OS); tanpa fallback, file 100 KB yang sah ikut ditolak 415.
 * Ekstensi di luar allowlist tetap ditolak (executable/script tak lolos).
 */
const EXTENSION_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  avif: 'image/avif',
  txt: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  csv: 'text/csv',
  log: 'text/plain',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4v: 'video/mp4',
  pdf: 'application/pdf',
  json: 'application/json',
  zip: 'application/zip',
};

export function isAllowedMime(mime: string, filename?: string): boolean {
  const m = mime.trim().toLowerCase();
  if (m && m.length <= 100) {
    if (ALLOWED_MIME_EXACT.has(m)) return true;
    if (ALLOWED_MIME_PREFIXES.some((p) => m.startsWith(p))) return true;
    return false;
  }
  const base = (filename ?? '').split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  if (dot < 0) return false;
  const ext = base.slice(dot + 1).toLowerCase();
  if (!/^[a-z0-9]{1,10}$/.test(ext)) return false;
  const guessed = EXTENSION_MIME[ext];
  if (!guessed) return false;
  if (ALLOWED_MIME_EXACT.has(guessed)) return true;
  return ALLOWED_MIME_PREFIXES.some((p) => guessed.startsWith(p));
}

export const signUploadSchema = z.object({
  projectId: z.string().uuid(),
  entity: z.enum(ATTACHABLE_ENTITIES),
  entityId: z.string().uuid(),
  name: z.string().trim().min(1).max(LIMITS.ATTACHMENT_NAME),
  mime: z.string().trim().max(100),
  size: z.number().int().min(1),
});

export const confirmAttachmentSchema = z.object({
  projectId: z.string().uuid(),
  entity: z.enum(ATTACHABLE_ENTITIES),
  entityId: z.string().uuid(),
  attachment: attachmentSchema,
});

export const linkAttachmentSchema = z.object({
  projectId: z.string().uuid(),
  entity: z.enum(ATTACHABLE_ENTITIES),
  entityId: z.string().uuid(),
  name: z.string().trim().min(1).max(LIMITS.ATTACHMENT_NAME),
  url: z.string().trim().min(1).max(2000),
});

export type Attachment = z.infer<typeof attachmentSchema>;

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
