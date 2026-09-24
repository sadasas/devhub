import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, CaretRight, Clock, FileText, Trash, Stack, Circle, PencilSimple } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { TECH_CATEGORY } from '../../lib/labels';
import { formatDate, formatRelative } from '../../lib/utils';
import type { TechEntry, TechEntryCategory, TechStatus } from '../../lib/types';
import type { UpdatePatch } from '../../state/project-context';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { ActivityList } from '../../components/ActivityList';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { DetailEmpty } from '../../components/DetailList';
import { InlineError } from '../../components/InlineError';
import { DetailShell } from '../../components/DetailShell';
import { MarkdownField } from '../../components/MarkdownField';
import { PropRow } from '../../components/PropRow';
import { SearchableSelect } from '../../components/SearchableSelect';
import { MarkdownBlocks } from '../../lib/markdown';
import { FE_LIMITS } from '../../lib/limits';

interface TechModalProps {
  entryId: string | null;
  onClose: () => void;
}

const CATEGORY_OPTIONS: TechEntryCategory[] = ['frontend', 'backend', 'database', 'tooling'];
const STATUS_OPTIONS: TechStatus[] = ['current', 'updateAvailable', 'majorUpgrade'];

// autoFocus hanya desktop (hover) — di touch, keyboard virtual melonjak (pola Modal).
const AUTO_FOCUS_INPUT = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

