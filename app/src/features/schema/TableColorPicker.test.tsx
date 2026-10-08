import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TableColorPicker } from './TableColorPicker';

function openPicker() {
  fireEvent.click(screen.getByRole('button', { name: 'Header color', expanded: false }));
  return screen.getByRole('dialog', { name: 'Header color' });
}

describe('TableColorPicker (swatch + custom popover + Default)', () => {
  it('renders group dengan swatch + tombol Default, tanpa native color input', () => {
    render(<TableColorPicker value={null} onChange={() => {}} />);
    expect(screen.getByRole('group')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Header color' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Default header color|Header default/i })).toBeTruthy();
    expect(document.querySelector('input[type="color"]')).toBeNull();
  });

  it('preview = warna saat ini, fallback accent saat Default', () => {
    const { rerender } = render(<TableColorPicker value={null} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Header color' }).style.backgroundColor).toBe(
      'rgb(93, 182, 155)',
    );
    rerender(<TableColorPicker value="#A78BFA" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Header color' }).style.backgroundColor).toBe(
      'rgb(167, 139, 250)',
    );
  });

  it('swatch membuka popover; pick hex -> onChange(lower); Default -> onChange(null)', () => {
    const onChange = vi.fn();
    render(<TableColorPicker value={null} onChange={onChange} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    const dialog = openPicker();
    expect(within(dialog).getByRole('slider', { name: 'Hue' })).not.toBeNull();
    const hex = within(dialog).getByRole('textbox', { name: 'Hex color' });
    fireEvent.change(hex, { target: { value: '#6EA8FE' } });
    fireEvent.keyDown(hex, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('#6ea8fe');
    onChange.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Default header color|Header default/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('slot tersimpan di key ERD terpisah (erd:customColors)', () => {
    localStorage.clear();
    function Probe() {
      const [value, setValue] = useState<string | null>(null);
      return <TableColorPicker value={value} onChange={setValue} />;
    }
    render(<Probe />);
    const dialog = openPicker();
    const hex = within(dialog).getByRole('textbox', { name: 'Hex color' });
    fireEvent.change(hex, { target: { value: '#f4706d' } });
    fireEvent.keyDown(hex, { key: 'Enter' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(JSON.parse(localStorage.getItem('erd:customColors') ?? '[]')).toEqual(['#f4706d']);
    expect(localStorage.getItem('wb:customColors')).toBeNull();
  });

  it('gate canEdit: disabled mematikan tombol + reset, onChange tidak jalan', () => {
    const onChange = vi.fn();
    render(<TableColorPicker value={null} onChange={onChange} disabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Header color' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Default header color|Header default/i }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('popover membuka ke atas bila ruang bawah scroll panel tak cukup', () => {
    const { container } = render(
      <div className="erd-panel-tabpanel">
        <TableColorPicker value={null} onChange={() => {}} />
      </div>,
    );
    const group = container.querySelector('.table-color-group')!;
    const tab = container.querySelector('.erd-panel-tabpanel')!;
    vi.spyOn(group, 'getBoundingClientRect').mockReturnValue({ bottom: 700 } as DOMRect);
    vi.spyOn(tab, 'getBoundingClientRect').mockReturnValue({ bottom: 750 } as DOMRect);
    fireEvent.click(screen.getByRole('button', { name: 'Header color' }));
    expect(screen.getByRole('dialog', { name: 'Header color' }).className).toContain(
      'table-color-pop-above',
    );
  });

  it('Esc saat popover terbuka menutup tanpa reset; Esc saat tertutup reset + fokus-kembali', () => {
    const onChange = vi.fn();
    render(<TableColorPicker value="#5db69b" onChange={onChange} />);
    openPicker();
    const group = screen.getByRole('group', { name: 'Header color' });
    fireEvent.keyDown(group, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(group, { key: 'Escape' });
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
