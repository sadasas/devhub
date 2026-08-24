import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { newId, nowIso } from '../../lib/utils';
import type { TechEntryCategory, TechStatus } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';

interface NewTechModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewTechModal({ open, onClose }: NewTechModalProps) {
  const { t } = useTranslation('project');
  const { dispatch } = useProject();
  usePresenceStatus('Creating tech entry', open);
  const [name, setName] = useState('');
  const [version, setVersion] = useState('');
  const [category, setCategory] = useState<TechEntryCategory>('frontend');
  const [status, setStatus] = useState<TechStatus>('current');
  const [notes, setNotes] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const ts = nowIso();
    dispatch({
      type: 'tech/add',
      entry: {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        name: name.trim(),
        version: version.trim(),
        category,
        status,
        notes: notes.trim(),
      },
    });
    setName('');
    setVersion('');
    setCategory('frontend');
    setStatus('current');
    setNotes('');
    onClose();
  }

  return (
    <Modal
      open={open}
      title={t('stack.newTechModal.title')}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('stack.newTechModal.cancel')}
          </Button>
          <Button type="submit" form="new-tech-form" disabled={!name.trim()}>
            {t('stack.newTechModal.submit')}
          </Button>
        </>
      }
    >
      <form id="new-tech-form" className="form-stack" onSubmit={onSubmit} noValidate>
        <Input
          label={t('stack.newTechModal.nameLabel')}
          required
          autoFocus
          placeholder={t('stack.newTechModal.namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label={t('stack.newTechModal.versionLabel')}
          placeholder={t('stack.newTechModal.versionPlaceholder')}
          value={version}
          onChange={(e) => setVersion(e.target.value)}
        />
        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="new-tech-category">
              {t('stack.newTechModal.categoryLabel')}
            </label>
            <select
              id="new-tech-category"
              className="select"
              value={category}
              onChange={(e) => setCategory(e.target.value as TechEntryCategory)}
            >
              <option value="frontend">{t('stack.optionCategory.frontend')}</option>
              <option value="backend">{t('stack.optionCategory.backend')}</option>
              <option value="database">{t('stack.optionCategory.database')}</option>
              <option value="tooling">{t('stack.optionCategory.tooling')}</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="new-tech-status">
              {t('stack.newTechModal.statusLabel')}
            </label>
            <select
              id="new-tech-status"
              className="select"
              value={status}
              onChange={(e) => setStatus(e.target.value as TechStatus)}
            >
              <option value="current">{t('stack.optionStatus.current')}</option>
              <option value="updateAvailable">{t('stack.optionStatus.updateAvailable')}</option>
              <option value="majorUpgrade">{t('stack.optionStatus.majorUpgrade')}</option>
            </select>
          </div>
        </div>
        <Textarea
          label={t('stack.newTechModal.notesLabel')}
          rows={2}
          placeholder={t('stack.newTechModal.notesPlaceholder')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </form>
    </Modal>
  );
}