export function TechModal({ entryId, onClose }: TechModalProps) {
  const { t } = useTranslation(['project', 'tracker']);
  const { state, dispatch, canEdit, projectId, saving, lastSavedAt } = useProject();
  const [hotProp, setHotProp] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const nameRef = useRef<HTMLTextAreaElement | null>(null);
  const [versionPopup, setVersionPopup] = useState<{ anchor: { top: number; bottom: number; left: number } } | null>(null);
  const [versionPos, setVersionPos] = useState<{ top: number; left: number } | null>(null);
  const versionPopRef = useRef<HTMLDivElement | null>(null);
  const [versionDraft, setVersionDraft] = useState<string | null>(null);
  const versionCancelRef = useRef(false);

  useEffect(() => {
    setHotProp(null);
    setConfirmOpen(false);
    setVersionPopup(null);
    setVersionPos(null);
    setVersionDraft(null);
    versionCancelRef.current = false;
  }, [entryId]);

  // Nama autogrow tanpa batas — yang scroll .composer-scroll, bukan textarea.
  useLayoutEffect(() => {
    const ta = nameRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    }
  });

  const entry = entryId ? state?.techEntries.find((x) => x.id === entryId) : undefined;
  usePresenceStatus('Editing tech entry', entry != null);

  const update = (patch: UpdatePatch<TechEntry>) => {
    if (!entry) return;
    dispatch({ type: 'tech/update', id: entry.id, patch });
  };

  // Ukur tinggi asli panel setelah render (sebelum paint) lalu tempelkan ke pill.
  const measureVersionPopup = useCallback(() => {
    if (!versionPopup) return;
    const h = versionPopRef.current?.offsetHeight ?? 0;
    const w = 240;
    const below = versionPopup.anchor.bottom + 6;
    const fitsBelow = window.innerHeight - below >= h + 8;
    const next = {
      top: fitsBelow ? below : Math.max(8, versionPopup.anchor.top - h - 6),
      left: Math.max(8, Math.min(versionPopup.anchor.left, window.innerWidth - w - 8)),
    };
    setVersionPos((prev) => (prev && prev.top === next.top && prev.left === next.left ? prev : next));
  }, [versionPopup]);

  useLayoutEffect(() => {
    if (versionPopup) measureVersionPopup();
  }, [versionPopup, measureVersionPopup]);

  useEffect(() => {
    if (!versionPopup) return;
    window.addEventListener('resize', measureVersionPopup);
    return () => window.removeEventListener('resize', measureVersionPopup);
  }, [versionPopup, measureVersionPopup]);

  useEffect(() => {
    if (!versionPopup) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (versionPopRef.current?.contains(target as Node) || target?.closest?.('[data-pop-anchor="version"]')) return;
      if (!versionCancelRef.current && versionDraft !== null && entry && versionDraft !== entry.version) {
        dispatch({ type: 'tech/update', id: entry.id, patch: { version: versionDraft } });
      }
      setVersionPopup(null);
      setVersionDraft(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        versionCancelRef.current = true;
        setVersionPopup(null);
        setVersionDraft(null);
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [versionPopup, versionDraft, entry, dispatch]);

  // Satu popup dalam satu waktu: buka version menutup baris hot, dan sebaliknya.
  useEffect(() => {
    if (hotProp && versionPopup) {
      setVersionPopup(null);
      setVersionDraft(null);
    }
  }, [hotProp, versionPopup]);

  if (!state || !entry) return null;

  const nameEmpty = entry.name.trim() === '';

  const remove = () => {
    dispatch({ type: 'tech/remove', id: entry.id });
    onClose();
  };

  const categoryTone = TECH_CATEGORY[entry.category].tone;
  const categoryBg =
    categoryTone === 'info'
      ? 'var(--status-info-dim)'
      : categoryTone === 'accent'
        ? 'var(--accent-dim)'
        : categoryTone === 'warn'
          ? 'var(--status-warn-dim)'
          : 'var(--bg-inset)';

  const statusBg =
    entry.status === 'current'
      ? 'var(--status-success-dim)'
      : entry.status === 'majorUpgrade'
        ? 'var(--status-danger-dim)'
        : 'var(--status-warn-dim)';

  function openVersionPopup(anchor: HTMLElement) {
    if (!entry) return;
    versionCancelRef.current = false;
    setHotProp(null);
    setVersionDraft(entry.version);
    const r = anchor.getBoundingClientRect();
    setVersionPopup({ anchor: { top: r.top, bottom: r.bottom, left: r.left } });
    setVersionPos(null);
  }

  const commitVersionDraft = () => {
    if (versionCancelRef.current) return;
    if (versionDraft !== null && versionDraft !== entry.version) {
      update({ version: versionDraft });
    }
    setVersionPopup(null);
    setVersionDraft(null);
  };

  const cancelVersionDraft = () => {
    versionCancelRef.current = true;
    setVersionPopup(null);
    setVersionDraft(null);
  };

  const versionLabel = t('stack.techModal.versionLabel');
  const versionView = entry.version ? (
    <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{entry.version}</span>
  ) : (
    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
  );

  return (
    <DetailShell
      title={t('stack.techModal.viewTitle')}
      onClose={onClose}
      footer={
        canEdit ? (
          <>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash size={14} aria-hidden="true" />}
              onClick={() => setConfirmOpen(true)}
            >
              {t('stack.techModal.delete')}
            </Button>
            {(saving || lastSavedAt) && !nameEmpty && (
              <span className="save-state" role="status">
                {saving ? (
                  t('tracker:board.taskModal.autosaveSaving')
                ) : (
                  <>
                    <CheckCircle size={13} weight="bold" aria-hidden="true" />
                    {t('tracker:board.taskModal.autosaveSaved')}
                  </>
                )}
              </span>
            )}
          </>
        ) : undefined
      }
      sidebarHead={t('tracker:board.taskModal.propertiesLabel')}
      sidebar={
        <>
          <PropRow
            propKey="category"
            label={t('stack.techModal.categoryLabel')}
            icon={<Stack size={12} aria-hidden="true" />}
            hot={hotProp === 'category'}
            setHot={setHotProp}
            canEdit={canEdit}
            view={(
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 6, background: categoryBg, fontSize: 12 }}>
                {t(`stack.category.${entry.category}`)}
              </span>
            )}
            control={(
              <SearchableSelect
                defaultOpen
                searchable={false}
                id="tech-category"
                label=""
                ariaLabel={t('stack.techModal.categoryLabel')}
                value={entry.category}
                allowEmpty={false}
                options={CATEGORY_OPTIONS.map((c) => ({ value: c, label: t(`stack.optionCategory.${c}`) }))}
                onOpenChange={(o) => { if (!o) setHotProp(null); }}
                onChange={(v) => { if (v) { update({ category: v as TechEntryCategory }); setHotProp(null); } }}
              />
            )}
          />
          <PropRow
            propKey="status"
            label={t('stack.techModal.statusLabel')}
            icon={<Circle size={12} aria-hidden="true" />}
            hot={hotProp === 'status'}
            setHot={setHotProp}
            canEdit={canEdit}
            view={(
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 6, background: statusBg, fontSize: 12 }}>
                {t(`stack.statusBadge.${entry.status}`)}
              </span>
            )}
            control={(
              <SearchableSelect
                defaultOpen
                searchable={false}
                id="tech-status"
                label=""
                ariaLabel={t('stack.techModal.statusLabel')}
                value={entry.status}
                allowEmpty={false}
                options={STATUS_OPTIONS.map((s) => ({ value: s, label: t(`stack.optionStatus.${s}`) }))}
                onOpenChange={(o) => { if (!o) setHotProp(null); }}
                onChange={(v) => { if (v) { update({ status: v as TechStatus }); setHotProp(null); } }}
              />
            )}
          />
          <div className="prop" data-prop="version">
            <span className="prop-label">{versionLabel}</span>
            {canEdit ? (
              <button
                type="button"
                className="prop-view"
                data-pop-anchor="version"
                onClick={(e) => {
                  if (versionPopup) {
                    if (!versionCancelRef.current && versionDraft !== null && versionDraft !== entry.version) {
                      update({ version: versionDraft });
                    }
                    setVersionPopup(null);
                    setVersionDraft(null);
                  } else {
                    openVersionPopup(e.currentTarget);
                  }
                }}
              >
                {versionView}
              </button>
            ) : (
              versionView
            )}
            {canEdit ? (
              <span className="prop-chev" aria-hidden="true">
                <CaretRight size={12} weight="bold" />
              </span>
            ) : null}
          </div>
          {versionPopup && createPortal(
            <div
              ref={versionPopRef}
              className="prop-menu prop-pop"
              role="dialog"
              tabIndex={-1}
              aria-label={versionLabel}
              style={versionPos ? { top: versionPos.top, left: versionPos.left } : { visibility: 'hidden' }}
            >
              <div className="prop-pop-label">{versionLabel}</div>
              <input
                autoFocus={AUTO_FOCUS_INPUT}
                className="input"
                value={versionDraft ?? ''}
                onChange={(e) => setVersionDraft(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder={t('stack.techModal.versionPlaceholder')}
                maxLength={FE_LIMITS.TECH_VERSION}
                inputMode="decimal"
                pattern="[0-9.]*"
                aria-label={versionLabel}
                onBlur={() => { if (!versionCancelRef.current) commitVersionDraft(); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitVersionDraft(); }
                  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelVersionDraft(); }
                }}
              />
            </div>,
            document.body,
          )}
        </>
      }
      after={(
        <ConfirmDeleteDialog
          open={confirmOpen}
          title={t('stack.techModal.deleteConfirmTitle')}
          description={t('stack.techModal.deleteConfirmBody')}
          onClose={() => setConfirmOpen(false)}
          onConfirm={remove}
        />
      )}
    >
      {canEdit ? (
        <div className="editable-field editable-field-title" style={{ position: 'relative' }}>
          <textarea
            ref={nameRef}
            className="composer-title"
            rows={1}
            value={entry.name}
            autoFocus={AUTO_FOCUS_INPUT}
            maxLength={FE_LIMITS.TECH_NAME}
            onChange={(e) => update({ name: e.target.value })}
            aria-label={t('stack.techModal.nameLabel')}
            aria-invalid={nameEmpty}
            placeholder={t('stack.newTechModal.namePlaceholder')}
            style={{ paddingRight: 20 }}
          />
          <PencilSimple size={12} aria-hidden="true" className="editable-pencil" />
        </div>
      ) : (
        <h3 className="detail-title">
          {entry.name || <DetailEmpty>{t('stack.techModal.noNotes')}</DetailEmpty>}
        </h3>
      )}
      {nameEmpty && <InlineError>{t('tracker:issues.modal.titleRequired')}</InlineError>}
      <div className="detail-created" style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
        <span style={{ width: 110, color: 'var(--text-secondary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <Clock size={12} aria-hidden="true" /> {t('tracker:issues.modal.createdTimeLabel')}
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>{formatDate(entry.createdAt)} {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      {canEdit ? (
        <div className="editable-field" style={{ position: 'relative' }}>
          <MarkdownField
            label={t('stack.techModal.notesLabel')}
            icon={FileText}
            value={entry.notes}
            onChange={(v) => update({ notes: v })}
            placeholder={t('stack.newTechModal.notesPlaceholder')}
            maxLength={FE_LIMITS.TECH_NOTES}
            rows={4}
            variant="bare"
            previewToggle
          />
        </div>
      ) : (
        <div className="md-bare">
          <div className="md-bare-head">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <FileText size={12} aria-hidden="true" /> {t('stack.techModal.notesLabel')}
            </span>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: entry.notes.trim() ? 'var(--text-secondary)' : 'var(--text-muted)', minHeight: 40, overflowWrap: 'anywhere' }}>
            {entry.notes.trim() ? <MarkdownBlocks text={entry.notes} /> : t('stack.techModal.noNotes')}
          </div>
        </div>
      )}
      <h4 className="detail-subtitle">{t('stack.techModal.activity')}</h4>
      <ActivityList projectId={projectId} entity="techEntries" entityId={entry.id} />
      <p className="field-helper">{t('stack.techModal.updated', { time: formatRelative(entry.updatedAt) })}</p>
    </DetailShell>
  );
}
