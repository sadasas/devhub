import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlignBottom,
  AlignCenterVertical,
  AlignTop,
  CaretDown,
  CaretUp,
  ListBullets,
  TextAlignCenter,
  TextAlignLeft,
  TextAlignRight,
  TextB,
  TextStrikethrough,
} from '@phosphor-icons/react';
import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import type { WhiteboardAlign, WhiteboardFontFamily, WhiteboardValign } from '../../lib/types';
import { Tooltip } from '../../components/Tooltip';
import { FONT_PRESETS, FONT_SIZE_MAX, FONT_SIZE_MIN, fontStackOf } from './fonts';
import { WhiteboardColorPanel } from './WhiteboardColorPanel';

const FONT_ORDER: WhiteboardFontFamily[] = ['simple', 'bookish', 'technical', 'scribbled'];
const FONT_LABEL: Record<WhiteboardFontFamily, string> = {
  simple: 'Simple',
  bookish: 'Bookish',
  technical: 'Technical',
  scribbled: 'Scribbled',
};

interface DropdownShellProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  label: string;
  button: React.ReactNode;
  children: React.ReactNode;
  popLabel: string;
  /** Render children bare (they bring their own panel chrome, e.g. color panel). */
  bare?: boolean;
}

/** Small floating-bar dropdown button + anchored popup (Opsi B: portal floating-ui — kebal overflow strip). */
export function DropdownShell({ open, onToggle, onClose, label, button, children, popLabel, bare = false }: DropdownShellProps) {
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
    placement: 'top',
    strategy: 'fixed',
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'dialog' });
  const { getFloatingProps } = useInteractions([dismiss, role]);

  return (
    <>
    <span className="wb-dd" ref={refs.setReference} data-wb-popup-root>
      <Tooltip content={label} side="top" disabled={open}>
        <button
          type="button"
          className={`wb-stripbtn wb-dd-btn${open ? ' wb-stripbtn-active' : ''}`}
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={onToggle}
        >
          {button}
        </button>
      </Tooltip>
      </span>
      {open && (
        <FloatingPortal>
          <div className="wb-portal-pop" ref={refs.setFloating} style={floatingStyles} {...getFloatingProps()} data-wb-popup>
            {bare ? (
              children
            ) : (
              <div className="wb-linepop wb-dd-pop" role="dialog" aria-label={popLabel}>
                {children}
              </div>
            )}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}

/** Trailing caret marking every popup toggle (P12). */
export function DropCaret() {
  return <CaretDown size={12} aria-hidden="true" className="wb-caret" />;
}

interface ColorDropdownProps {
  value: string | null | undefined;
  /** Panel heading; defaults to the toggle label. */
  title?: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onPick: (color: string) => void;
  label: string;
}

/** Fill/text color dot + caret opening the shared color panel in a portal. */
export function ColorDropdown({ value, title, open, onToggle, onClose, onPick, label, glyph = 'dot' }: ColorDropdownProps & { glyph?: 'dot' | 'letter' }) {
  const cur = typeof value === 'string' && value ? value : '#374151';
  const name = `${label} ${cur}`;
  return (
    <DropdownShell
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      label={name}
      popLabel={title ?? label}
      bare
      button={
        <>
          {glyph === 'letter' ? (
            <span className="wb-textdot" style={{ color: cur }} aria-hidden="true">
              A
            </span>
          ) : (
            <span className="wb-dot" style={{ backgroundColor: cur }} aria-hidden="true" />
          )}
          <DropCaret />
        </>
      }
    >
      <WhiteboardColorPanel value={value} title={title} onPick={onPick} onClose={onClose} />
    </DropdownShell>
  );
}

interface FontDropdownProps {
  value: WhiteboardFontFamily | null | undefined;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onPick: (font: WhiteboardFontFamily) => void;
}

/** FigJam typeface picker (Image 10): sample rows in each typeface. */
export function FontDropdown({ value, open, onToggle, onClose, onPick }: FontDropdownProps) {
  const { t } = useTranslation('extras');
  const cur = value ?? 'simple';
  return (
    <DropdownShell
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      label={t('whiteboard.textbar.font')}
      popLabel={t('whiteboard.textbar.font')}
      button={
        <>
          <span className="wb-dd-name" style={{ fontFamily: fontStackOf(cur) }}>
            Ag
          </span>
          <DropCaret />
        </>
      }
    >
      {FONT_ORDER.map((f) => (
        <button
          key={f}
          type="button"
          role="radio"
          aria-checked={cur === f}
          className={`wb-fontopt${cur === f ? ' wb-fontopt-active' : ''}`}
          onClick={() => {
            onPick(f);
            onClose();
          }}
        >
          <span className="wb-fontopt-sample" style={{ fontFamily: fontStackOf(f) }} aria-hidden="true">
            Ag
          </span>
          <span className="wb-fontopt-name">{FONT_LABEL[f]}</span>
        </button>
      ))}
    </DropdownShell>
  );
}

const SIZE_KEY = ['sizeSmall', 'sizeMedium', 'sizeLarge', 'sizeXl', 'sizeHuge'] as const;

interface SizeDropdownProps {
  value: number;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onPick: (size: number) => void;
}

/**
 * Text size picker (P13): preset rows (name + value, check on the active
 * row) plus a boxed custom input with steppers at the bottom.
 */
export function SizeDropdown({ value, open, onToggle, onClose, onPick }: SizeDropdownProps) {
  const { t } = useTranslation('extras');
  const cur = Math.round(value);
  const [raw, setRaw] = useState(String(cur));
  useEffect(() => {
    setRaw(String(Math.round(value)));
  }, [value, open]);
  const commitRaw = (text: string) => {
    const n = Number(text);
    if (Number.isFinite(n) && text.trim() !== '') {
      onPick(Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, Math.round(n))));
    } else {
      setRaw(String(Math.round(value)));
    }
  };
  const step = (d: number) => {
    const base = Number.isFinite(Number(raw)) && raw.trim() !== '' ? Math.round(Number(raw)) : cur;
    const next = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, base + d));
    setRaw(String(next));
    onPick(next);
  };
  return (
    <DropdownShell
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      label={t('whiteboard.textbar.size')}
      popLabel={t('whiteboard.textbar.size')}
      button={
        <>
          <span className="wb-stripnum tabular" aria-hidden="true">
            {cur}
          </span>
          <DropCaret />
        </>
      }
    >
      {FONT_PRESETS.map((p, i) => (
        <button
          key={p.value}
          type="button"
          role="radio"
          aria-checked={cur === p.value}
          className={`wb-sizeopt${cur === p.value ? ' wb-sizeopt-active' : ''}`}
          onClick={() => {
            onPick(p.value);
            onClose();
          }}
        >
          <span className="wb-sizeopt-name" style={{ fontSize: Math.min(p.value, 30) }}>{t(`whiteboard.textbar.${SIZE_KEY[i]}`)}</span>
          <span className="wb-stripnum tabular" aria-hidden="true">
            {p.value}
          </span>
        </button>
      ))}
      <span className="wb-sizebox">
        <input
          type="text"
          inputMode="numeric"
          className="wb-sizebox-input tabular"
          value={raw}
          aria-label={t('whiteboard.textbar.sizeCustom')}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={() => commitRaw(raw)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitRaw(raw);
            }
          }}
        />
        <span className="wb-sizebox-steps" aria-hidden="true">
          <button type="button" tabIndex={-1} className="wb-sizebox-step" onClick={() => step(1)}>
            <CaretUp size={10} />
          </button>
          <button type="button" tabIndex={-1} className="wb-sizebox-step" onClick={() => step(-1)}>
            <CaretDown size={10} />
          </button>
        </span>
      </span>
    </DropdownShell>
  );
}

