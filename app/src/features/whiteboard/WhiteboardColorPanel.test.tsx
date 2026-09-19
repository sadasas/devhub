import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SWATCHES, WhiteboardColorPanel, normalizeHexColor } from './WhiteboardColorPanel';

describe('whiteboard color panel', () => {
  it('exposes 12 swatches, a hex input and a close button — no tabs', () => {
    expect(SWATCHES).toHaveLength(12);
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<WhiteboardColorPanel value="#e8b955" onPick={onPick} onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Fill color' })).not.toBeNull();
    // Title text is visible and there is an X button.
    expect(screen.getByText('Fill color')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Fill' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'No fill' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Transparent' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Fill color #6ea8fe' }));
    expect(onPick).toHaveBeenCalledWith('#6ea8fe');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
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

  it('normalizes short hex', () => {
    expect(normalizeHexColor('#abc')).toBe('#aabbcc');
    expect(normalizeHexColor('FFF')).toBe('#ffffff');
    expect(normalizeHexColor('#12345')).toBeNull();
  });
});
