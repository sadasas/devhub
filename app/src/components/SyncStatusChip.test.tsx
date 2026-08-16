import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { SyncStatusChip } from './SyncStatusChip';

const { useProjectMock } = vi.hoisted(() => ({ useProjectMock: vi.fn() }));

vi.mock('../state/project-context', () => ({
  useProject: () => useProjectMock(),
}));

describe('SyncStatusChip', () => {
  it('renders an offline badge with the pending count', () => {
    useProjectMock.mockReturnValue({ isOffline: true, pendingCount: 2 });
    const { container } = render(<SyncStatusChip />);
    const badge = container.querySelector('.badge');
    expect(badge?.textContent).toBe('Offline · 2 pending');
    expect(badge?.classList.contains('badge-danger')).toBe(true);
  });

  it('renders a plain offline badge without a count', () => {
    useProjectMock.mockReturnValue({ isOffline: true, pendingCount: 0 });
    const { container } = render(<SyncStatusChip />);
    expect(container.querySelector('.badge')?.textContent).toBe('Offline');
  });

  it('renders a pending badge while online', () => {
    useProjectMock.mockReturnValue({ isOffline: false, pendingCount: 3 });
    const { container } = render(<SyncStatusChip />);
    const badge = container.querySelector('.badge');
    expect(badge?.textContent).toBe('Pending 3');
    expect(badge?.classList.contains('badge-warn')).toBe(true);
  });

  it('renders nothing when online and clean', () => {
    useProjectMock.mockReturnValue({ isOffline: false, pendingCount: 0 });
    const { container } = render(<SyncStatusChip />);
    expect(container.childElementCount).toBe(0);
  });
});