interface AlignDropdownProps {
  value: WhiteboardAlign;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onChange: (align: WhiteboardAlign) => void;
}

/** Alignment toggle (P4): current-align icon + caret, popup holds the segmented row. */
export function AlignDropdown({ value, open, onToggle, onClose, onChange }: AlignDropdownProps) {
  const { t } = useTranslation('extras');
  const CurIcon = value === 'left' ? TextAlignLeft : value === 'center' ? TextAlignCenter : TextAlignRight;
  const opts: Array<{ v: WhiteboardAlign; Icon: typeof TextAlignLeft; name: string }> = [
    { v: 'left', Icon: TextAlignLeft, name: t('whiteboard.popover.align_left') },
    { v: 'center', Icon: TextAlignCenter, name: t('whiteboard.popover.align_center') },
    { v: 'right', Icon: TextAlignRight, name: t('whiteboard.popover.align_right') },
  ];
  return (
    <DropdownShell
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      label={t('whiteboard.textbar.textAlign')}
      popLabel={t('whiteboard.textbar.textAlign')}
      button={
        <>
          <CurIcon size={15} aria-hidden="true" />
          <DropCaret />
        </>
      }
    >
      <span className="fp-segmented fp-segmented-bar" role="radiogroup" aria-label={t('whiteboard.textbar.textAlign')}>
        {opts.map(({ v, Icon, name }) => (
          <Tooltip key={v} content={name} side="top">
            <button
              type="button"
              role="radio"
              aria-checked={value === v}
              aria-label={name}
              className={`fp-seg${value === v ? ' fp-seg-active' : ''}`}
              onClick={() => {
                onChange(v);
                onClose();
              }}
            >
              <Icon size={15} aria-hidden="true" />
            </button>
          </Tooltip>
        ))}
      </span>
    </DropdownShell>
  );
}

