import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Team } from '../../lib/types';
import { NewProjectModal } from './NewProjectModal';

vi.mock('../../state/projects-context', () => ({
  useProjects: () => ({ create: mockCreate }),
}));

vi.mock('../../state/teams-context', () => ({
  useTeams: () => ({ teams: mockTeams }),
}));

vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
}));

const TEAM_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TEAM_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function makeTeam(over: Partial<Team>): Team {
  return {
    id: TEAM_A,
    name: 'Platform',
    role: 'owner',
    memberCount: 2,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

let mockTeams: Team[] | null;
const mockCreate = vi.fn();

describe('NewProjectModal team select', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockTeams = [makeTeam({}), makeTeam({ id: TEAM_B, name: 'Web' })];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates the project in the selected team', () => {
    render(<NewProjectModal open onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Landing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Team' }));
    fireEvent.click(screen.getByRole('option', { name: 'Web' }));
    fireEvent.submit(document.getElementById('new-project-form')!);
    expect(mockCreate).toHaveBeenCalledWith('Landing', '', TEAM_B);
  });

  it('shows a hint instead of the select when there are no teams', () => {
    mockTeams = [];
    render(<NewProjectModal open onClose={vi.fn()} />);
    expect(screen.getByText(/You have no teams yet/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Platform|Web/ })).toBeNull();
  });
});