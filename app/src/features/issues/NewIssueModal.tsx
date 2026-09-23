import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Bug, FileText, WarningCircle } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { newId, nowIso } from '../../lib/utils';
import type { Attachment, IssueSeverity } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { api } from '../../lib/api';
import { AttachmentSection } from '../../components/AttachmentSection';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { PlanLimitModal } from '../../components/PlanLimitModal';
import { SearchableSelect } from '../../components/SearchableSelect';
import { MarkdownField } from '../../components/MarkdownField';
import { LIMITS } from '../../lib/limits';
import { TaskSeverityIcon } from '../../lib/task-icons';

const SEVERITY_OPTIONS: IssueSeverity[] = ['critical', 'high', 'medium', 'low'];

// autoFocus hanya desktop (hover) — di touch, keyboard virtual melonjak (pola Modal).
const AUTO_FOCUS_INPUT = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

interface NewIssueModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewIssueModal({ open, onClose }: NewIssueModalProps) {
  const { dispatch, projectId, teamId, canEdit } = useProject();
  const { t } = useTranslation(['tracker', 'project']);
  usePresenceStatus(t('issues.newModal.presenceCreating'), open);
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<IssueSeverity | ''>('');
  const [description, setDescription] = useState('');
  const [reproduction, setReproduction] = useState('');
  /** Lampiran staged: ID draft dibuat saat modal dibuka agar storageKey stabil. */
  const [draftId, setDraftId] = useState(() => newId());
  const [draft, setDraft] = useState<Attachment[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [storageLimitOpen, setStorageLimitOpen] = useState(false);
  const savedRef = useRef(false);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setDraftId(newId());
      setDraft([]);
      setUploadBusy(false);
      setStorageLimitOpen(false);
      savedRef.current = false;
    } else {
      setTitle('');
      setSeverity('');
      setDescription('');
      setReproduction('');
    }
  }, [open]);

  // Judul autogrow tanpa batas — yang scroll .composer-scroll, bukan textarea.
  useLayoutEffect(() => {
    const ta = titleRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    }
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const ts = nowIso();
    dispatch({
      type: 'issue/add',
      issue: {
        id: draftId,
        createdAt: ts,
        updatedAt: ts,
        title: title.trim(),
        severity: severity === '' ? 'medium' : severity,
        status: 'open',
        description: description.trim(),
        reproduction: reproduction.trim(),
        linkedTaskId: null,
        ...(draft.length > 0 ? { attachments: draft } : {}),
      },
    });
    savedRef.current = true;
    setTitle('');
    setSeverity('');
    setDescription('');
    setReproduction('');
    setDraft([]);
    onClose();
  }

  /** Tutup tanpa save → bersihkan file staged yang yatim (best-effort). */
  function handleClose() {
    if (!savedRef.current && projectId) {
      for (const a of draft) {
        if (a.provider === 'devhub' && a.storageKey) {
          void api.attachmentAbandon(projectId, a.storageKey).catch(() => {});
        }
      }
    }
    savedRef.current = false;
    onClose();
  }

  return (
    <>
    <Modal
      open={open}
      title={t('issues.newModal.title')}
      onClose={handleClose}
      width="lg"
      className="modal-composer"
      footer={
        <>
          <Button variant="ghost" size="md" onClick={handleClose}>
            {t('issues.newModal.cancel')}
          </Button>
          <Button type="submit" size="md" form="new-issue-form" leftIcon={<Bug size={14} aria-hidden="true" />} disabled={!title.trim() || uploadBusy}>
            {t('issues.newModal.submit')}
          </Button>
        </>
      }
    >
      <form id="new-issue-form" className="composer-form" onSubmit={onSubmit} noValidate>
        <div
          className="composer-scroll"
          ref={scrollRef}
          onScroll={(e) => {
            barRef.current?.classList.toggle('is-stuck', (e.target as HTMLDivElement).scrollTop > 4);
          }}
        >
          <textarea
            ref={titleRef}
            className="composer-title"
            rows={1}
            required
            autoFocus={AUTO_FOCUS_INPUT}
            placeholder={t('issues.newModal.titlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={LIMITS.ISSUE_TITLE}
            aria-label={t('issues.newModal.titleLabel')}
          />
          <MarkdownField
            label={t('issues.modal.descriptionLabel')}
            icon={FileText}
            value={description}
            onChange={setDescription}
            placeholder={t('issues.newModal.descriptionPlaceholder')}
            maxLength={LIMITS.ISSUE_DESCRIPTION}
            rows={4}
            variant="bare"
            previewToggle
            embedAttachments={projectId ? { projectId, attachments: draft } : undefined}
          />
          <MarkdownField
            label={t('issues.newModal.reproductionStepsLabel')}
            icon={Bug}
            value={reproduction}
            onChange={setReproduction}
            placeholder={t('issues.newModal.reproductionPlaceholder')}
            maxLength={LIMITS.ISSUE_REPRODUCTION}
            rows={4}
            variant="bare"
            previewToggle
            embedAttachments={projectId ? { projectId, attachments: draft } : undefined}
          />
          {canEdit && projectId && (
            <AttachmentSection
              mode="staged"
              projectId={projectId}
              entity="issues"
              entityId={draftId}
              attachments={draft}
              canEdit={canEdit}
              onChanged={setDraft}
              onQuotaExceeded={() => setStorageLimitOpen(true)}
              onBusyChange={setUploadBusy}
            />
          )}
        </div>
        <div className="composer-propbar" ref={barRef}>
          <span
            className="prop"
            data-prop="severity"
            data-label={t('issues.newModal.severityLabel')}
          >
            <span className="prop-ic" aria-hidden="true"><WarningCircle size={14} /></span>
            <span className="sr-only">{t('issues.newModal.severityLabel')}</span>
            <SearchableSelect
              id="new-issue-severity"
              label=""
              ariaLabel={t('issues.newModal.severityLabel')}
              searchable={false}
              value={severity || null}
              allowEmpty={false}
              triggerEmptyLabel={t('issues.newModal.severityLabel')}
              options={SEVERITY_OPTIONS.map((s) => ({ value: s, label: t(`issues.severity.${s}`), icon: <TaskSeverityIcon severity={s} size={13} /> }))}
              onChange={(v) => { if (v) setSeverity(v as IssueSeverity); }}
            />
          </span>
        </div>
      </form>
    </Modal>
    {teamId && (
      <PlanLimitModal
        open={storageLimitOpen}
        resource="storage"
        teamId={teamId}
        onClose={() => setStorageLimitOpen(false)}
      />
    )}
    </>
  );
}
