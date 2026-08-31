import { useEffect, useId, useState } from 'react';
import { FileText } from '@phosphor-icons/react';
import { getErrorMessage } from '../../lib/errors';
import { EMPTY_PRD, PRD_SECTIONS } from '../../lib/prd';
import { useTranslation } from 'react-i18next';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import type { Project, ProjectPrd } from '../../lib/types';
import { useProjects } from '../../state/projects-context';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { Modal } from '../../components/Modal';
import { MarkdownField } from '../../components/MarkdownField';

interface EditPrdModalProps {
  open: boolean;
  onClose: () => void;
  project: Project;
}

export function EditPrdModal({ open, onClose, project }: EditPrdModalProps) {
  const { t } = useTranslation('project');
  const { update } = useProjects();
  usePresenceStatus('Editing project brief', open);
  const descriptionId = useId();
  const [description, setDescription] = useState('');
  const [draft, setDraft] = useState<ProjectPrd>(project.prd);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDescription(project.description);
    setDraft({ ...EMPTY_PRD, ...project.prd });
    setSaveError(null);
    setSaving(false);
  }, [open, project]);

  const dirty =
    description !== project.description || JSON.stringify(draft) !== JSON.stringify(project.prd);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setSaveError(null);
    setSaving(true);
    try {
      await update(project.id, { description, prd: draft });
      onClose();
    } catch (err) {
      setSaveError(getErrorMessage(err, t('errors.prdSaveFailed')));
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title={t('prd.editTitle')}
      onClose={onClose}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t('prd.cancel')}
          </Button>
          <Button type="submit" form="edit-prd-form" loading={saving} disabled={!dirty}>
            {t('prd.save')}
          </Button>
        </>
      }
    >
      <form id="edit-prd-form" className="form-stack" onSubmit={(e) => void onSave(e)}>
        <MarkdownField
          id={descriptionId}
          label={t('prd.titleLabel')}
          icon={FileText}
          value={description}
          onChange={setDescription}
          placeholder={t('prd.titlePlaceholder')}
          maxLength={10000}
          rows={4}
        />
        {PRD_SECTIONS.map((s) => (
          <MarkdownField
            key={s.key}
            id={`prd-${s.key}`}
            label={t(`prd.section.${s.key}.label`)}
            icon={s.icon}
            helper={t(`prd.section.${s.key}.helper`)}
            value={draft[s.key]}
            onChange={(value) => setDraft((d) => ({ ...d, [s.key]: value }))}
            placeholder={t(`prd.section.${s.key}.helper`)}
            maxLength={10000}
            rows={4}
          />
        ))}
        {saveError && <InlineError>{saveError}</InlineError>}
      </form>
    </Modal>
  );
}
