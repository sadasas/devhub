import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { api } from '../../lib/api';
import type { ProjectTemplate, Team } from '../../lib/types';
import { TemplatesPage } from './TemplatesPage';

vi.mock('../../state/teams-context', () => ({
  useTeams: () => ({ teams: TEAMS }),
}));

const TEAM_ID = '22222222-2222-4222-8222-222222222222';
const TEAM_B_ID = '55555555-5555-4555-8555-555555555555';

const TEAMS: Team[] = [
  {
    id: TEAM_ID,
    name: 'Team A',
    slug: 'team-a',
    role: 'admin',
    plan: 'free',
    planPackageName: 'Free',
    memberCount: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: TEAM_B_ID,
    name: 'Team B',
    slug: 'team-b',
    role: 'editor',
    plan: 'free',
    planPackageName: 'Free',
    memberCount: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

// Owner-only shape: no teamId/teamName, only ownerId.
function makeTemplate(over: Partial<ProjectTemplate> = {}): ProjectTemplate {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    ownerId: '11111111-1111-4111-8111-111111111111',
    name: 'Sprint template',
    description: 'Board with standard columns',
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...over,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TemplatesPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TemplatesPage (owner-only)', () => {
  it('shows an empty state when there are no templates', async () => {
    vi.spyOn(api, 'listTemplates').mockResolvedValue([]);

    renderPage();
    expect(await screen.findByText('No templates yet')).toBeDefined();
  });

  it('lists own templates with description and created date (no team column)', async () => {
    vi.spyOn(api, 'listTemplates').mockResolvedValue([makeTemplate()]);

    renderPage();
    expect(await screen.findByText('Sprint template')).toBeDefined();
    expect(screen.getByText('Board with standard columns')).toBeDefined();
    // Owner-only rows never leak a team name.
    expect(screen.queryByText('Team A')).toBeNull();
  });

  it('offers Use template and Delete on every row (no admin gate)', async () => {
    vi.spyOn(api, 'listTemplates').mockResolvedValue([makeTemplate()]);

    renderPage();
    await screen.findByText('Sprint template');
    expect(screen.getAllByRole('button', { name: 'Use template' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Delete/ })).toBeDefined();
  });

  it('deletes a template after confirmation', async () => {
    const template = makeTemplate();
    vi.spyOn(api, 'listTemplates').mockResolvedValue([template]);
    const del = vi.spyOn(api, 'deleteTemplate').mockResolvedValue({ ok: true });

    renderPage();
    await screen.findByText('Sprint template');
    fireEvent.click(screen.getByRole('button', { name: /Delete: Sprint template/ }));
    // ConfirmDeleteDialog standar: satu klik konfirmasi (bukan 2-langkah).
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => expect(del).toHaveBeenCalledWith(template.id));
    expect(await screen.findByText('No templates yet')).toBeDefined();
  });

  it('opens the instantiate modal with a target workspace dropdown defaulting to the active team', async () => {
    const template = makeTemplate();
    vi.spyOn(api, 'listTemplates').mockResolvedValue([template]);
    const inst = vi
      .spyOn(api, 'instantiateTemplate')
      .mockResolvedValue({ projectId: '44444444-4444-4444-8444-444444444444' });

    renderPage();
    await screen.findByText('Sprint template');
    fireEvent.click(screen.getByRole('button', { name: 'Use template' }));

    const nameInput = await screen.findByLabelText(/Project name/);
    expect(nameInput).toBeDefined();
    expect((nameInput as HTMLInputElement).value).toBe('Sprint template');

    // Target workspace dropdown is visible and defaults to the first team.
    const teamTrigger = await screen.findByRole('button', { name: /Target workspace|Team A/ });
    expect(teamTrigger.textContent).toContain('Team A');

    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    await waitFor(() =>
      expect(inst).toHaveBeenCalledWith(template.id, TEAM_ID, 'Sprint template'),
    );
  });
});

describe('TemplatesPage narrow (≤640px)', () => {
  const realMatchMedia = window.matchMedia;
  beforeEach(() => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('640px'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    window.matchMedia = realMatchMedia;
    vi.restoreAllMocks();
  });

  it('replaces inline actions with a kebab popup menu', async () => {
    vi.spyOn(api, 'listTemplates').mockResolvedValue([makeTemplate()]);

    renderPage();
    await screen.findByText('Sprint template');
    expect(screen.getAllByRole('button', { name: /More actions for/ })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Use template' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete: Sprint template/ })).toBeNull();
  });

  it('kebab menu runs Use and Delete actions', async () => {
    const template = makeTemplate();
    vi.spyOn(api, 'listTemplates').mockResolvedValue([template]);

    renderPage();
    await screen.findByText('Sprint template');
    fireEvent.click(screen.getByRole('button', { name: /More actions for/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Use template' }));
    expect(await screen.findByLabelText(/Project name/)).toBeDefined();
  });

  it('kebab Delete opens confirm dialog and deletes', async () => {
    const template = makeTemplate();
    vi.spyOn(api, 'listTemplates').mockResolvedValue([template]);
    const del = vi.spyOn(api, 'deleteTemplate').mockResolvedValue({ ok: true });

    renderPage();
    await screen.findByText('Sprint template');
    fireEvent.click(screen.getByRole('button', { name: /More actions for/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete: Sprint template/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => expect(del).toHaveBeenCalledWith(template.id));
    expect(await screen.findByText('No templates yet')).toBeDefined();
  });
});
