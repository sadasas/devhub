import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GCalSettings } from './GCalSettings';

const apiMock = vi.hoisted(() => {
  class ApiError extends Error {
    readonly status: number;
    readonly code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  return {
    gcalStatus: vi.fn(),
    gcalSetSync: vi.fn(),
    gcalDisconnect: vi.fn(),
    gcalConnectUrl: vi.fn((id: string) => `/api/v1/integrations/gcal/connect?projectId=${id}`),
    ApiError,
  };
});

vi.mock('../../lib/api', () => ({
  api: apiMock,
  ApiError: apiMock.ApiError,
}));

function connectedStatus(over: Record<string, unknown> = {}) {
  return {
    connected: true,
    expired: false,
    email: 'user@example.com',
    syncEnabled: true,
    lastSyncAt: '2026-09-16T10:00:00.000Z',
    ...over,
  };
}

function renderSettings(canEdit = true) {
  return render(<GCalSettings projectId="p1" canEdit={canEdit} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'location', {
    value: { ...window.location, href: 'http://localhost/', assign: vi.fn() },
    writable: true,
    configurable: true,
  });
});

function setMockLocation(href: string) {
  Object.defineProperty(window, 'location', {
    value: { href, assign: vi.fn() },
    writable: true,
    configurable: true,
  });
}

