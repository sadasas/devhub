import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { useProject } from '../../state/project-context';
import { newId, nowIso } from '../../lib/utils';
import {
  LABEL_COLOR_LABEL,
  LABEL_COLOR_ORDER,
  labelChipStyle,
  labelUsageCount,
} from '../../lib/labels';
import type { LabelColor, LabelDef } from '../../lib/types';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { InlineError } from '../../components/InlineError';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';

function Swatches({
  value,
  onChange,
  labelPrefix,
  disabled,
}: {
  value: LabelColor;
  onChange: (c: LabelColor) => void;
  labelPrefix: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={labelPrefix} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {LABEL_COLOR_ORDER.map((c) => {
        const selected = value === c;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${labelPrefix}: ${LABEL_COLOR_LABEL[c]}`}
            title={LABEL_COLOR_LABEL[c]}
            disabled={disabled}
            onClick={() => onChange(c)}
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              flexShrink: 0,
              cursor: disabled ? 'default' : 'pointer',
              background: `var(--label-${c})`,
              border: 'none',
              outline: selected ? '2px solid var(--accent)' : '2px solid transparent',
              outlineOffset: 2,
              opacity: disabled && !selected ? 0.5 : 1,
            }}
          />
        );
      })}
    </div>
  );
}

export function LabelsSection() {
  const { t } = useTranslation('project');
  const { state, dispatch, canEdit } = useProject();
  const defs = useMemo(() => [...(state?.labelDefs ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [state?.labelDefs]);
  const taskLabels = useMemo(() => (state?.tasks ?? []).map((task) => task.labels), [state?.tasks]);

  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; id: string } | null>(null);
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState<LabelColor>('blue');
  const [formDesc, setFormDesc] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const isDuplicate = (n: string, exceptId?: string) =>
    (state?.labelDefs ?? []).some((d) => d.id !== exceptId && d.name.trim().toLowerCase() === n.trim().toLowerCase());

  const openCreate = () => {
    setFormName('');
    setFormColor('blue');
    setFormDesc('');
    setFormError(null);
    setModal({ mode: 'create' });
  };

  const openEdit = (def: LabelDef) => {
    setFormName(def.name);
    setFormColor(def.color);
    setFormDesc(def.description ?? '');
    setFormError(null);
    setModal({ mode: 'edit', id: def.id });
  };

  const save = () => {
    const trimmed = formName.trim().slice(0, 50);
    if (!trimmed) return;
    const exceptId = modal?.mode === 'edit' ? modal.id : undefined;
    if (isDuplicate(trimmed, exceptId)) {
      setFormError(t('settings.labelsDuplicate', { defaultValue: 'A label with this name already exists.' }));
      return;
    }
    setFormError(null);
    if (modal?.mode === 'edit') {
      dispatch({
        type: 'labelDef/update',
        id: modal.id,
        patch: { name: trimmed, color: formColor, description: formDesc.trim().slice(0, 200) },
      });
    } else {
      const ts = nowIso();
      dispatch({
        type: 'labelDef/add',
        labelDef: {
          id: newId(),
          createdAt: ts,
          updatedAt: ts,
          name: trimmed,
          color: formColor,
          description: formDesc.trim().slice(0, 200),
        },
      });
    }
    setModal(null);
  };

  const remove = () => {
    if (!deleteId) return;
    dispatch({ type: 'labelDef/remove', id: deleteId });
    setDeleteId(null);
  };

  const deleteTarget = (state?.labelDefs ?? []).find((d) => d.id === deleteId);
  const isEditing = modal?.mode === 'edit';

  return (
    <div className="profile-panel">
      <div className="narrow-center">
      <section className="dashboard__settings-section" aria-labelledby="project-settings-labels-title">
        <div className="dashboard__settings-head">
          <h2 id="project-settings-labels-title" tabIndex={-1} className="dashboard__settings-section-title" style={{ flex: 1, minWidth: 0, margin: 0 }}>
            {t('settings.labelsTitle', { defaultValue: 'Labels' })}
          </h2>
          {canEdit && (
            <Button variant="primary" size="sm" leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={openCreate}>
              {t('settings.labelsAdd', { defaultValue: 'Add' })}
            </Button>
          )}
        </div>
        <p className="dashboard__settings-section-desc">
          {t('settings.labelsDesc', { defaultValue: 'Named colors for task labels in this project. Renaming updates every task; deleting keeps the text with an automatic color.' })}
        </p>

        <div style={{ marginTop: 2 }}>
          {defs.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 14, fontStyle: 'italic' }}>
              {t('settings.labelsEmpty', { defaultValue: 'No labels yet.' })}
            </p>
          )}
          {defs.map((def, i) => {
            const style = labelChipStyle(def.color);
            const count = labelUsageCount(def.name, taskLabels);
            return (
              <div
                key={def.id}
                className="mini-row"
                style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '7px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border-hairline)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    aria-hidden="true"
                    title={LABEL_COLOR_LABEL[def.color]}
                    style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0, background: style.color }}
                  />
                  <span style={{ ...style, fontSize: 12, padding: '2px 8px', borderRadius: 6, overflowWrap: 'anywhere' }} title={def.description || def.name}>
                    {def.name}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 'auto' }} className="tabular">
                    {t('settings.labelsUsed', { defaultValue: '{{count}} tasks', count })}
                  </span>
                  {canEdit && (
                    <>
                      <button type="button" className="mini-del" onClick={() => openEdit(def)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6, display: 'inline-flex', flexShrink: 0 }} aria-label={`${t('settings.labelsRename', { defaultValue: 'Rename' })} ${def.name}`}>
                        <PencilSimple size={14} aria-hidden="true" />
                      </button>
                      <button type="button" className="mini-del" onClick={() => setDeleteId(def.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--status-danger)', padding: 6, display: 'inline-flex', flexShrink: 0 }} aria-label={`${t('settings.labelsDelete', { defaultValue: 'Delete' })} ${def.name}`}>
                        <Trash size={14} aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
                {def.description && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 20, overflowWrap: 'anywhere' }}>
                    {def.description}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {!canEdit && (
          <p className="field-helper" style={{ marginTop: 12 }}>
            {t('settings.readonly', { defaultValue: 'Only owners and admins can edit project settings.' })}
          </p>
        )}
      </section>
      </div>

      <Modal
        open={modal !== null}
        title={isEditing
          ? t('settings.labelsEditTitle', { defaultValue: 'Edit label' })
          : t('settings.labelsCreateTitle', { defaultValue: 'New label' })}
        onClose={() => setModal(null)}
        footer={(
          <>
            <Button variant="ghost" size="md" onClick={() => setModal(null)}>
              {t('settings.labelsCancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button variant="primary" size="md" leftIcon={isEditing ? <Check size={14} weight="bold" aria-hidden="true" /> : <Plus size={14} weight="bold" aria-hidden="true" />} onClick={save} disabled={!formName.trim()}>
              {isEditing
                ? t('settings.labelsSave', { defaultValue: 'Save' })
                : t('settings.labelsAdd', { defaultValue: 'Add' })}
            </Button>
          </>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Swatches
            value={formColor}
            onChange={setFormColor}
            labelPrefix={t('settings.labelsColor', { defaultValue: 'Label color' })}
          />
          <Input
            autoFocus
            label={t('settings.labelsNameLabel', { defaultValue: 'Label name' })}
            value={formName}
            maxLength={50}
            required
            onChange={(e) => { setFormName(e.target.value); setFormError(null); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); save(); }
            }}
            placeholder={t('settings.labelsNamePlaceholder', { defaultValue: 'Label name…' })}
            error={formError ?? undefined}
          />
          <Input
            label={t('settings.labelsDescLabel', { defaultValue: 'Description (tooltip)' })}
            helper={t('settings.labelsDescHelper', { defaultValue: 'Tampil saat hover label di setiap task.' })}
            value={formDesc}
            maxLength={200}
            onChange={(e) => setFormDesc(e.target.value)}
            placeholder={t('settings.labelsDescPlaceholder', { defaultValue: 'Description (tooltip)…' })}
          />
          {formError && !formName.trim() && <InlineError>{formError}</InlineError>}
        </div>
      </Modal>

      <ConfirmDeleteDialog
        open={deleteId !== null}
        title={t('settings.labelsDeleteTitle', { defaultValue: 'Delete label?' })}
        description={t('settings.labelsDeleteBody', {
          defaultValue: 'Tasks keep the "{{name}}" text with an automatic color. This cannot be undone.',
          name: deleteTarget?.name ?? '',
        })}
        onClose={() => setDeleteId(null)}
        onConfirm={remove}
      />
    </div>
  );
}
