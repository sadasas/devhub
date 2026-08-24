import { useEffect, useId, useState } from 'react';
import {} from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { EMPTY_PRD, PRD_SECTIONS } from '../../lib/prd';
import { MarkdownBlocks } from '../../lib/markdown';
import { useTranslation } from 'react-i18next';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import type { Project, ProjectPrd } from '../../lib/types';
import { useProjects } from '../../state/projects-context';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { Modal } from '../../components/Modal';

interface EditPrdModalProps {
  open: boolean;
  onClose: () => void;
  project: Project;
}

interface PrdFieldProps {
  id: string;
  label: string;
  helper?: string;
  value: string;
  preview: boolean;
  rows?: number;
  placeholder?: string;
  onToggle: (preview: boolean) => void;
  onChange: (value: string) => void;
}

function PrdField({
  id,
  label,
  helper,
  value,
  preview,
  rows,
  placeholder,
  onToggle,
  onChange,
}: PrdFieldProps) {
  const { t } = useTranslation('project');
  const mdTooltip = t('prd.mdTooltip');
  return (
    <div className="field">
      <div className="field-label-row">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        <div className="md-toggle" role="group" aria-label={t('prd.modeAria', { label })}>
          <button
            type="button"
            title={mdTooltip}
            className={`md-toggle-btn${preview ? '' : ' active'}`}
            aria-pressed={!preview}
            onClick={() => onToggle(false)}
          >
            {t('prd.edit')}
          </button>
          <button
            type="button"
            title={mdTooltip}
            className={`md-toggle-btn${preview ? ' active' : ''}`}
            aria-pressed={preview}
            onClick={() => onToggle(true)}
          >
            {t('prd.preview')}
          </button>
        </div>
      </div>
      {preview ? (
        <div className="md-preview">
          {value.trim() ? (
            <MarkdownBlocks text={value} />
          ) : (
            <span className="md-preview-empty">{t('prd.nothingToPreview')}</span>
          )}
        </div>
      ) : (
        <textarea
          id={id}
          className="textarea"
          value={value}
          rows={rows}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {helper && <p className="field-helper">{helper}</p>}
    </div>
  );
}

export function EditPrdModal({ open, onClose, project }: EditPrdModalProps) {
  const { t } = useTranslation('project');
  const { update } = useProjects();
  usePresenceStatus('Editing project brief', open);
  const descriptionId = useId();
  const [description, setDescription] = useState('');
  const [draft, setDraft] = useState<ProjectPrd>(project.prd);
  const [previews, setPreviews] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDescription(project.description);
    setDraft({ ...EMPTY_PRD, ...project.prd });
    setPreviews({});
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
        <p className="field-helper">{t('prd.helper')}</p>
        <PrdField
          id={descriptionId}
          label={t('prd.titleLabel')}
          value={description}
          preview={previews.description ?? false}
          rows={2}
          placeholder={t('prd.titlePlaceholder')}
          onToggle={(p) => setPreviews((prev) => ({ ...prev, description: p }))}
          onChange={setDescription}
        />
        {PRD_SECTIONS.map((s) => (
          <PrdField
            key={s.key}
            id={`prd-${s.key}`}
            label={t(`prd.section.${s.key}.label`)}
            helper={t(`prd.section.${s.key}.helper`)}
            value={draft[s.key]}
            preview={previews[s.key] ?? false}
            onToggle={(p) => setPreviews((prev) => ({ ...prev, [s.key]: p }))}
            onChange={(value) => setDraft((d) => ({ ...d, [s.key]: value }))}
          />
        ))}
        {saveError && <InlineError>{saveError}</InlineError>}
      </form>
    </Modal>
  );
}