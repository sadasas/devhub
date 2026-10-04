import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ShellBanner } from './ShellBanner';

describe('ShellBanner (global top-of-layout banner)', () => {
  it('renders lead + message with warn tone and alert role', () => {
    render(<ShellBanner tone="warn" lead="3 days left" message="or locked" />);
    const bar = screen.getByTestId('shell-banner');
    expect(bar.getAttribute('role')).toBe('alert');
    expect(bar.className).toContain('sbanner-warn');
    expect(screen.getByText('3 days left')).toBeTruthy();
    expect(screen.getByText('or locked')).toBeTruthy();
  });

  it('maps tone to role + class for all tones', () => {
    const cases = [
      ['danger', 'alert'],
      ['warn', 'alert'],
      ['info', 'status'],
      ['success', 'status'],
    ] as const;
    for (const [tone, role] of cases) {
      const { unmount } = render(<ShellBanner tone={tone} lead={`${tone} lead`} />);
      const bar = screen.getByTestId('shell-banner');
      expect(bar.getAttribute('role')).toBe(role);
      expect(bar.className).toContain(`sbanner-${tone}`);
      unmount();
    }
  });

  it('renders dynamic ReactNode lead (countdown element)', () => {
    render(
      <ShellBanner
        lead={
          <>
            Verify email — <strong>3 days left</strong>
          </>
        }
      />,
    );
    expect(screen.getByText('3 days left').tagName).toBe('STRONG');
  });

  it('primary action calls onClick and honors busy/disabled', () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <ShellBanner lead="lead" primary={{ label: 'Resend', onClick }} />,
    );
    const btn = screen.getByRole('button', { name: 'Resend' });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<ShellBanner lead="lead" primary={{ label: 'Resend', onClick, busy: true }} />);
    expect(screen.getByRole('button', { name: 'Resend' }).hasAttribute('disabled')).toBe(true);
  });

  it('omits actions and message when not provided', () => {
    const { container } = render(<ShellBanner lead="only lead" />);
    expect(container.querySelector('.sbanner-actions')).toBeNull();
    expect(container.querySelector('.sbanner-message')).toBeNull();
  });

  it('supports a custom testId', () => {
    render(<ShellBanner lead="lead" testId="grace-banner" />);
    expect(screen.getByTestId('grace-banner')).toBeTruthy();
  });
});
