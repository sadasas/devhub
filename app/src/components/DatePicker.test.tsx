import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DatePicker } from './DatePicker';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function todayParts(): { y: number; m: number; d: number } {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
}

function isoOfParts(y: number, m: number, day: number): string {
  return `${y}-${pad(m + 1)}-${pad(day)}`;
}

function renderPicker(props: Partial<Parameters<typeof DatePicker>[0]> = {}) {
  const onApply = vi.fn();
  const onClose = vi.fn();
  render(
    <DatePicker
      id="dp-test"
      mode="single"
      start={null}
      end={null}
      onApply={onApply}
      onClose={onClose}
      {...props}
    />,
  );
  return { onApply, onClose };
}

describe('DatePicker', () => {
  it('selects a day into pending without applying in single mode', () => {
    const { onApply } = renderPicker();
    const { y, m } = todayParts();
    fireEvent.click(screen.getByRole('button', { name: isoOfParts(y, m, 15) }));
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: isoOfParts(y, m, 15) }).getAttribute('aria-pressed')).toBe('true');
  });

  it('applies the pending day via the Apply button', () => {
    const { onApply } = renderPicker();
    const { y, m } = todayParts();
    fireEvent.click(screen.getByRole('button', { name: isoOfParts(y, m, 15) }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith(isoOfParts(y, m, 15), null);
  });

  it('fills pending from Today and commits via Apply', () => {
    const { onApply } = renderPicker();
    const { y, m, d } = todayParts();
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledWith(isoOfParts(y, m, d), null);
  });

  it('navigates months with the arrows', () => {
    renderPicker();
    const title = screen.getByText(/20\d\d/);
    const before = title.textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText(/20\d\d/).textContent).not.toBe(before);
  });

  it('closes without applying on Cancel', () => {
    const { onApply, onClose } = renderPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const { onClose } = renderPicker();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on outside pointer down', () => {
    const { onClose } = renderPicker();
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders two month panels in range mode', () => {
    renderPicker({ mode: 'range' });
    expect(screen.getAllByText(/20\d\d/)).toHaveLength(2);
  });

  it('applies a range on the second click', () => {
    const { onApply } = renderPicker({ mode: 'range' });
    const { y, m } = todayParts();
    fireEvent.click(screen.getByRole('button', { name: isoOfParts(y, m, 10) }));
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: isoOfParts(y, m, 20) }));
    expect(onApply).toHaveBeenCalledWith(isoOfParts(y, m, 10), isoOfParts(y, m, 20));
  });

  it('normalizes a backwards range pick', () => {
    const { onApply } = renderPicker({ mode: 'range' });
    const { y, m } = todayParts();
    fireEvent.click(screen.getByRole('button', { name: isoOfParts(y, m, 20) }));
    fireEvent.click(screen.getByRole('button', { name: isoOfParts(y, m, 10) }));
    expect(onApply).toHaveBeenCalledWith(isoOfParts(y, m, 10), isoOfParts(y, m, 20));
  });

  it('clears the pending start by re-clicking it', () => {
    const { onApply } = renderPicker({ mode: 'range' });
    const { y, m } = todayParts();
    fireEvent.click(screen.getByRole('button', { name: isoOfParts(y, m, 10) }));
    fireEvent.click(screen.getByRole('button', { name: isoOfParts(y, m, 10) }));
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: isoOfParts(y, m, 10) }).getAttribute('aria-pressed')).toBe('false');
  });
});
