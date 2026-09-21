import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectSettings } from './ProjectSettings';
import type { Project } from '../../lib/types';

const updateMock = vi.hoisted(() => vi.fn());

vi.mock('../../state/projects-context', () => ({ useProjects: () => ({ update: updateMock }) }));
vi.mock('../../hooks/useCopyFeedback', () => ({
  useCopyFeedback: () => ({ copied: false, copy: vi.fn() }),
}));
vi.mock('../integrations/GCalSettings', () => ({
  GCalSettings: ({ projectId }: { projectId: string }) => (
    <div data-testid="gcal-stub" data-project={projectId} />
  ),
}));
vi.mock('../../state/project-context', () => ({
  useProject: () => ({ state: { labelDefs: [], tasks: [] }, dispatch: vi.fn(), canEdit: true }),
}));

function project(over: Partial<Project> = {}): Project {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Demo',
    description: 'Demo desc',
    status: 'active',
    visibility: 'private',
    tabs: ['board'],
    prd: { purpose: '', goals: '', features: '', scope: '', outOfScope: '' },
    teamId: 'team-1',
    teamName: 'Alpha',
    role: 'owner',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function renderSettings(entry: string, props: Partial<Parameters<typeof ProjectSettings>[0]> = {}) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ProjectSettings
        project={project()}
        canEditMeta
        canConnect
        canArchive
        isAdmin
        onBack={() => {}}
        onRequestArchive={() => {}}
        onRequestDelete={() => {}}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('ProjectSettings shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMock.mockResolvedValue(project());
  });

  it('renders nav plus General section by default', () => {
    renderSettings('/project/p1?tab=settings');
    expect(screen.getByRole('navigation', { name: 'Project settings' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'General' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Integrations' }).getAttribute('href')).toContain('section=integrations');
    expect(screen.getByRole('heading', { name: 'General' })).toBeTruthy();
    expect(screen.getByText('Demo')).toBeTruthy();
    expect(screen.getByText('Demo desc')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
    expect(screen.queryByLabelText(/Project name/)).toBeNull();
  });

  it('renders the Integrations section with gcal stub and GitHub panel', () => {
    renderSettings('/project/p1?tab=settings&section=integrations');
    expect(screen.getByRole('heading', { name: 'Integrations' })).toBeTruthy();
    const stub = screen.getByTestId('gcal-stub');
    expect(stub.getAttribute('data-project')).toBe('11111111-1111-4111-8111-111111111111');
    expect(screen.getByRole('heading', { name: 'GitHub' })).toBeTruthy();
  });

  it('renders the Labels section with add form and empty state', () => {
    renderSettings('/project/p1?tab=settings&section=labels');
    expect(screen.getByRole('link', { name: 'Labels' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('heading', { name: 'Labels' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add' })).toBeTruthy();
    expect(screen.getByPlaceholderText(/Label name/)).toBeTruthy();
  });

  it('falls back to General for an unknown section', () => {
    renderSettings('/project/p1?tab=settings&section=nope');
    expect(screen.getByRole('heading', { name: 'General' })).toBeTruthy();
  });

  it('shows project ID row and team/status rows', () => {
    renderSettings('/project/p1?tab=settings');
    expect(screen.getByText('Project ID')).toBeTruthy();
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
  });

  it('saves name+description via update() for admins', async () => {
    renderSettings('/project/p1?tab=settings');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Project name/), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', {
        name: 'Renamed',
        description: 'Demo desc',
      }),
    );
    // Sukses menutup modal.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('disables editing with a helper for editors', () => {
    renderSettings('/project/p1?tab=settings', { canEditMeta: false });
    expect(screen.queryByLabelText(/Project name/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.getByText('Only owners and admins can edit project settings.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
  });

  it('calls onBack from the nav back button', () => {
    const onBack = vi.fn();
    renderSettings('/project/p1?tab=settings', { onBack });
    fireEvent.click(screen.getByRole('button', { name: 'Back to project' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders danger nav and archive+delete rows for admins', () => {
    renderSettings('/project/p1?tab=settings&section=danger');
    expect(screen.getByRole('link', { name: 'Danger zone' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('heading', { name: 'Danger zone' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
  });

  it('shows restore instead of archive for archived projects', () => {
    renderSettings('/project/p1?tab=settings&section=danger', {
      project: project({ status: 'archived' }),
    });
    expect(screen.getByRole('button', { name: 'Restore' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
  });

  it('hides the delete row for non-admins', () => {
    renderSettings('/project/p1?tab=settings&section=danger', { isAdmin: false });
    expect(screen.getByRole('button', { name: 'Archive' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('requests archive/restore/delete through callbacks', () => {
    const onRequestArchive = vi.fn();
    const onRequestDelete = vi.fn();
    renderSettings('/project/p1?tab=settings&section=danger', { onRequestArchive, onRequestDelete });
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(onRequestArchive).toHaveBeenCalledWith('archive');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onRequestDelete).toHaveBeenCalledTimes(1);
  });
});
