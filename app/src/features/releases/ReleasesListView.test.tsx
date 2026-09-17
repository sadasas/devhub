import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ReleasesListView } from './ReleasesListView';
import type { Milestone } from '../../lib/types';

function milestone(over: Partial<Milestone> = {}): Milestone {
  return {
    id: 'm1',
    name: 'V1 Launch',
    version: '1.0.0',
    targetDate: '2026-12-31',
    status: 'inProgress',
    changelog: 'First release',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

const onSelect = vi.fn();
const onEdit = vi.fn();
const onDelete = vi.fn();
const onNew = vi.fn();

function renderList() {
  return render(
    <ReleasesListView
      milestones={[milestone(), milestone({ id: 'm2', name: 'V2', status: 'planned' })]}
      tasks={[]}
      canEdit
      onSelect={onSelect}
      onEdit={onEdit}
      onDelete={onDelete}
      onNew={onNew}
    />,
  );
}

describe('ReleasesListView', () => {
  beforeEach(() => {
    onSelect.mockReset();
    onEdit.mockReset();
    onDelete.mockReset();
    onNew.mockReset();
  });

  it('hover layer holds Edit+Trash in .swap-group', () => {
    renderList();
    const row = screen.getByText('V1 Launch').closest('.data-row')!;
    const group = row.querySelector('.swap-group');
    expect(group?.contains(screen.getAllByRole('button', { name: 'Edit milestone' })[0]!)).toBe(true);
    expect(group?.contains(screen.getByRole('button', { name: 'Delete milestone V1 Launch' }))).toBe(true);
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit milestone' })[0]!);
    expect(onEdit).toHaveBeenCalledWith('m1');
    fireEvent.click(screen.getByRole('button', { name: 'Delete milestone V1 Launch' }));
    expect(onDelete).toHaveBeenCalledWith('m1');
  });

  it('hides edit/delete for viewers', () => {
    render(
      <ReleasesListView
        milestones={[milestone()]}
        tasks={[]}
        canEdit={false}
        onSelect={onSelect}
        onEdit={onEdit}
        onDelete={onDelete}
        onNew={onNew}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Edit milestone' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete milestone/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /More actions for/ })).toBeNull();
  });
});

describe('ReleasesListView narrow', () => {
  const realMatchMedia = window.matchMedia;
  beforeEach(() => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('640px'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    onSelect.mockReset();
    onEdit.mockReset();
    onDelete.mockReset();
    onNew.mockReset();
  });
  afterEach(() => {
    window.matchMedia = realMatchMedia;
  });

  it('replaces inline actions with kebab popup menu', () => {
    renderList();
    expect(screen.getAllByRole('button', { name: /More actions for/ }).length).toBe(2);
    expect(screen.queryByRole('button', { name: 'Edit milestone' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete milestone/ })).toBeNull();
  });

  it('kebab Edit calls onEdit and closes menu', () => {
    renderList();
    fireEvent.click(screen.getAllByRole('button', { name: /More actions for/ })[0]!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit milestone' }));
    expect(onEdit).toHaveBeenCalledWith('m1');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('kebab Delete calls onDelete and closes menu', () => {
    renderList();
    fireEvent.click(screen.getAllByRole('button', { name: /More actions for/ })[0]!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith('m1');
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
