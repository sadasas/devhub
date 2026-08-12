import { useEffect, useState } from 'react';
import { ApiError } from '../../lib/api';
import { EMPTY_PRD, PRD_SECTIONS } from '../../lib/prd';
import type { Project, ProjectPrd } from '../../lib/types';
import { useProjects } from '../../state/projects-context';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';

interface EditPrdModalProps {
  open: boolean;
  onClose: () => void;
  project: Project;
}

export function EditPrdModal({ open, onClose, project }: EditPrdModalProps) {
  const { update } = useProjects();
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
      setSaveError(err instanceof ApiError ? err.message : 'Failed to save changes.');
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Edit PRD"
      onClose={onClose}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="edit-prd-form" loading={saving} disabled={!dirty}>
            Save PRD
          </Button>
        </>
      }
    >
      <form id="edit-prd-form" className="form-stack" onSubmit={(e) => void onSave(e)}>
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A short description of the project."
          rows={2}
        />
        {PRD_SECTIONS.map((s) => (
          <Textarea
            key={s.key}
            label={s.label}
            helper={s.helper}
            value={draft[s.key]}
            onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))}
          />
        ))}
        {saveError && <InlineError>{saveError}</InlineError>}
      </form>
    </Modal>
  );
}