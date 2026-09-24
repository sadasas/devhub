import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DownloadSimple } from '@phosphor-icons/react';
import { api } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { formatBytes } from '../lib/format';
import type { Attachment } from '../lib/types';
import { previewKind } from '../lib/attachmentPreview';
import { Button } from './Button';
import { InlineError } from './InlineError';
import { Modal } from './Modal';

/**
 * Blob URL cache per sesi — mengatasi expiry 60 detik signed URL storage.
 * Satu fetch dipakai thumb + modal + download (pola Linear: URL fresh per sesi).
 */
const blobCache = new Map<string, string>();
const flightCache = new Map<string, Promise<string>>();

export function dropPreviewCache(attachmentId: string): void {
  const url = blobCache.get(attachmentId);
  if (url) {
    URL.revokeObjectURL(url);
    blobCache.delete(attachmentId);
  }
  flightCache.delete(attachmentId);
}

async function resolveBlobUrl(projectId: string, att: Attachment): Promise<string> {
  const hit = blobCache.get(att.id);
  if (hit) return hit;
  const flight = flightCache.get(att.id);
  if (flight) return flight;
  const p = (async () => {
    const res = await api.attachmentSignDownload(projectId, att.id);
    const fetched = await fetch(res.downloadUrl);
    if (!fetched.ok) throw new Error(`Download failed (${fetched.status})`);
    const blob = await fetched.blob();
    const objectUrl = URL.createObjectURL(blob);
    blobCache.set(att.id, objectUrl);
    return objectUrl;
  })();
  flightCache.set(att.id, p);
  try {
    return await p;
  } catch (err) {
    flightCache.delete(att.id);
    throw err;
  }
}

export function useAttachmentUrl(
  projectId: string,
  att: Attachment | null,
  localUrl?: string | null,
): { url: string | null; loading: boolean; error: string | null } {
  const { t } = useTranslation(['tracker']);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!att || att.provider !== 'devhub') {
      setUrl(null);
      setLoading(false);
      setError(null);
      return;
    }
    // Staged / baru upload: pakai object URL lokal (tanpa sign-download).
    if (localUrl) {
      setUrl(localUrl);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    resolveBlobUrl(projectId, att)
      .then((u) => {
        if (!cancelled) {
          setUrl(u);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(getErrorMessage(err, t('board.attachments.downloadFailed', { defaultValue: 'Download failed — please try again.' })));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, att?.id, localUrl, t]); // eslint-disable-line react-hooks/exhaustive-deps

  return { url, loading, error };
}

interface AttachmentPreviewModalProps {
  projectId: string;
  attachment: Attachment | null;
  localUrl?: string | null;
  onClose: () => void;
}

const TEXT_PREVIEW_CAP = 1024 * 1024;

export function AttachmentPreviewModal({ projectId, attachment, localUrl, onClose }: AttachmentPreviewModalProps) {
  const { t } = useTranslation(['tracker']);
  const { url, loading, error } = useAttachmentUrl(projectId, attachment, localUrl);
  const [zoom, setZoom] = useState(1);
  const [text, setText] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);

  useEffect(() => {
    setZoom(1);
    setText(null);
    setTextError(null);
  }, [attachment?.id]);

  useEffect(() => {
    const att = attachment;
    if (!att || !url || previewKind(att.mime) !== 'text') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        if (blob.size > TEXT_PREVIEW_CAP) {
          if (!cancelled) {
            setText(null);
            setTextError(t('board.attachments.previewTooLarge', { defaultValue: 'Too large to preview — download to view.' }));
          }
          return;
        }
        const raw = await blob.text();
        if (!cancelled) setText(raw.slice(0, 20000));
      } catch {
        if (!cancelled) setTextError(t('board.attachments.previewFailed', { defaultValue: 'Preview failed — download to view instead.' }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, attachment, t]);

  const kind = attachment ? previewKind(attachment.mime) : null;

  const handleDownload = async () => {
    if (!attachment) return;
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    try {
      const res = await api.attachmentSignDownload(projectId, attachment.id);
      window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch {
      // error sudah tampil via hook bila relevan
    }
  };

  return (
    <Modal
      open={attachment !== null}
      title={attachment?.name ?? ''}
      onClose={onClose}
      width="lg"
      className="modal-fullscreen"
      footer={
        attachment ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-muted)' }}>
              {attachment.mime || kind} · {formatBytes(attachment.size)}
            </span>
            <span className="spacer" style={{ flex: 1 }} />
            {kind === 'image' && (
              <span style={{ display: 'inline-flex', gap: 4 }} role="group" aria-label="Zoom">
                <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} aria-label="Zoom out">−</Button>
                <span style={{ fontSize: 'var(--text-caption)', color: 'var(--text-muted)', minWidth: 44, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
                <Button variant="ghost" size="sm" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} aria-label="Zoom in">+</Button>
                <Button variant="ghost" size="sm" onClick={() => setZoom(1)} aria-label="Reset zoom">1:1</Button>
              </span>
            )}
            <Button variant="primary" size="sm" leftIcon={<DownloadSimple size={14} aria-hidden="true" />} onClick={() => void handleDownload()}>
              {t('board.attachments.downloadCta', { defaultValue: 'Download' })}
            </Button>
          </div>
        ) : undefined
      }
    >
      {!attachment || !kind ? (
        <p className="field-helper">
          {t('board.attachments.previewUnsupported', { defaultValue: 'No in-app preview for this file type.' })}
        </p>
      ) : loading ? (
        <p className="field-helper" role="status">
          {t('board.attachments.previewLoading', { defaultValue: 'Loading preview…' })}
        </p>
      ) : error || !url ? (
        error ? <InlineError>{error}</InlineError> : (
          <p className="field-helper" role="status">
            {t('board.attachments.previewLoading', { defaultValue: 'Loading preview…' })}
          </p>
        )
      ) : kind === 'image' ? (
        <div className="md-preview" style={{ overflow: 'auto', textAlign: 'center' }}>
          <img
            src={url}
            alt={attachment.name}
            loading="lazy"
            style={{ maxWidth: '100%', maxHeight: '70vh', transform: `scale(${zoom})`, transformOrigin: 'top center' }}
          />
        </div>
      ) : kind === 'video' ? (
        <div className="md-preview">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={url} controls preload="metadata" style={{ width: '100%', maxHeight: '70vh', background: 'black' }} />
        </div>
      ) : kind === 'pdf' ? (
        <iframe
          src={url}
          title={attachment.name}
          sandbox="allow-same-origin"
          style={{ width: '100%', height: '70vh', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-sm, 6px)' }}
        />
      ) : textError ? (
        <InlineError>{textError}</InlineError>
      ) : text === null ? (
        <p className="field-helper" role="status">
          {t('board.attachments.previewLoading', { defaultValue: 'Loading preview…' })}
        </p>
      ) : (
        <pre className="md-preview" style={{ overflow: 'auto', maxHeight: '70vh', whiteSpace: 'pre-wrap' }}>
          <code>{text}</code>
        </pre>
      )}
    </Modal>
  );
}
