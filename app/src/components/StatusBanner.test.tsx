import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StatusBanner } from './StatusBanner';

describe('StatusBanner (unified section banner)', () => {
  it.each([
    { tone: 'danger', role: 'alert' },
    { tone: 'warn', role: 'alert' },
    { tone: 'success', role: 'status' },
    { tone: 'info', role: 'status' },
  ] as const)('tone $tone memakai role $role + kelas status', ({ tone, role }) => {
    const { unmount } = render(<StatusBanner tone={tone} message={`${tone} message`} />);
    const banner = screen.getByTestId('status-banner');
    expect(banner.getAttribute('role')).toBe(role);
    expect(banner.querySelector('.save-toast-body')?.textContent).toContain(`${tone} message`);
    unmount();
  });

  it('tanpa title: urutan ikon, body, tutup (konvensi SaveBanner)', () => {
    const { unmount } = render(
      <StatusBanner tone="danger" message="boom" onDismiss={() => {}} />,
    );
    const banner = screen.getByTestId('status-banner');
    const tags = Array.from(banner.children).map((el) => el.tagName);
    expect(tags).toEqual(['svg', 'DIV', 'BUTTON']);
    unmount();
  });

  it('dengan title: badge nada + body + tutup (konvensi flash GCal/GitHub)', () => {
    const { unmount } = render(
      <StatusBanner tone="success" title="Connected" message="ok" onDismiss={() => {}} />,
    );
    const banner = screen.getByTestId('status-banner');
    const tags = Array.from(banner.children).map((el) => el.tagName);
    expect(tags).toEqual(['SPAN', 'DIV', 'BUTTON']);
    expect(banner.textContent).toContain('Connected');
    unmount();
  });

  it('retry + dismiss memanggil handler', () => {
    const onRetry = vi.fn();
    const onDismiss = vi.fn();
    const { unmount } = render(
      <StatusBanner
        tone="danger"
        message="boom"
        onRetry={onRetry}
        retryLabel="Try again"
        onDismiss={onDismiss}
        dismissLabel="Dismiss"
        testId="gcal-toast"
      />,
    );
    expect(screen.getByTestId('gcal-toast')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('tanpa aksi: tidak ada baris tombol', () => {
    const { unmount } = render(<StatusBanner tone="info" message="hint" />);
    const banner = screen.getByTestId('status-banner');
    expect(banner.querySelector('.save-toast-actions')).toBeNull();
    expect(banner.querySelector('.save-toast-close')).toBeNull();
    unmount();
  });
});
