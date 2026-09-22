import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GCalSyncButton } from './GCalSyncButton';
import { GCalSyncedMark } from './GCalSyncedMark';
import type { GCalStatus } from '../../lib/api';

const { apiMock } = vi.hoisted(() => ({
  apiMock: { gcalStatus: vi.fn(), gcalSynced: vi.fn() },
}));

vi.mock('../../lib/api', () => ({ api: apiMock }));

let pid = 0;
function nextPid(): string {
  pid += 1;
  return `00000000-0000-4000-8000-${String(pid).padStart(12, '0')}`;
}

function status(over: Partial<GCalStatus> = {}): GCalStatus {
  return {
    connected: false,
    expired: false,
    email: null,
    syncEnabled: false,
    lastSyncAt: null,
    ...over,
  };
}

function renderButton(projectId: string, canEdit: boolean) {
  return render(
    <MemoryRouter>
      <GCalSyncButton projectId={projectId} canEdit={canEdit} />
    </MemoryRouter>,
  );
}

describe('GCalSyncButton (board toolbar, compact)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.gcalStatus.mockResolvedValue(status());
    apiMock.gcalSynced.mockResolvedValue({ taskIds: [] });
  });

  it('renders a settings link with connect label when disconnected (editor)', async () => {
    renderButton(nextPid(), true);
    const link = await screen.findByRole('link', { name: /Connect Google Calendar/ });
    expect(link.getAttribute('href')).toContain('section=integrations');
  });

  it('renders read-only status without a link for viewers', async () => {
    renderButton(nextPid(), false);
    await screen.findByRole('img', { name: /Connect Google Calendar/ });
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('shows synced time when connected with sync on', async () => {
    apiMock.gcalStatus.mockResolvedValue(
      status({
        connected: true,
        syncEnabled: true,
        email: 'me@gmail.com',
        lastSyncAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      }),
    );
    renderButton(nextPid(), true);
    await screen.findByRole('link', { name: /Synced .* me@test\.dev/ });
  });

  it('shows reconnect state when expired', async () => {
    apiMock.gcalStatus.mockResolvedValue(
      status({ connected: true, expired: true, syncEnabled: true, email: 'me@gmail.com' }),
    );
    renderButton(nextPid(), true);
    await screen.findByRole('link', { name: /expired.*reconnect/ });
  });

  it('renders nothing when the status request fails', async () => {
    apiMock.gcalStatus.mockRejectedValueOnce(new Error('offline'));
    const { container } = renderButton(nextPid(), true);
    await waitFor(() => expect(apiMock.gcalSynced).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });
});

describe('GCalSyncedMark (per-task marker)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.gcalStatus.mockResolvedValue(status({ connected: true, syncEnabled: true }));
  });

  it('renders the mark for synced tasks only', async () => {
    const projectId = nextPid();
    apiMock.gcalSynced.mockResolvedValue({ taskIds: ['task-1'] });
    const { rerender } = render(<GCalSyncedMark taskId="task-1" projectId={projectId} />);
    await waitFor(() => expect(document.querySelector('svg')).toBeTruthy());
    rerender(<GCalSyncedMark taskId="task-2" projectId={projectId} />);
    await waitFor(() => expect(apiMock.gcalSynced).toHaveBeenCalled());
    expect(document.querySelector('svg')).toBeNull();
  });
});
