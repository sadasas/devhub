import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { CommandPalette } from './CommandPalette';
import type { ProjectSearchResult } from '../lib/api';

const mocks = vi.hoisted(() => ({
  projects: [] as { id: string; name: string }[],
  searchResults: [] as ProjectSearchResult[],
  searchLoading: false,
  searchError: null as string | null,
}));

vi.mock('../state/projects-context', () => ({
  useProjects: () => ({ projects: mocks.projects }),
}));

vi.mock('../hooks/useSearchResults', () => ({
  useSearchResults: () => ({
    results: mocks.searchResults,
    loading: mocks.searchLoading,
    error: mocks.searchError,
  }),
}));

function renderPalette() {
  let location = '';
  function Probe() {
    location = useLocation().pathname + useLocation().search;
    return null;
  }
  const view = render(
    <MemoryRouter initialEntries={['/']}>
      <Probe />
      <CommandPalette />
    </MemoryRouter>,
  );
  return { view, getLocation: () => location };
}

function openPalette() {
  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
  return screen.getByRole('combobox', { name: 'Search commands' });
}

describe('CommandPalette', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mocks.projects = [];
    mocks.searchResults = [];
    mocks.searchLoading = false;
    mocks.searchError = null;
  });

  it('opens with Ctrl+K and lists navigation commands', () => {
    renderPalette();
    const input = openPalette();
    expect(input).toBeTruthy();
    expect(screen.getByRole('option', { name: /Go to dashboard/ })).toBeTruthy();
    expect(screen.getByRole('option', { name: /New project/ })).toBeTruthy();
  });

  it('does not query for queries shorter than 2 characters', () => {
    const { view } = renderPalette();
    openPalette();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'a' } });
    expect(view.queryByText(/Searching/)).not.toBeTruthy();
  });

  it('shows a loading placeholder while results are pending', () => {
    mocks.searchLoading = true;
    renderPalette();
    const input = openPalette();
    fireEvent.change(input, { target: { value: 'api' } });
    expect(screen.getByText('Searching…')).toBeTruthy();
  });

  it('shows an error placeholder when the request fails', () => {
    mocks.searchError = 'Search failed';
    renderPalette();
    const input = openPalette();
    fireEvent.change(input, { target: { value: 'api' } });
    expect(screen.getByText('Search failed')).toBeTruthy();
  });

  it('renders search results grouped by project with highlighted match', () => {
    mocks.searchResults = [
      {
        projectId: 'p1',
        projectName: 'Alpha',
        hits: [
          {
            entity: 'tasks',
            entityId: 't1',
            title: 'Build API client',
            field: 'title',
            snippet: 'Build API client',
            score: 30,
          },
          {
            entity: 'issues',
            entityId: 'i1',
            title: 'Broken API',
            field: 'title',
            snippet: 'Broken API',
            score: 15,
          },
        ],
      },
    ];
    renderPalette();
    const input = openPalette();
    fireEvent.change(input, { target: { value: 'api' } });
    expect(screen.getByText('Results · Alpha')).toBeTruthy();
    const hit = screen.getByRole('option', { name: /Build API client/ });
    expect(hit.querySelector('mark')?.textContent).toBe('API');
    expect(screen.getByRole('option', { name: /Broken API/ })).toBeTruthy();
  });

  it('keeps body-field matches visible even when the title does not contain the query', () => {
    mocks.searchResults = [
      {
        projectId: 'p1',
        projectName: 'Alpha',
        hits: [
          {
            entity: 'decisions',
            entityId: 'd1',
            title: 'Choose a database',
            field: 'options',
            snippet: 'prefer …sqlite… for local dev',
            score: 5,
          },
        ],
      },
    ];
    renderPalette();
    const input = openPalette();
    fireEvent.change(input, { target: { value: 'sqlite' } });
    expect(screen.getByRole('option', { name: /Choose a database/ })).toBeTruthy();
  });

  it('navigates to the entity deep link on Enter', () => {
    mocks.searchResults = [
      {
        projectId: 'p1',
        projectName: 'Alpha',
        hits: [
          {
            entity: 'tasks',
            entityId: 't1',
            title: 'Fix login bug',
            field: 'title',
            snippet: 'Fix login bug',
            score: 30,
          },
        ],
      },
    ];
    const { getLocation } = renderPalette();
    const input = openPalette();
    fireEvent.change(input, { target: { value: 'login' } });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(getLocation()).toBe('/project/p1?tab=board&entity=tasks&id=t1');
  });

  it('closes the palette with Escape', () => {
    const { view } = renderPalette();
    openPalette();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(view.queryByRole('combobox')).not.toBeTruthy();
  });
});
