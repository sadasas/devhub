import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '../../components/Tooltip';
import { CUSTOM_COLOR_SLOTS, hexToHsv, hsvToHex, normalizeHexColor, sanitizeSlots } from './color';
import { DropCaret, DropdownShell } from './WhiteboardTextControls';

const FALLBACK_HSV = { h: 217, s: 0.83, v: 0.92 };

function useCustomColorSlots() {
  const [slots, setSlots] = useState<string[]>(() => {
    try {
      return sanitizeSlots(JSON.parse(localStorage.getItem('wb:customColors') ?? '[]'));
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('wb:customColors', JSON.stringify(slots));
    } catch {
      /* storage penuh/diblokir — slot sesi ini tetap jalan */
    }
  }, [slots]);
  const save = (hex: string) => setSlots((prev) => [hex, ...prev.filter((s) => s !== hex)].slice(0, CUSTOM_COLOR_SLOTS));
  return { slots, save };
}

/**
 * Custom color picker ala Figma (Opsi B): area saturasi/value + hue slider
 * + hex + slot tersimpan + eyedropper (bila browser mendukung). Menggantikan
 * dialog warna bawaan OS yang tak bisa di-style. Live onPick saat drag.
 */
export function CustomColorPicker({
  value,
  onPick,
}: {
  value: string | null | undefined;
  onPick: (hex: string) => void;
}) {
  const { t } = useTranslation('extras');
  const hsv = hexToHsv(value ?? '') ?? FALLBACK_HSV;
  const hex = hsvToHex(hsv.h, hsv.s, hsv.v);
  const [draft, setDraft] = useState(hex);
  useEffect(() => {
    setDraft(hex);
  }, [hex]);
  const { slots, save } = useCustomColorSlots();
  const svRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  const setFromPointer = (clientX: number, clientY: number) => {
    const el = svRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const s = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const v = 1 - Math.min(1, Math.max(0, (clientY - r.top) / r.height));
    onPick(hsvToHex(hsv.h, s, v));
  };

  const onSvKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.05;
    let { s, v } = hsv;
    if (e.key === 'ArrowLeft') s -= step;
    else if (e.key === 'ArrowRight') s += step;
    else if (e.key === 'ArrowUp') v += step;
    else if (e.key === 'ArrowDown') v -= step;
    else return;
    e.preventDefault();
    onPick(hsvToHex(hsv.h, s, v));
  };

  const commitHex = () => {
    const next = normalizeHexColor(draft);
    if (next) onPick(next);
    else setDraft(hex);
  };

  const canEyeDrop =
    typeof window !== 'undefined' &&
    typeof (window as unknown as { EyeDropper?: unknown }).EyeDropper === 'function';
  const eyeDrop = async () => {
    try {
      const Ctor = (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } })
        .EyeDropper;
      const result = await new Ctor().open();
      if (result?.sRGBHex) onPick(result.sRGBHex.toLowerCase());
    } catch {
      /* batal/ditolak — diam */
    }
  };

  const hueHex = hsvToHex(hsv.h, 1, 1);
  return (
    <div className="wb-custompick">
      <div
        ref={svRef}
        className="wb-sv"
        role="slider"
        tabIndex={0}
        aria-label={t('whiteboard.colorPanel.sv')}
        aria-valuetext={hex}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.s * 100)}
        onKeyDown={onSvKeyDown}
        onPointerDown={(e) => {
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* jsdom / pointer mouse tanpa capture — drag tetap jalan via move */
          }
          dragging.current = true;
          setFromPointer(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (dragging.current) setFromPointer(e.clientX, e.clientY);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
        style={{ backgroundColor: hueHex }}
      >
        <span aria-hidden="true" className="wb-sv-white" />
        <span aria-hidden="true" className="wb-sv-black" />
        <span
          aria-hidden="true"
          className="wb-sv-cursor"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
        />
      </div>
      <input
        type="range"
        className="wb-hue"
        min={0}
        max={360}
        step={1}
        value={Math.round(hsv.h)}
        aria-label={t('whiteboard.colorPanel.hue')}
        onChange={(e) => onPick(hsvToHex(Number(e.target.value), hsv.s, hsv.v))}
      />
      <div className="wb-custompick-row">
        <span aria-hidden="true" className="wb-custompick-preview" style={{ backgroundColor: hex }} />
        <input
          type="text"
          className="wb-colorpop-hex"
          value={draft}
          spellCheck={false}
          autoComplete="off"
          aria-label={t('whiteboard.colorPanel.hex')}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitHex}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitHex();
            }
          }}
        />
        <button type="button" className="wb-custompick-save" onClick={() => save(hex)}>
          {t('whiteboard.colorPanel.saveSlot')}
        </button>
        {canEyeDrop && (
          <Tooltip content={t('whiteboard.colorPanel.eyedropper')} side="top">
            <button
              type="button"
              className="wb-custompick-save"
              aria-label={t('whiteboard.colorPanel.eyedropper')}
              onClick={eyeDrop}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path
                  d="M8.5 2.5l3 3L5 12H2V9l6.5-6.5z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <line x1="2" y1="12" x2="5" y2="12" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </Tooltip>
        )}
      </div>
      <div className="wb-slots" role="group" aria-label={t('whiteboard.colorPanel.slots')}>
        {slots.map((c) => (
          <Tooltip key={c} content={c} side="top">
            <button
              type="button"
              className="wb-dot"
              style={{ backgroundColor: c }}
              aria-label={c}
              onClick={() => onPick(c)}
            />
          </Tooltip>
        ))}
        {slots.length === 0 && <span className="wb-slots-hint">{t('whiteboard.colorPanel.slotsEmpty')}</span>}
      </div>
    </div>
  );
}

/**
 * Tombol rainbow: membuka popover picker custom (Opsi B) — panel swatch
 * tetap murni, dialog OS tidak pernah muncul. Dipakai strip + panel warna.
 */
export function CustomColorButton({
  value,
  onPick,
}: {
  value: string | null | undefined;
  onPick: (hex: string) => void;
}) {
  const { t } = useTranslation('extras');
  const [open, setOpen] = useState(false);
  return (
    <DropdownShell
      open={open}
      onToggle={() => setOpen((v) => !v)}
      onClose={() => setOpen(false)}
      label={t('whiteboard.colorPanel.custom')}
      popLabel={t('whiteboard.colorPanel.customTitle')}
      button={
        <>
          <span aria-hidden="true" className="wb-rainbow">
            <span aria-hidden="true" className="wb-rainbow-ui" />
          </span>
          <DropCaret />
        </>
      }
    >
      <CustomColorPicker value={value} onPick={onPick} />
    </DropdownShell>
  );
}
