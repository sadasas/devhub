import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { PresenceUser } from '../lib/realtime-client';
import { PresenceChip } from './PresenceChip';

const { useProjectMock, useAuthMock } = vi.hoisted(() => ({
  useProjectMock: vi.fn<() => { presence: PresenceUser[] }>(),
  useAuthMock: vi.fn<() => { user: { id: string } | null }>(),
}));

vi.mock('../state/project-context', () => ({
  useProject: () => useProjectMock(),
}));

vi.mock('../state/auth-context', () => ({
  useAuth: () => useAuthMock(),
}));

function renderChip(presence: PresenceUser[], userId: string | null = null) {
  useProjectMock.mockReturnValue({ presence });
  useAuthMock.mockReturnValue({ user: userId ? { id: userId } : null });
  return render(<PresenceChip />);
}

describe('PresenceChip', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the online count with an avatar stack and opens a dialog on click', () => {
    renderChip([
      { userId: 'u1', name: 'One' },
      { userId: 'u2', name: 'Two' },
    ]);
    const chip = screen.getByTestId('presence-chip');
    expect(chip.textContent).toContain('2 online');
    expect(chip.getAttribute('aria-haspopup')).toBe('dialog');
    expect(chip.getAttribute('aria-expanded')).toBe('false');
    expect(chip.getAttribute('aria-controls')).toBe('presence-listbox');
    expect(chip.querySelectorAll('.presence-avatar')).toHaveLength(2);
    expect(chip.querySelector('.presence-avatar')?.textContent).toBe('O');

    fireEvent.click(chip);
    const dialog = screen.getByRole('dialog', { name: 'Online users' });
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    expect(dialog.getAttribute('id')).toBe('presence-listbox');
    expect(dialog.querySelector('.presence-popover-header')?.textContent).toBe('Online · 2');
    expect(dialog.querySelectorAll('.presence-popover-row')).toHaveLength(2);
    expect(dialog.querySelectorAll('.presence-popover-name')[0]?.textContent).toBe('One');
    expect(dialog.querySelectorAll('.presence-popover-name')[1]?.textContent).toBe('Two');
  });

  it('caps the avatar stack at three and falls back unnamed users', () => {
    renderChip([
      { userId: 'u1', name: 'One' },
      { userId: 'u2', name: '' },
      { userId: 'u3', name: 'Three' },
      { userId: 'u4', name: 'Four' },
    ]);
    const chip = screen.getByTestId('presence-chip');
    expect(chip.querySelectorAll('.presence-avatar')).toHaveLength(3);
    fireEvent.click(chip);
    expect(
      Array.from(screen.getByRole('dialog').querySelectorAll('.presence-popover-name')).map(
        (n) => n.textContent,
      ),
    ).toEqual(['One', 'User', 'Three', 'Four']);
  });

  it('shows the current activity under the name', () => {
    renderChip([{ userId: 'u1', name: 'One', activity: 'Editing task' }]);
    fireEvent.click(screen.getByTestId('presence-chip'));
    expect(screen.getByText('Editing task')).toBeTruthy();
  });

  it('omits the status for users without activity', () => {
    renderChip([{ userId: 'u1', name: 'One' }]);
    fireEvent.click(screen.getByTestId('presence-chip'));
    expect(screen.queryByText('Editing task')).toBeNull();
    expect(screen.getByRole('dialog').querySelector('.presence-popover-name')?.textContent).toBe(
      'One',
    );
    expect(screen.getByRole('dialog').querySelector('.presence-status')).toBeNull();
  });

  it('marks the current user with (you) and puts it first', () => {
    renderChip(
      [
        { userId: 'u1', name: 'One' },
        { userId: 'u2', name: 'Two' },
      ],
      'u2',
    );
    fireEvent.click(screen.getByTestId('presence-chip'));
    const rows = screen.getByRole('dialog').querySelectorAll('.presence-popover-row');
    expect(rows[0]?.textContent).toContain('Two');
    expect(rows[0]?.textContent).toContain('(you)');
    expect(rows[1]?.textContent).toContain('One');
    expect(rows[1]?.textContent).not.toContain('(you)');
  });

  it('dedupes users by id across tabs', () => {
    renderChip([
      { userId: 'u1', name: 'One' },
      { userId: 'u1', name: 'One', activity: 'Editing task' },
      { userId: 'u2', name: 'Two' },
    ]);
    fireEvent.click(screen.getByTestId('presence-chip'));
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('.presence-popover-header')?.textContent).toBe('Online · 2');
    expect(dialog.querySelectorAll('.presence-popover-row')).toHaveLength(2);
  });

  it('closes on a second click', () => {
    renderChip([{ userId: 'u1', name: 'One' }]);
    const chip = screen.getByTestId('presence-chip');
    fireEvent.click(chip);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(chip);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(chip.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes on an outside click but not on a click inside the popover', () => {
    renderChip([
      { userId: 'u1', name: 'One' },
      { userId: 'u2', name: 'Two' },
    ]);
    fireEvent.click(screen.getByTestId('presence-chip'));
    fireEvent.click(screen.getByText('Two'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on Escape', () => {
    renderChip([{ userId: 'u1', name: 'One' }]);
    fireEvent.click(screen.getByTestId('presence-chip'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders nothing when nobody is online', () => {
    renderChip([]);
    expect(screen.queryByTestId('presence-chip')).toBeNull();
  });
});