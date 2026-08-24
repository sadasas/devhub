import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { BillingPackage, Team } from '../../lib/types';
import { NewProjectModal } from './NewProjectModal';

const mocks = vi.hoisted(() => ({
  createProject: vi.fn(),
  listPackages: vi.fn(),
}));

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      createProject: mocks.createProject,
      listPackages: mocks.listPackages,
    },
  };
});

vi.mock('../../state/projects-context', () => ({
  useProjects: () => ({ create: mocks.createProject }),
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
    plan: 'free',
    planPackageName: 'Free',
    memberCount: 2,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

let mockTeams: Team[] | null;

const PRO_PACKAGE: BillingPackage = {
  id: 'pkg-pro',
  name: 'Pro',
  description: '',
  isFree: false,
  maxMembers: null,
  maxProjects: null,
  prices: [{ id: 'pr-30', durationDays: 30, priceIdr: 250_000, originalPriceIdr: null }],
};

describe('NewProjectModal team select', () => {
  beforeEach(() => {
    mocks.createProject.mockReset();
    mocks.listPackages.mockReset().mockResolvedValue({ packages: [PRO_PACKAGE] });
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
    expect(mocks.createProject).toHaveBeenCalledWith('Landing', '', TEAM_B);
  });

  it('shows a hint instead of the select when there are no teams', () => {
    mockTeams = [];
    render(<NewProjectModal open onClose={vi.fn()} />);
    expect(screen.getByText(/You have no teams yet/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Platform|Web/ })).toBeNull();
  });

  it('shows the upgrade modal when the plan limit is hit', async () => {
    const { ApiError } = await import('../../lib/api');
    const onClose = vi.fn();
    mocks.createProject.mockRejectedValue(
      new ApiError(402, 'PLAN_LIMIT', 'limit reached', { resource: 'projects', limit: 3 }),
    );
    render(<NewProjectModal open onClose={onClose} />);
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Landing' } });
    fireEvent.submit(document.getElementById('new-project-form')!);

    expect(await screen.findByText('Upgrade workspace')).toBeDefined();
    expect(screen.getByText('Project limit reached on your current plan.')).toBeDefined();
    expect(screen.getByText(/Lihat opsi paket/)).toBeDefined();
    const pricingBtn = screen.getByRole('button', { name: /Lihat Pricing/ });
    expect(pricingBtn).toBeDefined();
  });
});