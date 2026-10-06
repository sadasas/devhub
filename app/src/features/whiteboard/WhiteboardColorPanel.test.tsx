import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SWATCHES, WhiteboardColorPanel, normalizeHexColor } from './WhiteboardColorPanel';

describe('whiteboard color panel', () => {
  it('exposes 12 swatches and a hex input with no header/X — no tabs', () => {
    expect(SWATCHES).toHaveLength(12);
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<WhiteboardColorPanel value="#e8b955" onPick={onPick} onClose={onClose} />);
    // Dialog tetap bernama untuk aksesibilitas, tapi tanpa judul/X visual.
    expect(screen.getByRole('dialog', { name: 'Fill color' })).not.toBeNull();
    expect(screen.queryByText('Fill color')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Fill' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'No fill' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Transparent' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Fill color #6ea8fe' }));
    expect(onPick).toHaveBeenCalledWith('#6ea8fe');
    // Tutup via Escape (jalur yang tersisa).
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the fill tri-state only when fillMode is provided', () => {
    const onFillMode = vi.fn();
    const view = render(
      <WhiteboardColorPanel value="#2563eb" onPick={() => {}} onClose={() => {}} fillMode="none" onFillMode={onFillMode} />,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Fill' }));
    expect(onFillMode).toHaveBeenCalledWith('solid');
    view.unmount();
  });

  it('commits a typed hex value on Enter and rejects garbage', () => {
    const onPick = vi.fn();
    render(<WhiteboardColorPanel value="#e4e4e7" onPick={onPick} onClose={() => {}} />);
    const input = screen.getByRole('textbox', { name: 'Hex color' });
    fireEvent.change(input, { target: { value: '#f97316' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith('#f97316');
    fireEvent.change(input, { target: { value: 'not-a-color' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('keeps the panel open while interacting with the nested custom picker', () => {
    const onClose = vi.fn();
    render(<WhiteboardColorPanel value="#2563eb" onPick={() => {}} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Custom color' }));
    expect(screen.getByRole('dialog', { name: 'Custom color picker' })).not.toBeNull();
    // Klik di dalam popup bersarang (portal) bukan klik-di-luar.
    fireEvent.pointerDown(screen.getByRole('slider', { name: 'Saturation and brightness' }));
    fireEvent.pointerDown(screen.getByRole('slider', { name: 'Hue' }));
    expect(screen.getByRole('dialog', { name: 'Fill color' })).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    // Klik benar-benar di luar tetap menutup.
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('normalizes short hex', () => {
    expect(normalizeHexColor('#abc')).toBe('#aabbcc');
    expect(normalizeHexColor('FFF')).toBe('#ffffff');
    expect(normalizeHexColor('#12345')).toBeNull();
  });
});
