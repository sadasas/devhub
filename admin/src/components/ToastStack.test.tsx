import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ToastStack, useToastStack } from './ToastStack';

function Harness({ timeout = 5000 }: { timeout?: number }) {
  const { toasts, pushToast, dismissToast } = useToastStack(timeout);
  return (
    <div>
      <button type="button" onClick={() => pushToast('Paket disimpan')}>
        push
      </button>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

describe('ToastStack', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stacks toasts with aria-live polite container + role=status items', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'push' }));
    fireEvent.click(screen.getByRole('button', { name: 'push' }));
    const stack = document.querySelector('.toast-stack');
    expect(stack?.getAttribute('aria-live')).toBe('polite');
    expect(screen.getAllByRole('status')).toHaveLength(2);
  });

  it('auto-dismisses after timeout without leaking timers', () => {
    render(<Harness timeout={5000} />);
    fireEvent.click(screen.getByRole('button', { name: 'push' }));
    expect(screen.getByRole('status')).toBeDefined();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('caps stacking at 3 and supports manual dismiss', () => {
    render(<Harness />);
    const btn = screen.getByRole('button', { name: 'push' });
    for (let i = 0; i < 5; i++) fireEvent.click(btn);
    expect(screen.getAllByRole('status')).toHaveLength(3);
    const closers = screen.getAllByRole('button', { name: 'Close' });
    expect(closers).toHaveLength(3);
    fireEvent.click(closers[0] as HTMLElement);
    expect(screen.getAllByRole('status')).toHaveLength(2);
  });
});
