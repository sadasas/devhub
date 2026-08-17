import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProjectTabNav } from './ProjectTabNav';
import type { ReactNode } from 'react';

const TABS: { id: string; label: string; icon: ReactNode }[] = [
  { id: 'board', label: 'Board', icon: <span aria-hidden="true">▦</span> },
  { id: 'issues', label: 'Issues', icon: <span aria-hidden="true">◉</span> },
  { id: 'whiteboard', label: 'Whiteboard', icon: <span aria-hidden="true">▤</span> },
];

describe('ProjectTabNav', () => {
  it('renders all tabs with the active one marked', () => {
    render(<ProjectTabNav tabs={TABS} active="issues" onSelect={() => {}} unread={{}} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(3);
    expect(screen.getByRole('tab', { name: /Board/ }).getAttribute('aria-selected')).toBe('false');
    expect(screen.getByRole('tab', { name: /Issues/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: /Whiteboard/ }).getAttribute('aria-selected')).toBe('false');
    expect(screen.getByRole('tab', { name: /Issues/ }).id).toBe('project-tab-issues');
  });

  it('shows a badge only on tabs with unread counts', () => {
    render(
      <ProjectTabNav tabs={TABS} active="board" onSelect={() => {}} unread={{ issues: 3 }} />,
    );
    const badge = screen.getByText('3');
    expect(badge.className).toContain('tab-badge');
    expect(badge.getAttribute('aria-label')).toBe('3 unread');
    expect(screen.queryByText('2')).toBeNull();
  });

  it('caps the badge count at 99+', () => {
    render(
      <ProjectTabNav tabs={TABS} active="board" onSelect={() => {}} unread={{ whiteboard: 120 }} />,
    );
    expect(screen.getByText('99+').getAttribute('aria-label')).toBe('120 unread');
  });

  it('calls onSelect with the tab id on click', () => {
    const onSelect = vi.fn();
    render(<ProjectTabNav tabs={TABS} active="board" onSelect={onSelect} unread={{}} />);
    fireEvent.click(screen.getByRole('tab', { name: /Whiteboard/ }));
    expect(onSelect).toHaveBeenCalledWith('whiteboard');
  });
});