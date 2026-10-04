import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { IntegrationAnnounceSheet } from './IntegrationAnnounceSheet';
import { ANNOUNCE_INTEGRATIONS_KEY } from '../lib/announce';
import { setTourActiveFlag } from '../features/onboarding/tour-events';

function renderSheet(projectId: string | null = 'p1') {
  return render(
    <MemoryRouter>
      <IntegrationAnnounceSheet projectId={projectId} />
    </MemoryRouter>,
  );
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  try {
    localStorage.removeItem(ANNOUNCE_INTEGRATIONS_KEY);
  } catch {
    /* ignore */
  }
  setTourActiveFlag(false);
  document.body.style.overflow = '';
});

afterEach(() => {
  vi.useRealTimers();
  setTourActiveFlag(false);
  document.body.style.overflow = '';
});

describe('IntegrationAnnounceSheet', () => {
  it('shows after ~1s with CTA to the project integrations section', () => {
    renderSheet('p1');
    expect(screen.queryByTestId('announce-integrations')).toBeNull();
    advance(1000);
    expect(screen.getByTestId('announce-integrations')).toBeTruthy();
    expect(screen.getByLabelText('tour-api')).toBeTruthy();
    const cta = screen.getByRole('link', { name: 'Open Integrations' });
    expect(cta.getAttribute('href')).toBe('/project/p1?tab=settings&section=integrations');
  });

  it('stays hidden when the dismiss key is already written', () => {
    try {
      localStorage.setItem(ANNOUNCE_INTEGRATIONS_KEY, '1');
    } catch {
      /* ignore */
    }
    renderSheet('p1');
    advance(5000);
    expect(screen.queryByTestId('announce-integrations')).toBeNull();
  });

  it('renders nothing without a projectId (dashboard tanpa project)', () => {
    renderSheet(null);
    advance(5000);
    expect(screen.queryByTestId('announce-integrations')).toBeNull();
  });

  it('"Later" dismisses and writes the key', () => {
    renderSheet('p1');
    advance(1000);
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.queryByTestId('announce-integrations')).toBeNull();
    expect(localStorage.getItem(ANNOUNCE_INTEGRATIONS_KEY)).toBe('1');
  });

  it('ESC dismisses and writes the key', () => {
    renderSheet('p1');
    advance(1000);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('announce-integrations')).toBeNull();
    expect(localStorage.getItem(ANNOUNCE_INTEGRATIONS_KEY)).toBe('1');
  });

  it('backdrop click dismisses, sheet click does not', () => {
    renderSheet('p1');
    advance(1000);
    const backdrop = screen.getByTestId('announce-integrations');
    fireEvent.click(screen.getByText('Connect Google and GitHub'));
    expect(screen.getByTestId('announce-integrations')).toBeTruthy();
    fireEvent.click(backdrop);
    expect(screen.queryByTestId('announce-integrations')).toBeNull();
  });

  it('CTA click dismisses (tidak muncul lagi)', () => {
    renderSheet('p1');
    advance(1000);
    fireEvent.click(screen.getByRole('link', { name: 'Open Integrations' }));
    expect(screen.queryByTestId('announce-integrations')).toBeNull();
    expect(localStorage.getItem(ANNOUNCE_INTEGRATIONS_KEY)).toBe('1');
  });

  it('suppressed while the tour is active, shows after the tour ends', () => {
    setTourActiveFlag(true);
    renderSheet('p1');
    advance(5000);
    expect(screen.queryByTestId('announce-integrations')).toBeNull();
    act(() => {
      setTourActiveFlag(false);
    });
    advance(1000);
    expect(screen.getByTestId('announce-integrations')).toBeTruthy();
  });

  it('suppressed while a modal scroll-locks the body', () => {
    document.body.style.overflow = 'hidden';
    renderSheet('p1');
    advance(5000);
    expect(screen.queryByTestId('announce-integrations')).toBeNull();
    document.body.style.overflow = '';
    advance(1000);
    expect(screen.getByTestId('announce-integrations')).toBeTruthy();
  });
});
