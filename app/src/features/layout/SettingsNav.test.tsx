import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { SettingsNav } from './SettingsNav';

function renderNav(entry: string, onSelect?: () => void) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <SettingsNav teamSlug="alpha" dashboardTo="/alpha/projects" onSelect={onSelect} />
    </MemoryRouter>,
  );
}

describe('SettingsNav', () => {
  it('renders back link plus 5 section links defaulting to General', () => {
    renderNav('/alpha/settings');
    expect(screen.getByRole('link', { name: 'Back to app' }).getAttribute('href')).toBe('/alpha/projects');
    for (const name of ['General', 'Plan & billing', 'Usage', 'Danger zone']) {
      expect(screen.getByRole('link', { name })).toBeTruthy();
    }
    // Badge text concatenates without whitespace in the accessible name.
    const github = screen.getByRole('link', { name: 'GitHubSoon' });
    expect(github.getAttribute('href')).toBe('/alpha/settings?section=github');
    expect(screen.getByText('Soon')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'General' }).getAttribute('aria-current')).toBe('page');
  });

  it('marks the section from ?section= as current with matching hrefs', () => {
    renderNav('/alpha/settings?section=plan');
    const plan = screen.getByRole('link', { name: 'Plan & billing' });
    expect(plan.getAttribute('aria-current')).toBe('page');
    expect(plan.getAttribute('href')).toBe('/alpha/settings?section=plan');
    expect(screen.getByRole('link', { name: 'General' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('link', { name: 'Usage' }).getAttribute('href')).toBe('/alpha/settings?section=usage');
  });

  it('filters section items by search while keeping Back visible', () => {
    renderNav('/alpha/settings');
    fireEvent.change(screen.getByLabelText('Search settings'), { target: { value: 'usag' } });
    expect(screen.getByRole('link', { name: 'Usage' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'General' })).toBeNull();
    // Back is navigation, not a section — it stays visible during search.
    expect(screen.getByRole('link', { name: 'Back to app' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search settings'), { target: { value: 'zzz-no-match' } });
    expect(screen.getByText('No matching settings')).toBeTruthy();
  });

  it('finds sections by sub-setting keywords with match hints', () => {
    renderNav('/alpha/settings');
    fireEvent.change(screen.getByLabelText('Search settings'), { target: { value: 'url' } });
    expect(screen.getByRole('link', { name: /Umum|General/ })).toBeTruthy();
    expect(screen.getByText(/Team URL|URL tim/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Usage' })).toBeNull();
    // Navigating clears the search.
    fireEvent.click(screen.getByRole('link', { name: /Umum|General/ }));
    expect((screen.getByLabelText('Search settings') as HTMLInputElement).value).toBe('');
  });

  it('notifies onSelect when a section is picked (mobile drawer close)', () => {
    const onSelect = vi.fn();
    renderNav('/alpha/settings', onSelect);
    fireEvent.click(screen.getByRole('link', { name: 'Usage' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
