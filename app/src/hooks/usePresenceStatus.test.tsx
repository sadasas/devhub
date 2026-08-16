import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { usePresenceStatus, viewingStatus } from './usePresenceStatus';

const { setStatusMock } = vi.hoisted(() => ({ setStatusMock: vi.fn() }));

vi.mock('../state/project-context', () => ({
  useProject: () => ({ setStatus: setStatusMock }),
}));

function Probe({ active, open = true }: { active: string | null; open?: boolean }) {
  usePresenceStatus(active, open);
  return null;
}

function renderProbe(active: string | null, open = true, initial = '/') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Probe active={active} open={open} />
    </MemoryRouter>,
  );
}

describe('usePresenceStatus', () => {
  beforeEach(() => {
    setStatusMock.mockClear();
  });

  it('builds the viewing status label for a tab', () => {
    expect(viewingStatus('board')).toBe('Viewing Board');
    expect(viewingStatus('api')).toBe('Viewing API');
  });

  it('sends the active status while open', () => {
    renderProbe('Editing task');
    expect(setStatusMock).toHaveBeenCalledWith('Editing task');
  });

  it('restores the board status on unmount', () => {
    const { unmount } = renderProbe('Editing task');
    unmount();
    expect(setStatusMock).toHaveBeenLastCalledWith('Viewing Board');
  });

  it('restores the current tab status on unmount', () => {
    const { unmount } = renderProbe('Editing task', true, '/?tab=schema');
    unmount();
    expect(setStatusMock).toHaveBeenLastCalledWith('Viewing Schema');
  });

  it('does not announce anything while closed', () => {
    renderProbe('Creating task', false);
    expect(setStatusMock).not.toHaveBeenCalled();
  });

  it('re-announces when the active status changes', () => {
    const { rerender } = renderProbe('Editing task');
    rerender(
      <MemoryRouter initialEntries={['/']}>
        <Probe active="Deleting task" />
      </MemoryRouter>,
    );
    expect(setStatusMock).toHaveBeenLastCalledWith('Deleting task');
  });
});