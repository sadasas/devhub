import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '../../components/Tooltip';
import type { WhiteboardShapeFill } from '../../lib/types';
import { shapeFillMode } from './canvas-palette';

const FILL_MODES: ReadonlyArray<WhiteboardShapeFill> = ['solid', 'transparent', 'none'];

function FillGlyph({ mode }: { mode: WhiteboardShapeFill }) {
  if (mode === 'none') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <rect x="2" y="2" width="10" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <line x1="3" y1="11" x2="11" y2="3" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <rect
        x="2"
        y="2"
        width="10"
        height="10"
        rx="2"
        fill="currentColor"
        fillOpacity={mode === 'transparent' ? 0.15 : 1}
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/**
 * Segmented Fill / Transparent / No fill ala FigJam — dipakai di header
 * panel warna shape, strip default, dan dropdown tipe.
 */
export function FillModeSegmented({
  value,
  onChange,
}: {
  value: WhiteboardShapeFill | boolean | null | undefined;
  onChange: (mode: WhiteboardShapeFill) => void;
}) {
  const { t } = useTranslation('extras');
  const cur = shapeFillMode(value);
  const keyOf = (m: WhiteboardShapeFill) => (m === 'solid' ? 'fill' : m === 'transparent' ? 'transparent' : 'noFill');
  return (
    <span className="fp-segmented fp-segmented-bar" role="radiogroup" aria-label={t('whiteboard.textbar.fill')}>
      {FILL_MODES.map((m) => {
        const name = t(`whiteboard.colorPanel.${keyOf(m)}`);
        return (
          <Tooltip key={m} content={name} side="top">
            <button
              type="button"
              role="radio"
              aria-checked={cur === m}
              aria-label={name}
              className={`fp-seg${cur === m ? ' fp-seg-active' : ''}`}
              onClick={() => onChange(m)}
            >
              <FillGlyph mode={m} />
              <span className="wb-lineopt-name">{name}</span>
            </button>
          </Tooltip>
        );
      })}
    </span>
  );
}

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

export type LineStyleOption = 'solid' | 'dashed' | 'dotted' | 'none';

function LineGlyph({ option }: { option: LineStyleOption }) {
  if (option === 'none') {
    return (
      <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true">
        <circle cx="14" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <line x1="4" y1="10" x2="24" y2="2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  const dash = option === 'dashed' ? '5 3' : option === 'dotted' ? '1.5 3' : undefined;
  return (
    <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true">
      <line
        x1="2"
        y1="6"
        x2="26"
        y2="6"
        stroke="currentColor"
        strokeWidth={option === 'dotted' ? 2.5 : 2}
        strokeDasharray={dash}
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Segmented gaya garis ala Figma (ikon, bukan teks) — dipakai popup
 * border shape dan line edge. Accessible name = nilai mentah.
 */
export function LineStyleSegmented({
  value,
  options,
  onChange,
  label,
}: {
  value: LineStyleOption;
  options: ReadonlyArray<LineStyleOption>;
  onChange: (style: LineStyleOption) => void;
  label: string;
}) {
  return (
    <span className="fp-segmented fp-segmented-bar" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const name = o.charAt(0).toUpperCase() + o.slice(1);
        return (
          <Tooltip key={o} content={name} side="top">
            <button
              type="button"
              role="radio"
              aria-checked={value === o}
              aria-label={o}
              title={o}
              className={`fp-seg${value === o ? ' fp-seg-active' : ''}`}
              onClick={() => onChange(o)}
            >
              <LineGlyph option={o} />
              <span className="wb-lineopt-name">{name}</span>
            </button>
          </Tooltip>
        );
      })}
    </span>
  );
}

/**
 * Grid swatch + custom rainbow tanpa krom dialog — dipakai panel warna
 * maupun popup line style (satu sumber, FigJam/Figma).
 */
export function ColorSwatchGrid({
  value,
  onPick,
  heading,
}: {
  value: string | null | undefined;
  onPick: (color: string) => void;
  heading: string;
}) {
  const { t } = useTranslation('extras');
  const [hex, setHex] = useState(value ?? '');

  useEffect(() => {
    setHex(value ?? '');
  }, [value]);

  const commitHex = () => {
    const next = normalizeHexColor(hex);
    if (next) {
      onPick(next);
    } else {
      setHex(value ?? '');
    }
  };

  return (
    <>
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
              value={/^#[0-9a-f]{6}$/i.test(value ?? '') ? (value as string) : '#2563eb'}
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
        placeholder="#2563eb"
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
    </>
  );
}

interface WhiteboardColorPanelProps {
  value: string | null | undefined;
  /** Overrides the dialog title (e.g. fill vs text color). Defaults to the fill-color title. */
  title?: string;
  onPick: (color: string) => void;
  onClose: () => void;
  /** Bila diisi: segmented Fill/Transparent/No-fill di atas grid (konteks fill shape). */
  fillMode?: WhiteboardShapeFill | boolean | null;
  onFillMode?: (mode: WhiteboardShapeFill) => void;
}

/**
 * FigJam-style color panel (D10): no header/X (tutup via outside-tap +
 * Escape seperti popup lain), a hex text input, 12 clickable swatches
 * plus a Custom rainbow picker. No tabs.
 */
export function WhiteboardColorPanel({
  value,
  title,
  onPick,
  onClose,
  fillMode,
  onFillMode,
}: WhiteboardColorPanelProps) {
  const { t } = useTranslation('extras');
  const rootRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <div ref={rootRef} className="wb-colorpop" role="dialog" aria-label={heading}>
      {fillMode !== undefined && onFillMode && (
        <>
          <FillModeSegmented value={fillMode} onChange={onFillMode} />
          <div className="wb-pop-sep" role="separator" aria-hidden="true" />
        </>
      )}
      <ColorSwatchGrid value={value} onPick={onPick} heading={heading} />
    </div>
  );
}
