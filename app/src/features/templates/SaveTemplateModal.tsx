import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { BookmarkSimple } from '@phosphor-icons/react';
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
  const errorRef = useRef<HTMLDivElement>(null);
  const autoFocusName = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

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
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  }

  return (
    <Modal
      open={open}
      title={t('templates.saveTitle')}
      onClose={onClose}
      width="sm"
      footer={
        saved ? undefined : (
          <>
            <Button variant="ghost" size="md" onClick={onClose}>
              {t('templates.cancel')}
            </Button>
            <Button type="submit" size="md" form="save-template-form" leftIcon={<BookmarkSimple size={14} aria-hidden="true" />} loading={submitting} disabled={!name.trim()}>
              {t('templates.save')}
            </Button>
          </>
        )
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
            autoFocus={autoFocusName}
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
          {error && <div ref={errorRef} tabIndex={-1} className="form-error-focus"><InlineError>{error}</InlineError></div>}
        </form>
      )}
    </Modal>
  );
}