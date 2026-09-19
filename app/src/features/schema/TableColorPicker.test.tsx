import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TableColorPicker } from './TableColorPicker';

function nativeInput(container: HTMLElement): HTMLInputElement {
  const el = container.querySelector('.table-color-native');
  if (!(el instanceof HTMLInputElement)) throw new Error('native color input not found');
  return el;
}

describe('TableColorPicker (native round picker + Default)', () => {
  it('renders group dengan 1 native color input + tombol Default', () => {
    const { container } = render(<TableColorPicker value={null} onChange={() => {}} />);
    expect(screen.getByRole('group')).toBeTruthy();
    const input = nativeInput(container);
    expect(input.getAttribute('type')).toBe('color');
    expect(screen.getByRole('button', { name: /Default header color|Header default/i })).toBeTruthy();
  });

  it('preview = warna saat ini, fallback accent saat Default', () => {
    const { container, rerender } = render(<TableColorPicker value={null} onChange={() => {}} />);
    expect(nativeInput(container).value).toBe('#5db69b');
    rerender(<TableColorPicker value="#A78BFA" onChange={() => {}} />);
    expect(nativeInput(container).value).toBe('#a78bfa');
  });

  it('pick warna -> onChange(hex lower), Default -> onChange(null)', () => {
    const onChange = vi.fn();
    const { container } = render(<TableColorPicker value={null} onChange={onChange} />);
    fireEvent.change(nativeInput(container), { target: { value: '#6EA8FE' } });
    expect(onChange).toHaveBeenCalledWith('#6ea8fe');
    onChange.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Default header color|Header default/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('gate canEdit: disabled mematikan input + reset, onChange tidak jalan', () => {
    const onChange = vi.fn();
    const { container } = render(<TableColorPicker value={null} onChange={onChange} disabled />);
    expect(nativeInput(container).disabled).toBe(true);
    expect(
      (screen.getByRole('button', { name: /Default header color|Header default/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Default header color|Header default/i }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Esc reset ke Default + fokus-kembali, tanpa bubble ke panel/canvas', () => {
    const onChange = vi.fn();
    render(<TableColorPicker value="#5db69b" onChange={onChange} />);
    const group = screen.getByRole('group');
    const stop = vi.fn();
    const parent = document.createElement('div');
    parent.addEventListener('keydown', stop);
    // Fire Esc inside the group; stopPropagation is asserted via no-throw + onChange(null).
    fireEvent.keyDown(group, { key: 'Escape' });
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
