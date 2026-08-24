import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { newId, nowIso } from '../../lib/utils';
import type { IssueSeverity } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';

interface NewIssueModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewIssueModal({ open, onClose }: NewIssueModalProps) {
  const { dispatch } = useProject();
  const { t } = useTranslation('tracker');
  usePresenceStatus(t('issues.newModal.presenceCreating'), open);
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<IssueSeverity>('medium');
  const [description, setDescription] = useState('');
  const [reproduction, setReproduction] = useState('');

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
      width="sm"
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
        />
        <div className="field">
          <label className="field-label" htmlFor="new-issue-severity">
            {t('issues.newModal.severityLabel')}
          </label>
          <select
            id="new-issue-severity"
            className="select"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as IssueSeverity)}
          >
            <option value="critical">{t('issues.severity.critical')}</option>
            <option value="high">{t('issues.severity.high')}</option>
            <option value="medium">{t('issues.severity.medium')}</option>
            <option value="low">{t('issues.severity.low')}</option>
          </select>
        </div>
        <Textarea
          label={t('issues.modal.descriptionLabel')}
          rows={3}
          placeholder={t('issues.newModal.descriptionPlaceholder')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Textarea
          label={t('issues.newModal.reproductionStepsLabel')}
          rows={3}
          placeholder={t('issues.newModal.reproductionPlaceholder')}
          value={reproduction}
          onChange={(e) => setReproduction(e.target.value)}
        />
      </form>
    </Modal>
  );
}
