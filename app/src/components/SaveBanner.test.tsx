import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SaveBanner } from './SaveBanner';

const stateMock = vi.hoisted(() => ({
  saveError: null as string | null,
  saving: false,
  retrySave: vi.fn(),
  clearSaveError: vi.fn(),
  lastSavedAt: null as string | null,
  conflict: null as { message: string } | null,
  resolveConflict: vi.fn(),
}));

vi.mock('../state/project-context', () => ({ useProject: () => stateMock }));

function resetState() {
  stateMock.saveError = null;
  stateMock.saving = false;
  stateMock.retrySave = vi.fn();
  stateMock.clearSaveError = vi.fn();
  stateMock.lastSavedAt = null;
  stateMock.conflict = null;
  stateMock.resolveConflict = vi.fn();
}

describe('SaveBanner layout (unified toast)', () => {
  it('error variant orders icon, body(text+actions), close last', () => {
    resetState();
    stateMock.saveError = 'boom';
    const { unmount } = render(<SaveBanner />);

    const banner = screen.getByTestId('save-banner');
    expect(banner.getAttribute('role')).toBe('alert');
    const tags = Array.from(banner.children).map((el) => el.tagName);
    expect(tags).toEqual(['svg', 'DIV', 'BUTTON']);

    const body = banner.querySelector('.save-toast-body');
    expect(body?.textContent).toContain('boom');
    expect(body?.querySelector('.save-toast-actions')).toBeTruthy();
    expect(banner.querySelector('.save-toast-close')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(stateMock.clearSaveError).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('conflict variant orders icon, body(text+actions)', () => {
    resetState();
    stateMock.conflict = { message: 'Remote changed' };
    const { unmount } = render(<SaveBanner />);

    const banner = screen.getByTestId('save-banner');
    const tags = Array.from(banner.children).map((el) => el.tagName);
    expect(tags).toEqual(['svg', 'DIV']);
    expect(banner.querySelector('.save-toast-actions')).toBeTruthy();
    unmount();
  });
});
