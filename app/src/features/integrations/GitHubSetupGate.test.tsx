import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubSetupGate } from './GitHubSetupGate';
import type { Project } from '../../lib/types';

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    githubSetup: vi.fn(),
    githubInstallRepos: vi.fn(),
    githubConnect: vi.fn(),
  },
}));

vi.mock('../../lib/api', () => ({ api: apiMock }));

const { projectsMock } = vi.hoisted(() => ({ projectsMock: { current: [] as Project[] } }));

vi.mock('../../state/projects-context', () => ({
  useProjects: () => ({ projects: projectsMock.current }),
}));

function project(id: string, name: string, role: 'owner' | 'viewer'): Project {
  return {
    id,
    name,
    description: '',
    status: 'active',
    visibility: 'private',
    tabs: ['board'],
    prd: { purpose: '', goals: '', features: '', scope: '', outOfScope: '' },
    teamId: 'team-1',
    teamName: 'Alpha',
    role,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as Project;
}

function renderGate(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <GitHubSetupGate />
    </MemoryRouter>,
  );
}

describe('GitHubSetupGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectsMock.current = [project('11111111-1111-4111-8111-111111111111', 'Website', 'owner')];
    apiMock.githubSetup.mockResolvedValue({ installationId: 42, accountLogin: 'acme', accountType: 'Organization' });
    apiMock.githubInstallRepos.mockResolvedValue({
      repos: [{ owner: 'acme', repo: 'web', fullName: 'acme/web', isPrivate: false }],
    });
    apiMock.githubConnect.mockResolvedValue({ mapping: {} });
    try {
      window.localStorage.clear();
    } catch {
      // abaikan — jsdom selalu punya localStorage.
    }
  });

  it('renders nothing without setup params', () => {
    const { container } = renderGate('/');
    expect(container.innerHTML).toBe('');
    expect(apiMock.githubSetup).not.toHaveBeenCalled();
  });

  it('completes setup from any page with saved project default', async () => {
    window.localStorage.setItem('devhub:github:pendingProject', '11111111-1111-4111-8111-111111111111');
    renderGate('/?github=installed&installation_id=42&setup_action=install');
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(await screen.findByText('acme/web')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Connect repository' }));
    await waitFor(() =>
      expect(apiMock.githubConnect).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
        42,
        'acme',
        'web',
      ),
    );
    expect(await screen.findByText(/Connected acme\/web to project/)).toBeTruthy();
  });

  it('shows an error when setup lookup fails', async () => {
    apiMock.githubSetup.mockRejectedValue(new Error('boom'));
    renderGate('/?github=installed&installation_id=42');
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('blocks connect without an eligible project', async () => {
    projectsMock.current = [project('22222222-2222-4222-8222-222222222222', 'Other', 'viewer')];
    renderGate('/?github=installed&installation_id=42');
    await screen.findByText('acme/web');
    expect(screen.getByRole('button', { name: 'Connect repository' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Only owners and admins can change the repository mapping.')).toBeTruthy();
  });
});
