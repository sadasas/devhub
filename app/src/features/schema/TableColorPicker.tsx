import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SharedColorPicker } from '../../components/ColorPicker/SharedColorPicker';
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

/** Slot tersimpan ERD (terpisah dari slot whiteboard `wb:customColors`). */
export const ERD_COLOR_SLOTS_KEY = 'erd:customColors';

/**
 * Header color picker — swatch button + popover custom picker + Default reset.
 * Custom picker selalu menghasilkan #rrggbb lowercase; kontras tetap aman via
 * headerTitleColor. Esc menutup popover bila terbuka, else reset ke Default
 * saat editable lalu fokus kembali ke grup (fokus-kembali, stopPropagation
 * agar Esc panel/canvas bertingkat tidak ikut terpancing).
 */
export function TableColorPicker({ value, onChange, disabled = false, id = 'tbl-color', label }: TableColorPickerProps) {
  const { t } = useTranslation('project');
  const groupRef = useRef<HTMLDivElement>(null);
  const swatchRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  // Popover membuka ke atas bila ruang bawah dalam scroll panel tak cukup
  // (temuan: terpotong bar schema-issues). Perkiraan tinggi popover ~320px.
  const [above, setAbove] = useState(false);
  const norm = normalizeHeaderColor(value);
  const labelId = `${id}-label`;
  const labelText = label ?? t('schema.table.colorLabel');
  // Swatch menampilkan warna kini; saat Default pakai aksen kanvas
  // (tidak ada yang di-commit sampai pengguna memilih).
  const preview = norm ?? '#5db69b';

  const commit = (next: string | null) => {
    if (disabled) return;
    onChange(next);
  };

  const close = () => {
    setOpen(false);
    swatchRef.current?.focus();
  };

  const toggle = () => {
    if (disabled) return;
    if (!open) {
      // Ukur ruang bawah terhadap scroll container terdekat (fallback viewport).
      const group = groupRef.current;
      const scroller = group?.closest('.erd-panel-tabpanel') ?? null;
      const limit = scroller?.getBoundingClientRect().bottom ?? window.innerHeight;
      const bottom = group?.getBoundingClientRect().bottom ?? 0;
      setAbove(limit - bottom < 320);
    }
    setOpen((v) => !v);
  };

  // Klik di luar menutup popover (tanpa menutup panel ERD).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!groupRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    // Esc: stop tiered-Esc (panel/canvas) agar picking tidak menutup panel.
    e.stopPropagation();
    if (disabled) return;
    e.preventDefault();
    if (open) {
      close();
      return;
    }
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
        <button
          ref={swatchRef}
          type="button"
          id={`${id}-input`}
          aria-labelledby={labelId}
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={disabled}
          className="table-color-swatch table-color-current"
          style={{ backgroundColor: preview }}
          onClick={toggle}
        >
          <span className="sr-only">{labelText}</span>
        </button>
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
        {open && !disabled && (
          <div className={`table-color-pop${above ? ' table-color-pop-above' : ''}`} role="dialog" aria-label={labelText}>
            <SharedColorPicker value={preview} onPick={(hex) => commit(hex)} slotsKey={ERD_COLOR_SLOTS_KEY} />
          </div>
        )}
      </div>
    </div>
  );
}
