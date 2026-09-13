import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Drawer } from './Drawer';

describe('Drawer', () => {
  it('renders right slide-over dialog with aria-modal + labelled title', () => {
    render(
      <Drawer
        open
        title="Edit package"
        onClose={() => {}}
        footer={<button type="button">Save</button>}
      >
        <p>Body</p>
      </Drawer>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Edit package' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.className).toMatch(/drawer/);
    expect(document.querySelector('.drawer-backdrop')).not.toBeNull();
    expect(screen.getByText('Body')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDefined();
  });

  it('returns null when closed', () => {
    const { container } = render(
      <Drawer open={false} title="x" onClose={() => {}}>
        y
      </Drawer>,
    );
    expect(container.firstChild).toBeNull();
    expect(document.querySelector('.drawer-backdrop')).toBeNull();
  });

  it('closes on Escape, X button and backdrop click', () => {
    const onClose = vi.fn();
    render(
      <Drawer open title="Edit" onClose={onClose}>
        <button type="button">Inner</button>
      </Drawer>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.mouseDown(document.querySelector('.drawer-backdrop')!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('focuses the close button on open and restores focus on close', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'trigger';
    document.body.appendChild(trigger);
    trigger.focus();
    const { rerender } = render(
      <Drawer open title="Edit" onClose={() => {}}>
        <button type="button">Inner</button>
      </Drawer>,
    );
    // focus-trap: fokus pertama di dalam drawer (tombol tutup header)
    expect(document.querySelector('.drawer')?.contains(document.activeElement)).toBe(true);
    rerender(
      <Drawer open={false} title="Edit" onClose={() => {}}>
        x
      </Drawer>,
    );
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
