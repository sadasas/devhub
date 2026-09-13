import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RowMenu } from './RowMenu';

function renderMenu() {
  const onEdit = vi.fn();
  const onArchive = vi.fn();
  const onDelete = vi.fn();
  render(
    <RowMenu
      label="Row actions"
      items={[
        { key: 'edit', label: 'Edit', onSelect: onEdit },
        { key: 'archive', label: 'Archive', disabled: true, onSelect: onArchive },
        { key: 'delete', label: 'Delete', danger: true, onSelect: onDelete },
      ]}
    />,
  );
  return { onEdit, onArchive, onDelete };
}

describe('RowMenu', () => {
  it('opens on trigger, focuses first enabled item, activates + closes on select', () => {
    const { onEdit } = renderMenu();
    const trigger = screen.getByRole('button', { name: 'Row actions' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('menu', { name: 'Row actions' })).toBeDefined();
    expect(document.activeElement?.textContent).toBe('Edit');

    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('navigates with ArrowDown/ArrowUp/Home/End skipping disabled, Esc refocuses trigger', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'Row actions' });
    fireEvent.click(trigger);
    const menu = screen.getByRole('menu', { name: 'Row actions' });

    // Archive disabled → ArrowDown dari Edit langsung ke Delete
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent).toBe('Delete');
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement?.textContent).toBe('Edit');
    fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement?.textContent).toBe('Delete');
    fireEvent.keyDown(menu, { key: 'Home' });
    expect(document.activeElement?.textContent).toBe('Edit');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
