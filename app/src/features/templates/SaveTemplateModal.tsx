import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';
import { InlineError } from '../../components/InlineError';

interface SaveTemplateModalProps {
  open: boolean;
  projectId: string;
  projectName: string;
  onClose: () => void;
}

export function SaveTemplateModal({ open, projectId, projectName, onClose }: SaveTemplateModalProps) {
  const { t } = useTranslation('extras');
  const [name, setName] = useState(projectName);
  const [description, setDescription] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(projectName);
      setDescription('');
      setSaved(false);
      setError(null);
    }
  }, [open, projectName]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.saveTemplate(projectId, name.trim(), description.trim());
      setSaved(true);
      setSubmitting(false);
    } catch (err) {
      setError(getErrorMessage(err, t('templates.errors.save')));
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title={t('templates.saveTitle')}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {saved ? t('templates.close') : t('templates.cancel')}
          </Button>
          {!saved && (
            <Button type="submit" form="save-template-form" loading={submitting} disabled={!name.trim()}>
              {t('templates.save')}
            </Button>
          )}
        </>
      }
    >
      {saved ? (
        <p className="field-helper">
          {t('templates.savedHelper')}
        </p>
      ) : (
        <form id="save-template-form" className="form-stack" onSubmit={onSubmit} noValidate>
          <Input
            label={t('templates.nameLabel')}
            required
            autoFocus
            placeholder={t('templates.namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Textarea
            label={t('api.workbench.description')}
            rows={3}
            placeholder={t('templates.descPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {error && <InlineError>{error}</InlineError>}
        </form>
      )}
    </Modal>
  );
}