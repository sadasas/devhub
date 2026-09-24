import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { HomeRedirect } from './HomeRedirect';

vi.mock('../../state/teams-context', () => ({
  useTeams: () => ({
    teams: [{ id: 'team-1', slug: 'acme', name: 'Acme' }],
    invitations: [],
  }),
}));

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{`${loc.pathname}${loc.search}`}</div>;
}

function renderAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/:slug/:tab" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('HomeRedirect query preservation', () => {
  it('forwards GitHub setup-return params to the team dashboard', async () => {
    renderAt('/?github=installed&installation_id=42&setup_action=install');
    const loc = await screen.findByTestId('loc');
    expect(loc.textContent).toContain('/acme/projects');
    expect(loc.textContent).toContain('github=installed');
    expect(loc.textContent).toContain('installation_id=42');
    expect(loc.textContent).toContain('setup_action=install');
  });

  it('drops unknown params but keeps list filters', async () => {
    renderAt('/?q=abc&sort=x&random=1');
    const loc = await screen.findByTestId('loc');
    expect(loc.textContent).toContain('q=abc');
    expect(loc.textContent).not.toContain('random=1');
    expect(loc.textContent).not.toContain('github=');
  });
});
