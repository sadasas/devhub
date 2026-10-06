import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CustomColorButton, CustomColorPicker } from './CustomColorPicker';

function mockSvRect(el: HTMLElement, w = 200, h = 125) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: w,
    bottom: h,
    width: w,
    height: h,
    toJSON: () => {},
  } as DOMRect);
}

describe('CustomColorPicker (Opsi B)', () => {
  it('renders SV area, hue slider, hex and empty slots — no native color input', () => {
    const onPick = vi.fn();
    render(<CustomColorPicker value="#2563eb" onPick={onPick} />);
    expect(screen.getByRole('slider', { name: 'Saturation and brightness' })).not.toBeNull();
    expect(screen.getByRole('slider', { name: 'Hue' })).not.toBeNull();
    expect(screen.getByRole('textbox', { name: 'Hex color' })).not.toBeNull();
    expect(screen.getByText('No saved colors yet')).not.toBeNull();
    // dialog OS tak pernah muncul: tanpa input[type=color], eyedropper hidden di jsdom
    expect(document.querySelector('input[type="color"]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pick from screen' })).toBeNull();
  });

  it('drags on the SV area and commits live hex picks', () => {
    const onPick = vi.fn();
    render(<CustomColorPicker value="#2563eb" onPick={onPick} />);
    const sv = screen.getByRole('slider', { name: 'Saturation and brightness' });
    mockSvRect(sv);
    fireEvent.pointerDown(sv, { clientX: 200, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(sv, { clientX: 100, clientY: 62, pointerId: 1 });
    fireEvent.pointerUp(sv, { pointerId: 1 });
    expect(onPick).toHaveBeenCalled();
    for (const hex of onPick.mock.calls.map((c) => c[0] as string)) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(onPick.mock.calls[0]![0]).not.toBe('#2563eb');
  });

  it('adjusts saturation with arrow keys', () => {
    const onPick = vi.fn();
    render(<CustomColorPicker value="#2563eb" onPick={onPick} />);
    const sv = screen.getByRole('slider', { name: 'Saturation and brightness' });
    fireEvent.keyDown(sv, { key: 'ArrowLeft' });
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0]![0]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('commits typed hex and saves slots to localStorage', () => {
    localStorage.clear();
    const onPick = vi.fn();
    function Probe() {
      const [value, setValue] = useState('#2563eb');
      return (
        <CustomColorPicker
          value={value}
          onPick={(c) => {
            setValue(c);
            onPick(c);
          }}
        />
      );
    }
    render(<Probe />);
    const hex = screen.getByRole('textbox', { name: 'Hex color' });
    fireEvent.change(hex, { target: { value: '#f4706d' } });
    fireEvent.keyDown(hex, { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith('#f4706d');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(JSON.parse(localStorage.getItem('wb:customColors') ?? '[]')).toEqual(['#f4706d']);
    const slot = screen.getByRole('button', { name: '#f4706d' });
    fireEvent.click(slot);
    expect(onPick).toHaveBeenCalledWith('#f4706d');
  });

  it('opens the picker popover from the rainbow button', () => {
    const onPick = vi.fn();
    render(<CustomColorButton value="#2563eb" onPick={onPick} />);
    expect(screen.queryByRole('dialog', { name: 'Custom color picker' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Custom color' }));
    const dialog = screen.getByRole('dialog', { name: 'Custom color picker' });
    expect(within(dialog).getByRole('slider', { name: 'Hue' })).not.toBeNull();
    expect(document.querySelector('input[type="color"]')).toBeNull();
  });
});