describe('GCalSettings (T4)', () => {
  it('hides the panel for viewers (canEdit gate)', () => {
    const { container } = renderSettings(false);
    expect(container.firstChild).toBeNull();
    expect(apiMock.gcalStatus).not.toHaveBeenCalled();
  });

  it('toggles sync_enabled via PATCH and updates the badge', async () => {
    apiMock.gcalStatus.mockResolvedValue(connectedStatus({ syncEnabled: true }));
    apiMock.gcalSetSync.mockResolvedValue({ id: 'p1' });

    renderSettings();

    const toggle = await screen.findByRole('checkbox', { name: 'Calendar sync' });
    expect((toggle as HTMLInputElement).checked).toBe(true);
    expect((await screen.findAllByText('Sync on')).length).toBeGreaterThan(0);

    fireEvent.click(toggle);

    await waitFor(() => expect(apiMock.gcalSetSync).toHaveBeenCalledWith('p1', false));
    expect((await screen.findAllByText('Sync off')).length).toBeGreaterThan(0);
  });

  it('shows busy state on the toggle while saving', async () => {
    apiMock.gcalStatus.mockResolvedValue(connectedStatus({ syncEnabled: true }));
    let resolveToggle!: (v: unknown) => void;
    apiMock.gcalSetSync.mockImplementationOnce(
      () => new Promise((resolve) => { resolveToggle = resolve; }),
    );

    renderSettings();
    const toggle = await screen.findByRole('checkbox', { name: 'Calendar sync' });
    fireEvent.click(toggle);

    expect(await screen.findByText('Saving…')).toBeTruthy();
    expect(toggle.getAttribute('aria-busy')).toBe('true');
    expect(toggle).toHaveProperty('disabled', true);

    resolveToggle({ syncEnabled: false });
    await waitFor(() => expect(toggle.getAttribute('aria-busy')).toBeNull());
    expect(await screen.findAllByText('Sync off')).toBeTruthy();
  });

  it('shows a toast when toggle fails', async () => {
    apiMock.gcalStatus.mockResolvedValue(connectedStatus({ syncEnabled: true }));
    apiMock.gcalSetSync.mockRejectedValue(new Error('offline'));

    renderSettings();

    const toggle = await screen.findByRole('checkbox', { name: 'Calendar sync' });
    fireEvent.click(toggle);

    expect(await screen.findByTestId('gcal-toast')).not.toBeNull();
    expect(await screen.findByText('Failed to update sync setting.')).not.toBeNull();
  });

  it('disconnects through ConfirmDeleteDialog', async () => {
    apiMock.gcalStatus.mockResolvedValue(connectedStatus());
    apiMock.gcalDisconnect.mockResolvedValue({ ok: true });

    renderSettings();
    await screen.findByRole('checkbox', { name: 'Calendar sync' });

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Disconnect Google Calendar?')).not.toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Disconnect' }));

    await waitFor(() => expect(apiMock.gcalDisconnect).toHaveBeenCalledWith('p1'));
    expect((await screen.findAllByText('Not connected')).length).toBeGreaterThan(0);
  });

  it('keeps the connection when disconnect is cancelled (Esc/close)', async () => {
    apiMock.gcalStatus.mockResolvedValue(connectedStatus());

    renderSettings();
    await screen.findByRole('checkbox', { name: 'Calendar sync' });

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(await screen.findByText('Disconnect Google Calendar?')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(apiMock.gcalDisconnect).not.toHaveBeenCalled();
    expect(screen.getByText('user@example.com')).not.toBeNull();
  });

  it('shows the reconnect banner when expired and hides it after disconnect', async () => {
    apiMock.gcalStatus.mockResolvedValue(connectedStatus({ expired: true, syncEnabled: true }));
    apiMock.gcalDisconnect.mockResolvedValue({ ok: true });

    renderSettings();

    const banner = await screen.findByTestId('gcal-banner');
    expect(banner.getAttribute('role')).toBe('alert');
    expect(within(banner).getByRole('button', { name: 'Reconnect' })).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Disconnect' }));

    await waitFor(() => expect(screen.queryByTestId('gcal-banner')).toBeNull());
  });

  it('hides the banner when the connection is healthy', async () => {
    apiMock.gcalStatus.mockResolvedValue(connectedStatus({ expired: false }));

    renderSettings();
    await screen.findByRole('checkbox', { name: 'Calendar sync' });

    expect(screen.queryByTestId('gcal-banner')).toBeNull();
  });

  it('shows DataErrorState with retry when status fails to load', async () => {
    apiMock.gcalStatus.mockRejectedValueOnce(new Error('boom'));
    apiMock.gcalStatus.mockResolvedValueOnce(connectedStatus());

    renderSettings();

    expect(await screen.findByText('Failed to load data')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(apiMock.gcalStatus).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('checkbox', { name: 'Calendar sync' })).not.toBeNull();
  });

  it('shows a success flash for ?gcal=connected and strips the query', async () => {
    apiMock.gcalStatus.mockResolvedValue(connectedStatus());
    setMockLocation('http://localhost/?gcal=connected');
    const replaceSpy = vi.spyOn(window.history, 'replaceState');

    renderSettings();
    await screen.findByRole('checkbox', { name: 'Calendar sync' });

    const flash = await screen.findByTestId('gcal-flash');
    expect(flash.getAttribute('role')).toBe('status');
    expect(within(flash).getByText('Google Calendar connected.')).not.toBeNull();
    expect(replaceSpy).toHaveBeenCalled();
    expect(String(replaceSpy.mock.calls[0]?.[2] ?? '')).not.toContain('gcal=');

    replaceSpy.mockRestore();
    setMockLocation('http://localhost/');
  });

  it('shows an error flash for ?gcal_error=INVALID_STATE and strips the query', async () => {
    apiMock.gcalStatus.mockResolvedValue(connectedStatus({ connected: false }));
    setMockLocation('http://localhost/?gcal_error=INVALID_STATE');
    const replaceSpy = vi.spyOn(window.history, 'replaceState');

    renderSettings();
    await screen.findByText('Connection attempt expired. Please try Connect again.');

    const flash = await screen.findByTestId('gcal-flash');
    expect(flash.getAttribute('role')).toBe('alert');
    expect(String(replaceSpy.mock.calls[0]?.[2] ?? '')).not.toContain('gcal_error');

    replaceSpy.mockRestore();
    setMockLocation('http://localhost/');
  });
});