interface ValignDropdownProps {
  value: WhiteboardValign;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onChange: (valign: WhiteboardValign) => void;
}

/** Vertical alignment toggle: current-valign icon + caret, popup holds the segmented row. */
export function ValignDropdown({ value, open, onToggle, onClose, onChange }: ValignDropdownProps) {
  const { t } = useTranslation('extras');
  const CurIcon = value === 'top' ? AlignTop : value === 'center' ? AlignCenterVertical : AlignBottom;
  return (
    <DropdownShell
      open={open}
      onToggle={onToggle}
      onClose={onClose}
      label={t('whiteboard.textbar.valign')}
      popLabel={t('whiteboard.textbar.valign')}
      button={
        <>
          <CurIcon size={15} aria-hidden="true" />
          <DropCaret />
        </>
      }
    >
      <ValignSegmented value={value} onChange={(v) => { onChange(v); onClose(); }} />
    </DropdownShell>
  );
}

interface AlignSegmentedProps {
  value: WhiteboardAlign;
  onChange: (align: WhiteboardAlign) => void;
}
export function AlignSegmented({ value, onChange }: AlignSegmentedProps) {
  const { t } = useTranslation('extras');
  const opts: Array<{ v: WhiteboardAlign; Icon: typeof TextAlignLeft; name: string }> = [
    { v: 'left', Icon: TextAlignLeft, name: t('whiteboard.popover.align_left') },
    { v: 'center', Icon: TextAlignCenter, name: t('whiteboard.popover.align_center') },
    { v: 'right', Icon: TextAlignRight, name: t('whiteboard.popover.align_right') },
  ];
  return (
    <span className="fp-segmented fp-segmented-bar" role="radiogroup" aria-label={t('whiteboard.textbar.textAlign')}>
      {opts.map(({ v, Icon, name }) => (
        <Tooltip key={v} content={name} side="top">
          <button
            type="button"
            role="radio"
            aria-checked={value === v}
            aria-label={name}
            className={`fp-seg${value === v ? ' fp-seg-active' : ''}`}
            onClick={() => onChange(v)}
          >
            <Icon size={15} aria-hidden="true" />
          </button>
        </Tooltip>
      ))}
    </span>
  );
}

interface ValignSegmentedProps {
  value: WhiteboardValign;
  onChange: (valign: WhiteboardValign) => void;
}

