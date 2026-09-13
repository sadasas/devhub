import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  LAST_ACTIVE_TEAM_KEY,
  WorkspaceSwitcher,
  readLastActiveTeamId,
  writeLastActiveTeamId,
} from './WorkspaceSwitcher';
import type { Team } from '../../lib/types';

const TEAMS: Team[] = [
  {
    id: 't1',
    name: 'Alpha',
    icon: '🚀',
    slug: 'alpha',
    role: 'owner',
    plan: 'free',
    planPackageName: 'Free',
    memberCount: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 't2',
    name: 'Beta',
    icon: null,
    slug: 'beta',
    role: 'editor',
    plan: 'free',
    planPackageName: 'Free',
    memberCount: 1,
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  },
];

function renderSwitcher(props?: Partial<ComponentProps<typeof WorkspaceSwitcher>>) {
  const onSelectTeam = vi.fn();
  const onCreateTeam = vi.fn();
  render(
    <WorkspaceSwitcher
      teams={TEAMS}
      activeTeamId="t1"
      onSelectTeam={onSelectTeam}
      onCreateTeam={onCreateTeam}
      {...props}
    />,
  );
  return { onSelectTeam, onCreateTeam };
}

// Focus moves via requestAnimationFrame (same pattern as SearchableSelect);
// flush two frames before asserting document.activeElement in jsdom.
function flushRaf(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

describe('WorkspaceSwitcher', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows the active team (icon + name + chevron) with a collapsed trigger', () => {
    renderSwitcher();
    const trigger = screen.getByRole('button', { name: 'Switch workspace: Alpha' });
    expect(trigger.textContent).toContain('🚀');
    expect(trigger.textContent).toContain('Alpha');
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('opens a menu with only the user teams plus a create entry (no All-teams option)', () => {
    renderSwitcher();
    fireEvent.click(screen.getByRole('button', { name: 'Switch workspace: Alpha' }));
    const menu = screen.getByRole('listbox', { name: 'Workspaces' });
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]?.textContent).toContain('Alpha');
    expect(options[1]?.textContent).toContain('Beta');
    expect(menu.textContent).not.toMatch(/all team/i);
    expect(screen.getByRole('button', { name: 'Create team' })).toBeTruthy();
    // aria-controls on the trigger points at the open menu.
    const trigger = screen.getByRole('button', { name: 'Switch workspace: Alpha' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-controls')).toBe(menu.getAttribute('id'));
  });

  it('selects another team, closes, and returns focus to the trigger', async () => {
    const { onSelectTeam } = renderSwitcher();
    const trigger = screen.getByRole('button', { name: 'Switch workspace: Alpha' });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('option', { name: 'Beta' }));
    expect(onSelectTeam).toHaveBeenCalledWith('t2');
    expect(screen.queryByRole('listbox')).toBeNull();
    await flushRaf();
    expect(document.activeElement).toBe(trigger);
  });

  it('supports arrow-key navigation and Enter to select', async () => {
    const { onSelectTeam } = renderSwitcher();
    const trigger = screen.getByRole('button', { name: 'Switch workspace: Alpha' });
    fireEvent.click(trigger);
    const menu = screen.getByRole('listbox');
    await flushRaf();
    // Focus lands on the selected option on open.
    expect(document.activeElement?.getAttribute('role')).toBe('option');
    expect(document.activeElement?.textContent).toContain('Alpha');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent).toContain('Beta');
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement?.textContent).toContain('Alpha');
    fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement?.textContent).toContain('Beta');
    fireEvent.keyDown(menu, { key: 'Home' });
    expect(document.activeElement?.textContent).toContain('Alpha');
    // Activate the focused option: move to Beta and click it.
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.click(document.activeElement as HTMLElement);
    expect(onSelectTeam).toHaveBeenCalledWith('t2');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes on Escape and restores focus to the trigger', async () => {
    renderSwitcher();
    const trigger = screen.getByRole('button', { name: 'Switch workspace: Alpha' });
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    await flushRaf();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on outside pointer-down but stays open for inside clicks', () => {
    renderSwitcher();
    fireEvent.click(screen.getByRole('button', { name: 'Switch workspace: Alpha' }));
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Switch workspace: Alpha' }));
    fireEvent.pointerDown(screen.getByRole('option', { name: 'Alpha' }));
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('renders the zero-team empty state with text and a create button', () => {
    const { onCreateTeam } = renderSwitcher({ teams: [], activeTeamId: null });
    expect(
      screen.getByRole('button', { name: 'Select workspace' }).textContent,
    ).toContain('Select workspace');
    fireEvent.click(screen.getByRole('button', { name: 'Select workspace' }));
    expect(screen.getByRole('listbox').textContent).toContain('No teams yet.');
    fireEvent.click(screen.getByRole('button', { name: 'Create team' }));
    expect(onCreateTeam).toHaveBeenCalledTimes(1);
  });
});

describe('last-active-team storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses a dedicated key (no RAIL_* reuse)', () => {
    expect(LAST_ACTIVE_TEAM_KEY).toBe('devhub:team:lastActive');
    expect(LAST_ACTIVE_TEAM_KEY).not.toMatch(/RAIL/i);
  });

  it('round-trips the last team id and ignores blank values', () => {
    expect(readLastActiveTeamId()).toBeNull();
    writeLastActiveTeamId('t2');
    expect(readLastActiveTeamId()).toBe('t2');
    localStorage.setItem(LAST_ACTIVE_TEAM_KEY, '   ');
    expect(readLastActiveTeamId()).toBeNull();
  });
});
