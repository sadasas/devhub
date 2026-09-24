import type { Attachment } from './types';

/**
 * Util preview ala Linear — single-source penentu jenis pratinjau.
 * Selaras allowlist backend (attachment.ts): image/*, text/*, video/*,
 * application/pdf, application/json, zip (zip = tak previewable).
 */

export type PreviewKind = 'image' | 'video' | 'pdf' | 'text';

export function previewKind(mime: string | null | undefined): PreviewKind | null {
  const m = (mime ?? '').trim().toLowerCase();
  if (!m) return null;
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/') || m === 'video/mp4' || m === 'video/webm' || m === 'video/quicktime') return 'video';
  if (m === 'application/pdf') return 'pdf';
  if (m.startsWith('text/') || m === 'application/json') return 'text';
  return null;
}

export function isPreviewable(mime: string | null | undefined): boolean {
  return previewKind(mime) !== null;
}

export function isPreviewableAttachment(att: Attachment): boolean {
  if (att.provider === 'link') return false;
  return isPreviewable(att.mime);
}

/** Domain untuk kartu link ala Linear (tanpa fetch — tahap fallback). */
export function linkDomain(url: string | null | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function faviconFor(url: string | null | undefined): string | null {
  const d = linkDomain(url);
  if (!d) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64`;
}

/** Parse referensi embed deskripsi: ![alt](attachment:<id>). */
export function parseAttachmentRef(href: string | null | undefined): string | null {
  if (!href) return null;
  const m = href.trim().match(/^attachment:([A-Za-z0-9_-]{1,80})$/);
  return m?.[1] ?? null;
}

export function attachmentRef(id: string, alt?: string): string {
  const label = (alt ?? '').trim().slice(0, 120) || 'attachment';
  return `![${label}](attachment:${id})`;
}
