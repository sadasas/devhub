import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from '@phosphor-icons/react';
import { Tooltip } from '../../components/Tooltip';

/** Inline dots (toolbar strip): 8 basic colors + Custom rainbow. */
export const BASIC_SWATCHES: ReadonlyArray<string> = [
  '#0f172a',
  '#f4706d',
  '#f97316',
  '#e8b955',
  '#34c38e',
  '#6ea8fe',
  '#a78bfa',
  '#ffffff',
];
/** Color panel grid: 12 clickable colors + Custom rainbow + hex input. */
export const SWATCHES: ReadonlyArray<string> = [
  '#e4e4e7',
  '#e8b955',
  '#6ea8fe',
  '#34c38e',
  '#f2b8c6',
  '#a78bfa',
  '#f4706d',
  '#f97316',
  '#8a8a93',
  '#0f172a',
  '#1a1a1a',
  '#ffffff',
];

/** Accepts `#rrggbb`, `rrggbb` or `#rgb`; returns normalized lowercase `#rrggbb`. */
export function normalizeHexColor(raw: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return null;
  const digits = m[1];
  if (!digits) return null;
  const hex = digits.length === 3 ? digits.split('').map((c) => c + c).join('') : digits;
  return `#${hex.toLowerCase()}`;
}

interface WhiteboardColorPanelProps {
  value: string | null | undefined;
  /** Overrides the dialog title (e.g. fill vs text color). Defaults to the fill-color title. */
  title?: string;
  onPick: (color: string) => void;
  onClose: () => void;
}

/**
 * FigJam-style color panel (D10): visible title + X, a hex text input,
 * 12 clickable swatches plus a Custom rainbow picker. No tabs.
 */
export function WhiteboardColorPanel({
  value,
  title,
  onPick,
  onClose,
}: WhiteboardColorPanelProps) {
  const { t } = useTranslation('extras');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [hex, setHex] = useState(value ?? '');

  useEffect(() => {
    setHex(value ?? '');
  }, [value]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const heading = title ?? t('whiteboard.colorPanel.title');
  const commitHex = () => {
    const next = normalizeHexColor(hex);
    if (next) {
      onPick(next);
    } else {
      setHex(value ?? '');
    }
  };

  return (
    <div ref={rootRef} className="wb-colorpop" role="dialog" aria-label={heading}>
      <div className="wb-colorpop-head">
        <span className="wb-colorpop-heading">{heading}</span>
        <button type="button" className="wb-stripbtn" aria-label={t('whiteboard.popover.cancel')} onClick={onClose}>
          <X size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="wb-colorpop-grid" role="group" aria-label={heading}>
        {SWATCHES.map((c) => (
          <Tooltip key={c} content={c} side="top">
            <button
              type="button"
              className={`wb-dot${(value ?? '').toLowerCase() === c.toLowerCase() ? ' wb-dot-active' : ''}`}
              style={{ backgroundColor: c }}
              aria-label={`${heading} ${c}`}
              aria-pressed={(value ?? '').toLowerCase() === c.toLowerCase()}
              onClick={() => onPick(c)}
            />
          </Tooltip>
        ))}
        <Tooltip content={t('whiteboard.colorPanel.custom')} side="top">
          <label className="wb-rainbow">
            <span aria-hidden="true" className="wb-rainbow-ui" />
            <span className="sr-only">{t('whiteboard.colorPanel.custom')}</span>
            <input
              type="color"
              className="wb-rainbow-input"
              value={/^#[0-9a-f]{6}$/i.test(value ?? '') ? (value as string) : '#6ea8fe'}
              onChange={(e) => onPick(e.target.value)}
              aria-label={t('whiteboard.colorPanel.custom')}
            />
          </label>
        </Tooltip>
      </div>
      <input
        type="text"
        className="wb-colorpop-hex"
        value={hex}
        spellCheck={false}
        autoComplete="off"
        placeholder="#6ea8fe"
        aria-label={t('whiteboard.colorPanel.hex')}
        onChange={(e) => setHex(e.target.value)}
        onBlur={commitHex}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitHex();
          }
        }}
      />
    </div>
  );
}
