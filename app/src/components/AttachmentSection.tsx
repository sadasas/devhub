import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DownloadSimple, Eye, LinkSimple, Plus, Trash } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../lib/api';
import { getErrorMessage, isPlanLimitError } from '../lib/errors';
import { formatBytes } from '../lib/format';
import { newId, nowIso } from '../lib/utils';
import type { Attachment } from '../lib/types';
import { isPreviewableAttachment, linkDomain, previewKind } from '../lib/attachmentPreview';
import { putFile, putFileTus, isUploadAuthError } from '../lib/attachmentUpload';
import { Button } from './Button';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { InlineError } from './InlineError';
import { AttachmentPreviewModal, dropPreviewCache, useAttachmentUrl } from './AttachmentPreviewModal';
import { LinkCard } from './LinkCard';

export const ATTACHMENT_CLIENT_MAX_MB = 10;

interface AttachmentSectionProps {
  projectId: string;
  entity: 'tasks' | 'issues';
  entityId: string;
  attachments: Attachment[];
  canEdit: boolean;
  canDownload?: boolean;
  onChanged: (next: Attachment[]) => void;
  onQuotaExceeded?: () => void;
  /**
   * attached (default): entity sudah ada di server — setiap aksi langsung
   * persist (confirm/link/DELETE). staged: new modal — file hanya naik ke
   * storage (tanpa confirm); pointer ikut payload create; hapus = abandon.
   */
  mode?: 'attached' | 'staged';
  onBusyChange?: (busy: boolean) => void;
}

/**
 * Thumbnail 40px ala Linear — hanya untuk image/video previewable.
 * Tanpa ikon dekoratif (lolos tes "no decorative svg outside buttons"):
 * sebelum blob siap, render placeholder div kosong.
 */
function AttachmentThumb({
  projectId,
  att,
  localUrl,
  label,
  onPreview,
}: {
  projectId: string;
  att: Attachment;
  localUrl?: string | null;
  label: string;
  onPreview: () => void;
}) {
  const kind = previewKind(att.mime);
  const { url } = useAttachmentUrl(projectId, att, localUrl);
  if (kind !== 'image' && kind !== 'video') return null;
  const box = {
    width: 40,
    height: 40,
    borderRadius: 6,
    flexShrink: 0,
    overflow: 'hidden',
    background: 'var(--bg-inset)',
    border: '1px solid var(--border-hairline)',
    padding: 0,
    cursor: 'pointer',
  } as const;
  if (!url) {
    return <span style={box} aria-hidden="true" />;
  }
  if (kind === 'video') {
    return (
      <button type="button" onClick={onPreview} aria-label={label} style={{ ...box, position: 'relative' }}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video src={url} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <span aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, textShadow: '0 1px 4px rgba(0,0,0,.6)' }}>▶</span>
      </button>
    );
  }
  return (
    <button type="button" onClick={onPreview} aria-label={label} style={box}>
      <img src={url} alt="" aria-hidden="true" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </button>
  );
}

