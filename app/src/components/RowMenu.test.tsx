import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RowMenu } from './RowMenu';

function renderMenu() {
  const onPin = vi.fn();
  const onDelete = vi.fn();
  render(
    <RowMenu
      triggerLabel="More actions for X"
      menuLabel="More actions for X"
      menuId="rowmenu-test"
      actions={[
        { key: 'pin', label: 'Pin test case', icon: <span aria-hidden="true" />, onSelect: onPin },
        { key: 'delete', label: 'Delete', icon: <span aria-hidden="true" />, danger: true, onSelect: onDelete },
      ]}
    />,
  );
  return { onPin, onDelete };
}

describe('RowMenu', () => {
  it('opens on trigger click, runs action and closes', () => {
    const { onPin, onDelete } = renderMenu();
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More actions for X' }));
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Pin test case' }));
    expect(onPin).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('toggles closed on second trigger click', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'More actions for X' });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.click(trigger);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on Escape and on outside pointerdown', () => {    renderMenu();
    const trigger = screen.getByRole('button', { name: 'More actions for X' });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('does not bubble item clicks to a clickable parent (portal card)', () => {
    const onParent = vi.fn();
    const onDelete = vi.fn();
    render(
      <div onClick={onParent}>
        <RowMenu
          triggerLabel="More actions for X"
          menuLabel="More actions for X"
          menuId="rowmenu-bubble"
          actions={[{ key: 'delete', label: 'Delete', icon: <span aria-hidden="true" />, danger: true, onSelect: onDelete }]}
        />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More actions for X' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onParent).not.toHaveBeenCalled();
  });
});
