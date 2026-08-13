import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { api } from '../../lib/api';
import type { ProjectTemplate, Team } from '../../lib/types';
import { TemplatesPage } from './TemplatesPage';

vi.mock('../../state/teams-context', () => ({
  useTeams: () => ({ teams: TEAMS }),
}));

const TEAM_ID = '22222222-2222-4222-8222-222222222222';

const TEAMS: Team[] = [
  {
    id: TEAM_ID,
    name: 'Team A',
    role: 'admin',
    memberCount: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

function makeTemplate(over: Partial<ProjectTemplate> = {}): ProjectTemplate {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    teamId: TEAM_ID,
    teamName: 'Team A',
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

describe('TemplatesPage', () => {
  it('shows an empty state when there are no templates', async () => {
    vi.spyOn(api, 'listTemplates').mockResolvedValue([]);

    renderPage();
    expect(await screen.findByText('No templates yet')).toBeDefined();
  });

  it('lists templates with team name, description and created date', async () => {
    vi.spyOn(api, 'listTemplates').mockResolvedValue([makeTemplate()]);

    renderPage();
    expect(await screen.findByText('Sprint template')).toBeDefined();
    expect(screen.getByText('Board with standard columns')).toBeDefined();
    expect(screen.getByText('Team A')).toBeDefined();
  });

  it('offers Use template and admin-only Delete per row', async () => {
    vi.spyOn(api, 'listTemplates').mockResolvedValue([makeTemplate()]);

    renderPage();
    await screen.findByText('Sprint template');
    expect(screen.getAllByRole('button', { name: 'Use template' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDefined();
  });

  it('hides Delete for teams where the user is not an admin', async () => {
    vi.spyOn(api, 'listTemplates').mockResolvedValue([
      makeTemplate({ teamId: '99999999-9999-4999-8999-999999999999' }),
    ]);

    renderPage();
    await screen.findByText('Sprint template');
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('deletes a template after confirmation', async () => {
    const template = makeTemplate();
    vi.spyOn(api, 'listTemplates').mockResolvedValue([template]);
    const del = vi.spyOn(api, 'deleteTemplate').mockResolvedValue({ ok: true });

    renderPage();
    await screen.findByText('Sprint template');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[1]!);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => expect(del).toHaveBeenCalledWith(template.id));
    expect(await screen.findByText('No templates yet')).toBeDefined();
  });

  it('opens the instantiate modal from Use template and creates a project', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    await waitFor(() => expect(inst).toHaveBeenCalledWith(template.id, 'Sprint template'));
  });
});
