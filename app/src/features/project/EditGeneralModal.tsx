import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FloppyDisk } from '@phosphor-icons/react';
import type { Project } from '../../lib/types';
import { FE_LIMITS } from '../../lib/limits';
import { useProjects } from '../../state/projects-context';
import { getErrorMessage } from '../../lib/errors';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';

export function EditGeneralModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const { t } = useTranslation('project');
  const { update } = useProjects();
  const [nameDraft, setNameDraft] = useState(project.name);
  const [descDraft, setDescDraft] = useState(project.description ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const n = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

  const nameTrimmed = nameDraft.trim();
  const descTrimmed = descDraft.trim();
  const dirty = nameTrimmed !== project.name.trim() || descTrimmed !== (project.description ?? '').trim();
  const canSave =
    dirty && nameTrimmed.length > 0 && nameTrimmed.length <= FE_LIMITS.PROJECT_NAME && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaveError(null);
    setSaving(true);
    try {
      await update(project.id, { name: nameTrimmed, description: descTrimmed });
      onClose();
    } catch (err) {
      setSaveError(getErrorMessage(err, t('settings.saveError', { defaultValue: 'Failed to save project settings.' })));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={t('settings.editGeneralTitle', { defaultValue: 'Edit general' })}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose} disabled={saving}>
            {t('common:action.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            type="submit"
            size="md"
            form="edit-general-form"
            leftIcon={<FloppyDisk size={14} aria-hidden="true" />}
            loading={saving}
            disabled={!canSave}
          >
            {t('settings.save', { defaultValue: 'Save changes' })}
          </Button>
        </>
      }
    >
      <form
        id="edit-general-form"
        className="form-stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
      >
        <Input
          id="edit-general-name"
          label={t('settings.nameLabel', { defaultValue: 'Project name' })}
          required
          value={nameDraft}
          maxLength={FE_LIMITS.PROJECT_NAME}
          showCount
          autoFocus={n}
          autoComplete="off"
          onChange={(e) => setNameDraft(e.target.value)}
        />
        <Textarea
          id="edit-general-desc"
          label={t('settings.descLabel', { defaultValue: 'Description' })}
          value={descDraft}
          rows={3}
          maxLength={FE_LIMITS.PROJECT_DESCRIPTION}
          showCount
          onChange={(e) => setDescDraft(e.target.value)}
        />
        {saveError && <InlineError>{saveError}</InlineError>}
      </form>
    </Modal>
  );
}
