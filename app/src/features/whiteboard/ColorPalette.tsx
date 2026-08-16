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

export function ColorPalette({ value, onChange, label = 'Color' }: ColorPaletteProps) {
  return (
    <div className="fp-colors" role="radiogroup" aria-label={label}>
      {PALETTE_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-label={color}
          aria-checked={value === color}
          title={color}
          className={`fp-color${value === color ? ' fp-color-active' : ''}`}
          style={{ background: color }}
          onClick={() => onChange(color)}
        />
      ))}
    </div>
  );
}