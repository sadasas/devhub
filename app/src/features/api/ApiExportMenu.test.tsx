import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ApiExportMenu } from './ApiExportMenu';

function renderMenu() {
  const onExportOpenApi = vi.fn();
  const onExportPdf = vi.fn();
  render(<ApiExportMenu onExportOpenApi={onExportOpenApi} onExportPdf={onExportPdf} />);
  return { onExportOpenApi, onExportPdf };
}

describe('ApiExportMenu', () => {
  it('renders an Export trigger with menu semantics', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'Export' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('menu')).not.toBeTruthy();
  });

  it('opens the menu and calls back on choose, then closes', () => {
    const { onExportOpenApi, onExportPdf } = renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.getByRole('menu')).toBeTruthy();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Export OpenAPI' }));
    expect(onExportOpenApi).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export PDF' }));
    expect(onExportPdf).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeTruthy();
  });

  it('closes on Escape and returns focus to the trigger', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: 'Export' });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeTruthy();
    expect(document.activeElement).toBe(trigger);
  });
});