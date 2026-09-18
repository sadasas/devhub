import { useEffect, useId, useState } from 'react';
import { FileText, FloppyDisk } from '@phosphor-icons/react';
import { getErrorMessage } from '../../lib/errors';
import { PRD_SECTIONS } from '../../lib/prd';
import { useTranslation } from 'react-i18next';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import type { Project, ProjectPrd } from '../../lib/types';
import { useProjects } from '../../state/projects-context';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { Modal } from '../../components/Modal';
import { MarkdownField } from '../../components/MarkdownField';

/** Satu variabel per buka: deskripsi hero atau satu seksi PRD. */
export type PrdEditKey = 'description' | keyof ProjectPrd;

/** Batas server (zod max 5_000 per seksi) — UI disamakan agar tidak gagal save diam-diam. */
const SECTION_MAX = 5_000;

interface EditPrdSectionModalProps {
  open: boolean;
  section: PrdEditKey;
  onClose: () => void;
  project: Project;
}

export function EditPrdSectionModal({ open, section, onClose, project }: EditPrdSectionModalProps) {
  const { t } = useTranslation(['project', 'tracker']);
  const { update } = useProjects();
  const fieldId = useId();
  const [value, setValue] = useState('');
  const [initial, setInitial] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const meta =
    section === 'description'
      ? { label: t('project:prd.titleLabel'), placeholder: t('project:prd.titlePlaceholder'), icon: FileText }
      : (() => {
          const s = PRD_SECTIONS.find((x) => x.key === section)!;
          return {
            label: t(`project:prd.section.${s.key}.label`),
            placeholder: t(`project:prd.section.${s.key}.helper`),
            icon: s.icon,
          };
        })();

  usePresenceStatus(`Editing ${meta.label}`, open);

  useEffect(() => {
    if (!open) return;
    const current = section === 'description' ? project.description : (project.prd[section] ?? '');
    setValue(current);
    setInitial(current);
    setSaveError(null);
    setSaving(false);
    setExpanded(false);
  }, [open, section, project]);

  const dirty = value !== initial;

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setSaveError(null);
    setSaving(true);
    try {
      if (section === 'description') {
        await update(project.id, { description: value });
      } else {
        // Kirim objek penuh (satu nilai berubah) — perilaku sama seperti modal lama.
        await update(project.id, { prd: { ...project.prd, [section]: value } });
      }
      onClose();
    } catch (err) {
      setSaveError(getErrorMessage(err, t('project:errors.prdSaveFailed')));
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title={meta.label}
      onClose={onClose}
      width="lg"
      className={expanded ? 'modal-composer modal-composer--fullscreen' : 'modal-composer'}
      expandable
      expanded={expanded}
      onToggleExpand={() => setExpanded((v) => !v)}
      expandLabel={t('tracker:board.newTaskModal.expandView')}
      collapseLabel={t('tracker:board.newTaskModal.contractView')}
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose} disabled={saving}>
            {t('project:prd.cancel')}
          </Button>
          <Button type="submit" size="md" form="edit-prd-section-form" leftIcon={<FloppyDisk size={14} aria-hidden="true" />} disabled={!dirty} loading={saving}>
            {t('project:prd.save')}
          </Button>
        </>
      }
    >
      <form id="edit-prd-section-form" className="composer-form" onSubmit={(e) => void onSave(e)}>
        <div className="composer-scroll">
          <MarkdownField
            key={section}
            id={fieldId}
            label={meta.label}
            icon={meta.icon}
            value={value}
            onChange={setValue}
            placeholder={meta.placeholder}
            maxLength={SECTION_MAX}
            variant="bare"
            startEditing
            hideHead
          />
        </div>
        {saveError && <InlineError>{saveError}</InlineError>}
      </form>
    </Modal>
  );
}
