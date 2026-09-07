import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MonthPicker } from './MonthPicker';

function renderPicker(over: Partial<React.ComponentProps<typeof MonthPicker>> = {}) {
  const onPick = vi.fn();
  const onClose = vi.fn();
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  render(
    <MonthPicker
      id="mp-test"
      anchorEl={anchor}
      viewYear={2026}
      viewMonth={7}
      onPick={onPick}
      onClose={onClose}
      {...over}
    />,
  );
  return { onPick, onClose, anchor };
}

describe('MonthPicker', () => {
  it('renders 12 months with the viewed month selected', () => {
    renderPicker();
    const dialog = screen.getByRole('dialog', { name: /month and year|bulan dan tahun/i });
    expect(dialog).toBeTruthy();
    expect(dialog.querySelectorAll('[data-month]').length).toBe(12);
    const selected = dialog.querySelector('[data-month="7"]')!;
    expect(selected.getAttribute('aria-pressed')).toBe('true');
  });

  it('picks the clicked month with the shown year', () => {
    const { onPick } = renderPicker();
    fireEvent.click(screen.getByRole('button', { name: /Sep 2026/i }));
    expect(onPick).toHaveBeenCalledWith(2026, 8);
  });

  it('navigates years and rolls months over year boundaries', () => {
    const { onPick } = renderPicker();
    fireEvent.click(screen.getByRole('button', { name: /previous year|tahun sebelumnya/i }));
    expect(screen.getByText('2025')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Jan/i }));
    expect(onPick).toHaveBeenCalledWith(2025, 0);
  });

  it('closes on Escape', () => {
    const { onClose } = renderPicker();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
