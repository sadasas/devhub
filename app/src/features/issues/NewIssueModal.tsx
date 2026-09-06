import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Bug, FileText, WarningCircle } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { newId, nowIso } from '../../lib/utils';
import type { IssueSeverity } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { SearchableSelect } from '../../components/SearchableSelect';
import { MarkdownField } from '../../components/MarkdownField';
import { LIMITS } from '../../lib/limits';

const SEVERITY_OPTIONS: IssueSeverity[] = ['critical', 'high', 'medium', 'low'];

interface NewIssueModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewIssueModal({ open, onClose }: NewIssueModalProps) {
  const { dispatch } = useProject();
  const { t } = useTranslation(['tracker', 'project']);
  usePresenceStatus(t('issues.newModal.presenceCreating'), open);
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<IssueSeverity | ''>('');
  const [description, setDescription] = useState('');
  const [reproduction, setReproduction] = useState('');
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
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
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        title: title.trim(),
        severity: severity === '' ? 'medium' : severity,
        status: 'open',
        description: description.trim(),
        reproduction: reproduction.trim(),
        linkedTaskId: null,
      },
    });
    setTitle('');
    setSeverity('');
    setDescription('');
    setReproduction('');
    onClose();
  }

  return (
    <Modal
      open={open}
      title={t('issues.newModal.title')}
      onClose={onClose}
      width="lg"
      className="modal-composer"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('issues.newModal.cancel')}
          </Button>
          <Button type="submit" form="new-issue-form" leftIcon={<Bug size={13} aria-hidden="true" />} disabled={!title.trim()}>
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
            autoFocus
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
          />
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
              options={SEVERITY_OPTIONS.map((s) => ({ value: s, label: t(`issues.severity.${s}`) }))}
              onChange={(v) => { if (v) setSeverity(v as IssueSeverity); }}
            />
          </span>
        </div>
      </form>
    </Modal>
  );
}
