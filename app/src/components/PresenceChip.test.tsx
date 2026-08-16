import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('renders the online count with names in the tooltip', () => {
    renderChip([
      { userId: 'u1', name: 'One' },
      { userId: 'u2', name: 'Two' },
    ]);
    const chip = screen.getByTestId('presence-chip');
    expect(chip.textContent).toContain('2 online');
    expect(chip.title).toBe('One, Two');
  });

  it('dedupes and falls back unnamed users', () => {
    renderChip([
      { userId: 'u1', name: 'One' },
      { userId: 'u2', name: '' },
      { userId: 'u3', name: 'One' },
    ]);
    const chip = screen.getByTestId('presence-chip');
    expect(chip.textContent).toContain('3 online');
    expect(chip.title).toBe('One, User');
  });

  it('renders nothing when nobody is online', () => {
    renderChip([]);
    expect(screen.queryByTestId('presence-chip')).toBeNull();
  });
});