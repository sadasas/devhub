import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { FileText, Bug, WarningCircle } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { newId, nowIso } from '../../lib/utils';
import type { IssueSeverity } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { MarkdownField } from '../../components/MarkdownField';

interface NewIssueModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewIssueModal({ open, onClose }: NewIssueModalProps) {
  const { dispatch } = useProject();
  const { t } = useTranslation(['tracker', 'project']);
  usePresenceStatus(t('issues.newModal.presenceCreating'), open);
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<IssueSeverity>('medium');
  const [description, setDescription] = useState('');
  const [reproduction, setReproduction] = useState('');

  useEffect(() => {
    if (!open) {
      setTitle('');
      setSeverity('medium');
      setDescription('');
      setReproduction('');
    }
  }, [open]);

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
        severity,
        status: 'open',
        description: description.trim(),
        reproduction: reproduction.trim(),
        linkedTaskId: null,
      },
    });
    setTitle('');
    setSeverity('medium');
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
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('issues.newModal.cancel')}
          </Button>
          <Button type="submit" form="new-issue-form" disabled={!title.trim()}>
            {t('issues.newModal.submit')}
          </Button>
        </>
      }
    >
      <form id="new-issue-form" className="form-stack" onSubmit={onSubmit} noValidate>
        <Input
          label={t('issues.newModal.titleLabel')}
          required
          autoFocus
          placeholder={t('issues.newModal.titlePlaceholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={500}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
            <span
              style={{
                width: 110,
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
              }}
            >
              <WarningCircle size={12} aria-hidden="true" /> {t('issues.newModal.severityLabel')}
            </span>
            <select
              id="new-issue-severity"
              className="select"
              style={{ width: 160 }}
              value={severity}
              onChange={(e) => setSeverity(e.target.value as IssueSeverity)}
            >
              <option value="critical">{t('issues.severity.critical')}</option>
              <option value="high">{t('issues.severity.high')}</option>
              <option value="medium">{t('issues.severity.medium')}</option>
              <option value="low">{t('issues.severity.low')}</option>
            </select>
          </div>

          <MarkdownField
            label={t('issues.modal.descriptionLabel')}
            icon={FileText}
            value={description}
            onChange={setDescription}
            placeholder={t('issues.newModal.descriptionPlaceholder')}
            maxLength={10000}
            rows={4}
          />

          <MarkdownField
            label={t('issues.newModal.reproductionStepsLabel')}
            icon={Bug}
            value={reproduction}
            onChange={setReproduction}
            placeholder={t('issues.newModal.reproductionPlaceholder')}
            maxLength={10000}
            rows={4}
          />
        </div>
      </form>
    </Modal>
  );
}
