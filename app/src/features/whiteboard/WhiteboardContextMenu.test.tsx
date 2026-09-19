import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WhiteboardContextMenu, type CtxMenuItem } from './WhiteboardContextMenu';

function items(run: (id: string) => void = () => {}): CtxMenuItem[][] {
  return [
    [
      { id: 'copy', label: 'Copy', shortcut: 'Ctrl+C', run: () => run('copy') },
      { id: 'paste', label: 'Paste', shortcut: 'Ctrl+V', disabled: true, run: () => run('paste') },
    ],
    [{ id: 'delete', label: 'Delete selected', shortcut: 'Del', danger: true, run: () => run('delete') }],
  ];
}

describe('whiteboard context menu', () => {
  it('renders grouped items with shortcut hints and runs actions', () => {
    const run = vi.fn();
    const onClose = vi.fn();
    render(<WhiteboardContextMenu x={100} y={100} sections={items(run)} onClose={onClose} />);
    expect(screen.getByRole('menu', { name: 'Object actions' })).not.toBeNull();
    expect(document.querySelectorAll('.wb-ctxsep')).toHaveLength(1);
    expect(screen.getByRole('menuitem', { name: 'Copy Ctrl+C' })).not.toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy Ctrl+C' }));
    expect(run).toHaveBeenCalledWith('copy');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps disabled items focusable-but-inert and closes on Escape', () => {
    const onClose = vi.fn();
    render(<WhiteboardContextMenu x={10} y={10} sections={items()} onClose={onClose} />);
    expect(screen.getByRole('menuitem', { name: 'Paste Ctrl+V' }).hasAttribute('disabled')).toBe(true);
    fireEvent.keyDown(screen.getByRole('menu', { name: 'Object actions' }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on outside pointer down but not on inside clicks', () => {
    const onClose = vi.fn();
    render(
      <div>
        <button type="button">outside</button>
        <WhiteboardContextMenu x={10} y={10} sections={items()} onClose={onClose} />
      </div>,
    );
    fireEvent.pointerDown(screen.getByRole('button', { name: 'outside' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
