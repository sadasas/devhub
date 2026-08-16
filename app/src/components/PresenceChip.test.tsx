import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { PresenceUser } from '../lib/realtime-client';
import { PresenceChip } from './PresenceChip';

const { useProjectMock } = vi.hoisted(() => ({
  useProjectMock: vi.fn<() => { presence: PresenceUser[] }>(),
}));

vi.mock('../state/project-context', () => ({
  useProject: () => useProjectMock(),
}));

function renderChip(presence: PresenceUser[]) {
  useProjectMock.mockReturnValue({ presence });
  return render(<PresenceChip />);
}

describe('PresenceChip', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the online count and opens a listbox with user names on click', () => {
    renderChip([
      { userId: 'u1', name: 'One' },
      { userId: 'u2', name: 'Two' },
    ]);
    const chip = screen.getByTestId('presence-chip');
    expect(chip.textContent).toContain('2 online');
    expect(chip.getAttribute('aria-haspopup')).toBe('listbox');
    expect(chip.getAttribute('aria-expanded')).toBe('false');
    expect(chip.getAttribute('aria-controls')).toBe('presence-listbox');

    fireEvent.click(chip);
    const listbox = screen.getByRole('listbox', { name: 'Online users' });
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    expect(listbox.getAttribute('id')).toBe('presence-listbox');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['One', 'Two']);
  });

  it('dedupes and falls back unnamed users in the list', () => {
    renderChip([
      { userId: 'u1', name: 'One' },
      { userId: 'u2', name: '' },
      { userId: 'u3', name: 'One' },
    ]);
    const chip = screen.getByTestId('presence-chip');
    expect(chip.textContent).toContain('3 online');
    fireEvent.click(chip);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['One', 'User']);
  });

  it('closes on a second click', () => {
    renderChip([{ userId: 'u1', name: 'One' }]);
    const chip = screen.getByTestId('presence-chip');
    fireEvent.click(chip);
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.click(chip);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(chip.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes on an outside click but not on a click inside the popover', () => {
    renderChip([
      { userId: 'u1', name: 'One' },
      { userId: 'u2', name: 'Two' },
    ]);
    fireEvent.click(screen.getByTestId('presence-chip'));
    fireEvent.click(screen.getAllByRole('option')[0]!);
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes on Escape', () => {
    renderChip([{ userId: 'u1', name: 'One' }]);
    fireEvent.click(screen.getByTestId('presence-chip'));
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('renders nothing when nobody is online', () => {
    renderChip([]);
    expect(screen.queryByTestId('presence-chip')).toBeNull();
  });
});