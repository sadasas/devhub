import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { ProjectSettingsNav } from './ProjectSettingsNav';

const PID = '11111111-1111-4111-8111-111111111111';

function renderNav(entry: string, onSelect?: () => void) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ProjectSettingsNav projectId={PID} projectTo={`/project/${PID}?tab=board`} onSelect={onSelect} />
    </MemoryRouter>,
  );
}

describe('ProjectSettingsNav', () => {
  it('renders back link plus 3 section links defaulting to General', () => {
    renderNav(`/project/${PID}?tab=settings`);
    expect(screen.getByRole('link', { name: 'Back to project' }).getAttribute('href')).toBe(
      `/project/${PID}?tab=board`,
    );
    for (const name of ['General', 'Integrations', 'Danger zone']) {
      expect(screen.getByRole('link', { name })).toBeTruthy();
    }
    expect(screen.getByRole('link', { name: 'General' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Danger zone' }).getAttribute('href')).toContain('section=danger');
  });

  it('marks the section from ?section= as current and preserves ?from=', () => {
    renderNav(`/project/${PID}?tab=settings&section=integrations&from=issues`);
    const item = screen.getByRole('link', { name: 'Integrations' });
    expect(item.getAttribute('aria-current')).toBe('page');
    expect(item.getAttribute('href')).toBe(
      `/project/${PID}?tab=settings&from=issues&section=integrations`,
    );
    expect(screen.getByRole('link', { name: 'General' }).getAttribute('aria-current')).toBeNull();
  });

  it('falls back to General for an unknown section', () => {
    renderNav(`/project/${PID}?tab=settings&section=nope`);
    expect(screen.getByRole('link', { name: 'General' }).getAttribute('aria-current')).toBe('page');
  });

  it('notifies onSelect when a section is picked (mobile drawer close)', () => {
    const onSelect = vi.fn();
    renderNav(`/project/${PID}?tab=settings`, onSelect);
    fireEvent.click(screen.getByRole('link', { name: 'Danger zone' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
