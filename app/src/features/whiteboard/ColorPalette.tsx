import { useTranslation } from 'react-i18next';

interface ColorPaletteProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

export const PALETTE_COLORS = [
  '#e4e4e7',
  '#6ea8fe',
  '#34c38e',
  '#e8b955',
  '#f4706d',
  '#a78bfa',
  '#f2b8c6',
  '#06251a',
] as const;

function toHexColor(value: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const r = value[1]!;
    const g = value[2]!;
    const b = value[3]!;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  // rgba(6,5,4,0.85) or other non-hex -> fallback dark for sticky text / use first palette
  if (value.startsWith('rgba')) return '#1a1a1a';
  return '#e4e4e7';
}

export function ColorPalette({ value, onChange, label }: ColorPaletteProps) {
  const { t } = useTranslation('extras');
  const hex = toHexColor(value);
  return (
    <label className="wb-color-picker-wrap" aria-label={label ?? t('whiteboard.palette.color')}>
      <input type="color" className="wb-color-picker" value={hex} onChange={(e) => onChange(e.target.value)} aria-label={label ?? t('whiteboard.palette.color')} />
      <span className="wb-color-hex" aria-hidden="true">{hex}</span>
    </label>
  );
}