/** Inline 3-way vertical alignment segmented control (Image 1: Top/Center/Bottom). */
export function ValignSegmented({ value, onChange }: ValignSegmentedProps) {
  const { t } = useTranslation('extras');
  const opts: Array<{ v: WhiteboardValign; Icon: typeof AlignTop; name: string }> = [
    { v: 'top', Icon: AlignTop, name: t('whiteboard.popover.valign_top') },
    { v: 'center', Icon: AlignCenterVertical, name: t('whiteboard.popover.valign_center') },
    { v: 'bottom', Icon: AlignBottom, name: t('whiteboard.popover.valign_bottom') },
  ];
  return (
    <span className="fp-segmented fp-segmented-bar" role="radiogroup" aria-label={t('whiteboard.textbar.valign')}>
      {opts.map(({ v, Icon, name }) => (
        <Tooltip key={v} content={name} side="top">
          <button
            type="button"
            role="radio"
            aria-checked={value === v}
            aria-label={name}
            className={`fp-seg${value === v ? ' fp-seg-active' : ''}`}
            onClick={() => onChange(v)}
          >
            <Icon size={15} aria-hidden="true" />
          </button>
        </Tooltip>
      ))}
    </span>
  );
}

interface TextStyleTogglesProps {
  bold: boolean;
  strikethrough: boolean;
  bullet: boolean;
  onBold: () => void;
  onStrikethrough: () => void;
  onBullet: () => void;
}

/** Bold / strikethrough / bulleted-list toggles (Image 7, right cluster). */
export function TextStyleToggles({ bold, strikethrough, bullet, onBold, onStrikethrough, onBullet }: TextStyleTogglesProps) {
  const { t } = useTranslation('extras');
  const btn = (
    label: string,
    active: boolean,
    onClick: () => void,
    icon: React.ReactNode,
  ) => (
    <Tooltip content={label} side="top">
      <button
        type="button"
        className={`wb-stripbtn${active ? ' wb-stripbtn-active' : ''}`}
        aria-label={label}
        aria-pressed={active}
        onClick={onClick}
      >
        {icon}
      </button>
    </Tooltip>
  );
  return (
    <>
      {btn(t('whiteboard.textbar.bold'), bold, onBold, <TextB size={15} aria-hidden="true" />)}
      {btn(t('whiteboard.textbar.strikethrough'), strikethrough, onStrikethrough, <TextStrikethrough size={15} aria-hidden="true" />)}
      {btn(t('whiteboard.textbar.bullet'), bullet, onBullet, <ListBullets size={15} aria-hidden="true" />)}
    </>
  );
}

interface WidthSliderProps {
  value: number;
  min?: number;
  max?: number;
  label: string;
  onChange: (width: number) => void;
}

/** Non-text size popup (P6): slider plus a boxed numeric input with steppers. */
export function WidthSlider({ value, min = 1, max = 20, label, onChange }: WidthSliderProps) {
  const cur = Math.round(value);
  const [raw, setRaw] = useState(String(cur));
  useEffect(() => {
    setRaw(String(Math.round(value)));
  }, [value]);
  const commitRaw = (text: string) => {
    const n = Number(text);
    if (Number.isFinite(n) && text.trim() !== '') {
      onChange(Math.max(min, Math.min(max, Math.round(n))));
    } else {
      setRaw(String(cur));
    }
  };
  const step = (d: number) => {
    const base = Number.isFinite(Number(raw)) && raw.trim() !== '' ? Math.round(Number(raw)) : cur;
    const next = Math.max(min, Math.min(max, base + d));
    setRaw(String(next));
    onChange(next);
  };
  return (
    <span className="wb-widthwrap">
      <input
        type="range"
        className="wb-slider"
        value={cur}
        min={min}
        max={max}
        step={1}
        aria-label={label}
        onChange={(e) => {
          setRaw(e.target.value);
          onChange(Number(e.target.value));
        }}
      />
      <span className="wb-sizebox">
        <input
          type="text"
          inputMode="numeric"
          className="wb-sizebox-input tabular"
          value={raw}
          aria-label={label}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={() => commitRaw(raw)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitRaw(raw);
            }
          }}
        />
        <span className="wb-sizebox-steps" aria-hidden="true">
          <button type="button" tabIndex={-1} className="wb-sizebox-step" onClick={() => step(1)}>
            <CaretUp size={10} />
          </button>
          <button type="button" tabIndex={-1} className="wb-sizebox-step" onClick={() => step(-1)}>
            <CaretDown size={10} />
          </button>
        </span>
      </span>
    </span>
  );
}
