import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeHeaderColor } from './erd-header-color';

interface TableColorPickerProps {
  /** Current Table.color (null/undefined = Default). Snapshot-safe: plain value, no global read. */
  value: string | null | undefined;
  /** Commit a new color (hex #rrggbb) or null for Default. Caller dispatches table/update. */
  onChange: (next: string | null) => void;
  /** True in readOnly/viewer/snapshot — inputs disabled (gate canEdit). */
  disabled?: boolean;
  /** Optional id prefix for a11y labelling. */
  id?: string;
  /** Override visible label (default: schema.table.colorLabel). */
  label?: string;
}

/**
 * Header color picker — native `<input type="color">` (round button) + Default reset.
 * Native picker always yields #rrggbb; contrast stays safe via headerTitleColor.
 * Esc resets to Default when editable and returns focus to the group
 * (fokus-kembali, stopPropagation so tiered panel/canvas Esc doesn't fire).
 */
export function TableColorPicker({ value, onChange, disabled = false, id = 'tbl-color', label }: TableColorPickerProps) {
  const { t } = useTranslation('project');
  const groupRef = useRef<HTMLDivElement>(null);
  const norm = normalizeHeaderColor(value);
  const labelId = `${id}-label`;
  const labelText = label ?? t('schema.table.colorLabel');
  // Native color input requires a concrete value — preview the current color,
  // fall back to the canvas accent while on Default (nothing committed until picked).
  const preview = norm ?? '#5db69b';

  const commit = (next: string | null) => {
    if (disabled) return;
    onChange(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    // Esc: stop tiered-Esc (panel/canvas) so picking doesn't close the panel,
    // reset to Default when editable, then focus back to the group.
    e.stopPropagation();
    if (disabled) return;
    e.preventDefault();
    if (norm !== null) onChange(null);
    groupRef.current?.focus();
  };

  return (
    <div className="field table-color-field">
      <span className="field-label" id={labelId}>
        {labelText}
      </span>
      <div
        ref={groupRef}
        role="group"
        aria-labelledby={labelId}
        tabIndex={-1}
        className="table-color-group"
        onKeyDown={handleKeyDown}
      >
        <input
          id={`${id}-input`}
          type="color"
          className="table-color-native"
          aria-labelledby={labelId}
          value={preview}
          disabled={disabled}
          onChange={(e) => commit(e.target.value.toLowerCase())}
        />
        <button
          type="button"
          aria-label={t('schema.table.resetColor')}
          title={t('schema.table.resetColor')}
          aria-pressed={norm === null}
          disabled={disabled}
          className={`table-color-swatch table-color-default${norm === null ? ' table-color-checked' : ''}`}
          onClick={() => commit(null)}
        >
          <span aria-hidden="true" className="table-color-default-x">
            ∅
          </span>
        </button>
      </div>
    </div>
  );
}
