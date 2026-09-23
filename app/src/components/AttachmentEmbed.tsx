import { useState } from 'react';
import type { Attachment } from '../lib/types';
import { parseAttachmentRef, previewKind } from '../lib/attachmentPreview';
import { AttachmentPreviewModal, useAttachmentUrl } from './AttachmentPreviewModal';

function isSafeHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Embed inline ala Linear untuk sintaks markdown `![alt](...)`.
 * - `attachment:<id>` → resolve ke lampiran task/issue (blob URL sesi,
 *   lolos expiry 60 detik signed URL); gambar/video render inline,
 *   pdf/teks jadi tombol pembuka modal preview.
 * - URL http(s) eksternal → <img> langsung.
 * Tanpa konteks lampiran (mis. changelog milestone) → fallback teks aman.
 */
export function AttachmentEmbed({
  projectId,
  attachments,
  src,
  alt,
}: {
  projectId?: string;
  attachments?: Attachment[];
  src: string;
  alt: string;
}) {
  const [open, setOpen] = useState(false);
  const refId = parseAttachmentRef(src);

  if (!refId) {
    if (!isSafeHttpUrl(src)) return <span>{alt || src}</span>;
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        style={{ maxWidth: '100%', borderRadius: 6 }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }

  const att = attachments?.find((a) => a.id === refId) ?? null;
  if (!att || !projectId || att.provider !== 'devhub') {
    return <span>{alt || 'attachment'}</span>;
  }
  return <AttachmentEmbedResolved projectId={projectId} att={att} alt={alt} open={open} setOpen={setOpen} />;
}

function AttachmentEmbedResolved({
  projectId,
  att,
  alt,
  open,
  setOpen,
}: {
  projectId: string;
  att: Attachment;
  alt: string;
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const { url } = useAttachmentUrl(projectId, att, null);
  const kind = previewKind(att.mime);
  const label = alt || att.name;

  if (kind === 'image' && url) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'zoom-in', maxWidth: '100%' }}
        >
          <img src={url} alt={label} loading="lazy" style={{ maxWidth: '100%', borderRadius: 6 }} />
        </button>
        <AttachmentPreviewModal projectId={projectId} attachment={open ? att : null} onClose={() => setOpen(false)} />
      </>
    );
  }
  if (kind === 'video' && url) {
    return (
      /* eslint-disable-next-line jsx-a11y/media-has-caption */
      <video src={url} controls preload="metadata" style={{ maxWidth: '100%', borderRadius: 6 }} />
    );
  }
  if ((kind === 'pdf' || kind === 'text') && url) {
    return (
      <>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setOpen(true)}
          style={{ justifyContent: 'flex-start', maxWidth: '100%' }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📎 {label}</span>
        </button>
        <AttachmentPreviewModal projectId={projectId} attachment={open ? att : null} onClose={() => setOpen(false)} />
      </>
    );
  }
  // Blob belum siap atau tipe tak previewable → fallback tombol unduh di modal/list.
  return <span>{label}</span>;
}