export function AttachmentSection({
  projectId,
  entity,
  entityId,
  attachments,
  canEdit,
  canDownload = true,
  onChanged,
  onQuotaExceeded,
  mode = 'attached',
  onBusyChange,
}: AttachmentSectionProps) {
  const { t } = useTranslation(['tracker']);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [progressName, setProgressName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Attachment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<Attachment | null>(null);
  /** Object URL lokal per attachment — thumb instan + preview staged tanpa sign-download. */
  const [localUrls, setLocalUrls] = useState<Record<string, string>>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const linkFormRef = useRef<HTMLDivElement>(null);
  const localUrlsRef = useRef(localUrls);
  localUrlsRef.current = localUrls;
  const staged = mode === 'staged';

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  // Revoke semua object URL lokal saat unmount (hindari bocor memori).
  useEffect(
    () => () => {
      for (const u of Object.values(localUrlsRef.current)) URL.revokeObjectURL(u);
    },
    [],
  );

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      const el = e.target as Node | null;
      if (!menuRef.current?.contains(el) && !addBtnRef.current?.contains(el)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // Posisi popup diukur dari tombol Add (portal ke body — anti terpotong scroll).
  useLayoutEffect(() => {
    if (!menuOpen) return;
    const anchor = addBtnRef.current;
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const w = 220;
    const h = 96;
    const below = r.bottom + 6;
    const top = window.innerHeight - below >= h + 8 ? below : Math.max(8, r.top - h - 6);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    setMenuPos((p) => (p && p.top === top && p.left === left ? p : { top, left }));
  }, [menuOpen]);

  // Form link menutup saat klik di luar.
  useEffect(() => {
    if (!linkOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!linkFormRef.current?.contains(e.target as Node)) setLinkOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [linkOpen]);

  const atCap = attachments.length >= 20;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || busy) return;
    const file = files[0]!;
    setError(null);
    if (file.size > ATTACHMENT_CLIENT_MAX_MB * 1048576) {
      setError(t('board.attachments.tooLarge', { defaultValue: 'Files are limited to 10 MB — add bigger files as a link instead.' }));
      return;
    }
    setBusy(true);
    setProgress(0);
    setProgressName(file.name);
    try {
      const sign = await api.attachmentSignUpload({
        projectId,
        entity,
        entityId,
        name: file.name.slice(0, 200),
        mime: file.type || 'application/octet-stream',
        size: file.size,
      });
      // Jalur utama: TUS resumable. sign.uploadUrl dipertahankan sebagai
      // fallback bila token TUS tak tersedia (mis. Supabase tak balas token)
      // maupun saat TUS ditolak auth (401/403 — token tak cocok header).
      if (sign.tus) {
        try {
          await putFileTus(file, sign.tus, setProgress);
        } catch (err) {
          if (!isUploadAuthError(err)) throw err;
          setProgress(0);
          await putFile(sign.uploadUrl, file, setProgress);
        }
      } else {
        await putFile(sign.uploadUrl, file, setProgress);
      }
      const attachment: Attachment = {
        id: newId(),
        provider: 'devhub',
        name: file.name.slice(0, 200),
        mime: file.type || 'application/octet-stream',
        size: file.size,
        storageKey: sign.storageKey,
        url: null,
        linkedAt: nowIso(),
      };
      // Object URL lokal: thumb instan + preview staged tanpa sign-download
      // (URL storage bertanda hanya hidup ~60 detik — lihat storageClient).
      if (isPreviewableAttachment(attachment)) {
        const objectUrl = URL.createObjectURL(file);
        setLocalUrls((prev) => ({ ...prev, [attachment.id]: objectUrl }));
      }
      if (!staged) {
        await api.attachmentConfirm({ projectId, entity, entityId, attachment });
      }
      onChanged([...attachments, attachment]);
    } catch (err) {
      if (isPlanLimitError(err)) {
        onQuotaExceeded?.();
      } else if (err instanceof ApiError && (err.code === 'STORAGE_DISABLED' || err.status === 503)) {
        setError(t('board.attachments.storageOff', { defaultValue: 'Uploads are unavailable right now — add a link instead.' }));
      } else if (err instanceof ApiError && err.code === 'UNSUPPORTED_FILE') {
        setError(t('board.attachments.unsupported', { defaultValue: 'This file type must be added as a link instead.' }));
      } else {
        setError(getErrorMessage(err, t('board.attachments.uploadFailed', { defaultValue: 'Upload failed — please try again.' })));
      }
    } finally {
      setBusy(false);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleAddLink() {
    const url = linkUrl.trim();
    // Judul ala Linear --title: opsional, default = domain (bukan wajib isi).
    const name = linkName.trim().slice(0, 200) || linkDomain(url) || url.slice(0, 200);
    if (!url || busy) return;
    if (!/^https?:\/\//i.test(url)) {
      setError(t('board.attachments.linkFailed', { defaultValue: 'Could not add link — check the URL.' }));
      return;
    }
    setError(null);
    if (staged) {
      const attachment: Attachment = {
        id: newId(),
        provider: 'link',
        name,
        mime: '',
        size: 0,
        storageKey: null,
        url,
        linkedAt: nowIso(),
      };
      onChanged([...attachments, attachment]);
      setLinkName('');
      setLinkUrl('');
      setLinkOpen(false);
      return;
    }
    setBusy(true);
    try {
      const res = await api.attachmentAddLink({ projectId, entity, entityId, name, url });
      onChanged([...attachments, res.attachment]);
      setLinkName('');
      setLinkUrl('');
      setLinkOpen(false);
    } catch (err) {
      setError(getErrorMessage(err, t('board.attachments.linkFailed', { defaultValue: 'Could not add link — check the URL.' })));
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload(att: Attachment) {
    if (att.provider === 'link') {
      if (att.url) window.open(att.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!canDownload) return;
    // Prefer blob/object URL lokal bila ada (tak kena expiry 60 detik).
    const local = localUrls[att.id];
    if (local) {
      window.open(local, '_blank', 'noopener,noreferrer');
      return;
    }
    setDownloadingId(att.id);
    try {
      const res = await api.attachmentSignDownload(projectId, att.id);
      window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(getErrorMessage(err, t('board.attachments.downloadFailed', { defaultValue: 'Download failed — please try again.' })));
    } finally {
      setDownloadingId(null);
    }
  }

  async function confirmDelete() {
    const att = deleteTarget;
    if (!att || deleting) return;
    setDeleting(true);
    try {
      if (staged) {
        if (att.provider === 'devhub' && att.storageKey) {
          await api.attachmentAbandon(projectId, att.storageKey);
        }
      } else {
        await api.attachmentRemove(projectId, entity, entityId, att.id);
      }
      const local = localUrls[att.id];
      if (local) {
        URL.revokeObjectURL(local);
        setLocalUrls((prev) => {
          const next = { ...prev };
          delete next[att.id];
          return next;
        });
      }
      dropPreviewCache(att.id);
      if (previewTarget?.id === att.id) setPreviewTarget(null);
      onChanged(attachments.filter((a) => a.id !== att.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(getErrorMessage(err, t('board.attachments.deleteFailed', { defaultValue: 'Could not remove attachment.' })));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
    <section aria-label={t('board.attachments.title', { defaultValue: 'Attachments' })}>
      <h4 className="detail-subtitle">
        {t('board.attachments.title', { defaultValue: 'Attachments' })}
        {attachments.length > 0 && (
          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {attachments.length}/20</span>
        )}
      </h4>
      <div style={{ marginTop: 2 }}>
        {attachments.map((att, i) => {
          const previewable = isPreviewableAttachment(att);
          const previewLabel = t('board.attachments.preview', { defaultValue: 'Preview {{name}}', name: att.name });
          const openPreview = () => setPreviewTarget(att);
          return (
          <div
            key={att.id}
            className="mini-row"
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
              borderTop: i === 0 ? 'none' : '1px solid var(--border-hairline)',
            }}
          >
            {att.provider === 'link' ? (
              <span style={{ flex: 1, minWidth: 0 }}>
                <LinkCard attachment={att} />
                <span style={{ display: 'block', fontSize: 'var(--text-caption)', color: 'var(--text-muted)' }}>
                  {t('board.attachments.linkBadge', { defaultValue: 'Link' })}
                </span>
              </span>
            ) : (
              <>
              {previewable && (
                <AttachmentThumb projectId={projectId} att={att} localUrl={localUrls[att.id]} label={previewLabel} onPreview={openPreview} />
              )}
              <span style={{ flex: 1, minWidth: 0 }}>
                {previewable ? (
                  <button
                    type="button"
                    onClick={openPreview}
                    title={att.name}
                    style={{ display: 'block', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontSize: 'var(--text-ui)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {att.name}
                  </button>
                ) : (
                  <span
                    style={{ display: 'block', fontSize: 'var(--text-ui)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={att.name}
                  >
                    {att.name}
                  </span>
                )}
                <span style={{ display: 'block', fontSize: 'var(--text-caption)', color: 'var(--text-muted)' }}>
                  {formatBytes(att.size)}
                </span>
              </span>
              </>
            )}
            <span className="att-actions">
            {previewable && (
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon"
                onClick={openPreview}
                aria-label={previewLabel}
              >
                <Eye size={14} aria-hidden="true" />
              </button>
            )}
            {(att.provider === 'link' || (!staged && canDownload)) && (
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon"
                onClick={() => void handleDownload(att)}
                disabled={downloadingId === att.id}
                aria-label={t('board.attachments.download', { defaultValue: 'Open {{name}}', name: att.name })}
              >
                <DownloadSimple size={14} aria-hidden="true" />
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                className="btn btn-danger btn-sm btn-icon"
                onClick={() => setDeleteTarget(att)}
                aria-label={t('board.attachments.remove', { defaultValue: 'Remove {{name}}', name: att.name })}
              >
                <Trash size={14} aria-hidden="true" />
              </button>
            )}
            </span>
          </div>
          );
        })}
      </div>
      {progress !== null && (
        <div role="status" style={{ marginTop: 6 }}>
          <div className="usage-meter">
            <span className="usage-meter-label">{progressName}</span>
            <div
              className="usage-meter-bar"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t('board.attachments.uploading', { defaultValue: 'Uploading {{name}}', name: progressName })}
            >
              <div className="usage-meter-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="usage-meter-value">{progress}%</span>
          </div>
        </div>
      )}
      {error && <InlineError>{error}</InlineError>}
      {canEdit && !atCap && (
        <div style={{ marginTop: 6 }}>
          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            accept="image/*,video/*,.pdf,.json,.txt,.zip"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <Button
            ref={addBtnRef}
            variant="ghost"
            size="md"
            style={{ width: '100%', justifyContent: 'flex-start' }}
            onClick={() => { setMenuPos(null); setMenuOpen((v) => !v); }}
            disabled={busy}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            + {t('board.attachments.addAttachment', { defaultValue: 'Add attachment' })}
          </Button>
          {menuOpen && createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label={t('board.attachments.addAttachment', { defaultValue: 'Add attachment' })}
              className="prop-menu prop-pop"
              style={menuPos ? { top: menuPos.top, left: menuPos.left, minWidth: 200 } : { visibility: 'hidden' }}
            >
              <button
                type="button"
                role="menuitem"
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'flex-start', width: '100%' }}
                onClick={() => { setMenuOpen(false); fileRef.current?.click(); }}
                disabled={busy}
              >
                <Plus size={14} aria-hidden="true" /> {t('board.attachments.addFile', { defaultValue: 'Upload file' })}
              </button>
              <button
                type="button"
                role="menuitem"
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'flex-start', width: '100%' }}
                onClick={() => { setMenuOpen(false); setLinkOpen(true); }}
                disabled={busy}
              >
                <LinkSimple size={14} aria-hidden="true" /> {t('board.attachments.addLink', { defaultValue: 'Add link' })}
              </button>
            </div>,
            document.body,
          )}
        </div>
      )}
      {atCap && (
        <p className="field-helper">
          {t('board.attachments.atCap', { defaultValue: 'Attachment limit reached for this item (20).' })}
        </p>
      )}
      {linkOpen && canEdit && (
        <div ref={linkFormRef} style={{ display: 'flex', gap: 6, marginTop: 6 }} onKeyDown={(e) => { if (e.key === 'Escape') setLinkOpen(false); }}>
          <input
            className="input"
            value={linkName}
            maxLength={200}
            onChange={(e) => setLinkName(e.target.value)}
            placeholder={t('board.attachments.linkName', { defaultValue: 'Link name…' })}
            aria-label={t('board.attachments.linkName', { defaultValue: 'Link name…' })}
            style={{ flex: 1, minWidth: 0 }}
          />
          <input
            className="input"
            value={linkUrl}
            inputMode="url"
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleAddLink(); } }}
            placeholder="https://…"
            aria-label={t('board.attachments.linkUrl', { defaultValue: 'Link URL' })}
            style={{ flex: 1, minWidth: 0 }}
          />
          <Button
            variant="primary"
            size="md"
            className="btn-icon"
            onClick={() => void handleAddLink()}
            disabled={!linkUrl.trim() || busy}
            aria-label={t('board.attachments.linkAdd', { defaultValue: 'Add' })}
          >
            <Plus size={16} aria-hidden="true" />
          </Button>
        </div>
      )}
      {staged && (
        <p className="field-helper">
          {t('board.attachments.stagedHint', { defaultValue: 'Files upload now, attached when you save.' })}
        </p>
      )}
    </section>
    <AttachmentPreviewModal
      projectId={projectId}
      attachment={previewTarget}
      localUrl={previewTarget ? (localUrls[previewTarget.id] ?? null) : null}
      onClose={() => setPreviewTarget(null)}
    />
    <ConfirmDeleteDialog
      open={deleteTarget !== null}
      title={t('board.attachments.deleteTitle', { defaultValue: 'Remove attachment?' })}
      description={
        deleteTarget
          ? t('board.attachments.deleteDesc', { defaultValue: 'Remove "{{name}}"? This cannot be undone.', name: deleteTarget.name })
          : ''
      }
      onClose={() => { if (!deleting) setDeleteTarget(null); }}
      onConfirm={() => void confirmDelete()}
      busy={deleting}
    />
    </>
  );
}
