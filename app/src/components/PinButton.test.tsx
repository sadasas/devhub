import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PinButton } from './PinButton';

describe('PinButton', () => {
  it('renders with aria-pressed false when unpinned', () => {
    render(<PinButton pinned={false} label="task" onToggle={() => {}} />);
    const btn = screen.getByRole('button', { name: 'Pin task' });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('renders with aria-pressed true when pinned', () => {
    render(<PinButton pinned label="issue" onToggle={() => {}} />);
    const btn = screen.getByRole('button', { name: 'Unpin issue' });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('toggles on click and stops propagation', () => {
    const onToggle = vi.fn();
    const onParent = vi.fn();
    render(
      <div onClick={onParent}>
        <PinButton pinned={false} label="task" onToggle={onToggle} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pin task' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onParent).not.toHaveBeenCalled();
  });
});