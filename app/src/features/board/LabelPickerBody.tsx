import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from '@phosphor-icons/react';
import { LABEL_COLOR_LABEL, LABEL_COLOR_ORDER, hashLabelColor, labelChipStyle } from '../../lib/labels';
import { newId, nowIso, parseLabels } from '../../lib/utils';
import type { LabelColor, LabelDef } from '../../lib/types';
import { useProject } from '../../state/project-context';

/**
 * Isi popup labels 3 zona (dipakai TaskModal + NewTaskModal):
 * 1. Terpilih — chips berwarna + tombol × lepas.
 * 2. Pustaka — semua definisi sebagai toggle (yang terpilih disembunyikan).
 * 3. Create — input khusus label baru + swatch mini + tombol create.
 * Draft tetap CSV string di belakang layar (kompatibel commitLabels/onSubmit).
 */
export function LabelPickerBody({
  draft,
  onChange,
}: {
  draft: string;
  onChange: (nextCsv: string) => void;
}) {
  const { t } = useTranslation('tracker');
  const { state, dispatch } = useProject();
  const defs = [...(state?.labelDefs ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  const selected = parseLabels(draft);
  const selectedSet = new Set(selected.map((n) => n.toLowerCase()));
  const unselected = defs.filter((d) => !selectedSet.has(d.name.toLowerCase()));

  const [createName, setCreateName] = useState('');
  const [createColor, setCreateColor] = useState<LabelColor | null>(null);
  const trimmed = createName.trim().slice(0, 50);
  const exists = !!trimmed && selectedSet.has(trimmed.toLowerCase());
  const dupDef = !!trimmed && defs.some((d) => d.name.toLowerCase() === trimmed.toLowerCase());
  const activeColor: LabelColor = createColor ?? (trimmed ? hashLabelColor(trimmed.toLowerCase()) : 'blue');
  const canCreate = !!trimmed && !exists && !dupDef;

  const remove = (name: string) => {
    onChange(selected.filter((n) => n.toLowerCase() !== name.toLowerCase()).join(', '));
  };

  const toggle = (def: LabelDef) => {
    const has = selected.some((n) => n.toLowerCase() === def.name.toLowerCase());
    onChange(has
      ? selected.filter((n) => n.toLowerCase() !== def.name.toLowerCase()).join(', ')
      : [...selected, def.name].join(', '));
  };

  const create = () => {
    if (!canCreate) return;
    const ts = nowIso();
    dispatch({
      type: 'labelDef/add',
      labelDef: {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        name: trimmed,
        color: activeColor,
        description: '',
      },
    });
    onChange([...selected, trimmed].join(', '));
    setCreateName('');
    setCreateColor(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {selected.length > 0 && (
        <div>
          <div className="prop-pop-label">{t('board.taskModal.labelsSelected', { defaultValue: 'Selected' })}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {selected.map((name) => {
              const def = defs.find((d) => d.name.toLowerCase() === name.toLowerCase());
              const style = def
                ? labelChipStyle(def.color)
                : { background: `var(--label-${hashLabelColor(name.toLowerCase())}-dim)`, color: `var(--label-${hashLabelColor(name.toLowerCase())})` };
              return (
                <span
                  key={name}
                  title={def?.description || name}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 4px 2px 8px',
                    borderRadius: 6,
                    fontSize: 11,
                    background: style.background,
                    color: style.color,
                  }}
                >
                  {name}
                  <button
                    type="button"
                    onClick={() => remove(name)}
                    aria-label={`Remove ${name}`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 'inherit', padding: 0, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, minWidth: 24, minHeight: 24, borderRadius: 6 }}
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {unselected.length > 0 && (
        <div>
          <div className="prop-pop-label">{t('board.taskModal.labelsLibrary', { defaultValue: 'All labels' })}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {unselected.map((def) => {
              const style = labelChipStyle(def.color);
              return (
                <button
                  key={def.id}
                  type="button"
                  onClick={() => toggle(def)}
                  title={def.description || def.name}
                  aria-pressed={false}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '2px 8px',
                    borderRadius: 6,
                    fontSize: 11,
                    background: style.background,
                    color: style.color,
                    border: '1px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
                  {def.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ paddingTop: 8, borderTop: '1px solid var(--border-hairline)' }}>
        <div className="prop-pop-label">{t('board.taskModal.labelsNew', { defaultValue: 'New label' })}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            className="input"
            value={createName}
            maxLength={50}
            onChange={(e) => setCreateName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } }}
            placeholder={t('board.taskModal.labelsNewPlaceholder', { defaultValue: 'New label…' })}
            aria-label={t('board.taskModal.labelsNewPlaceholder', { defaultValue: 'New label…' })}
            style={{ flex: 1, minWidth: 0 }}
          />
          <button
            type="button"
            onClick={create}
            disabled={!canCreate}
            aria-label={trimmed
              ? t('settings.labelsInlineCreate', { defaultValue: 'Create label "{{name}}"', name: trimmed })
              : t('board.taskModal.labelsNew', { defaultValue: 'New label' })}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '0 10px',
              borderRadius: 6,
              fontSize: 12,
              background: canCreate ? 'var(--accent-dim)' : 'var(--bg-inset)',
              color: canCreate ? 'var(--accent)' : 'var(--text-muted)',
              border: 'none',
              cursor: canCreate ? 'pointer' : 'default',
              flexShrink: 0,
            }}
          >
            <Plus size={12} weight="bold" aria-hidden="true" />
            {t('settings.labelsAdd', { defaultValue: 'Add' })}
          </button>
        </div>
        <div role="radiogroup" aria-label={t('settings.labelsColor', { defaultValue: 'Label color' })} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {LABEL_COLOR_ORDER.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={activeColor === c}
              aria-label={`${t('settings.labelsColor', { defaultValue: 'Label color' })}: ${LABEL_COLOR_LABEL[c]}`}
              title={LABEL_COLOR_LABEL[c]}
              onClick={() => setCreateColor(c)}
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                flexShrink: 0,
                cursor: 'pointer',
                background: `var(--label-${c})`,
                border: 'none',
                outline: activeColor === c ? '2px solid var(--accent)' : '2px solid transparent',
                outlineOffset: 2,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
