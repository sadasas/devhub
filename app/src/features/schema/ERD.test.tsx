import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ERD } from './ERD';
import type { Relation, State, Table } from '../../lib/types';

function makeTable(over: Partial<Table> = {}): Table {
  return {
    id: 'tb1',
    name: 'users',
    comment: '',
    columns: [],
    indexes: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function makeRelation(over: Partial<Relation> = {}): Relation {
  return {
    id: 'r1',
    fromTableId: 'tb1',
    fromColumnId: 'c1',
    toTableId: 'tb2',
    toColumnId: 'c2',
    cardinality: '1:N',
    onDelete: 'cascade',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function makeState(): State {
  const tb1 = makeTable({
    id: 'tb1',
    name: 'users',
    columns: [{ id: 'c1', name: 'id', type: 'uuid', nullable: false, primaryKey: true, default: null, comment: '' }],
  });
  const tb2 = makeTable({
    id: 'tb2',
    name: 'projects',
    columns: [{ id: 'c2', name: 'user_id', type: 'uuid', nullable: true, primaryKey: false, default: null, comment: '' }],
  });
  return {
    tasks: [],
    issues: [],
    testCases: [],
    techEntries: [],
    tables: [tb1, tb2],
    relations: [makeRelation()],
    schemaVersions: [],
    decisions: [],
    milestones: [],
    apiCollections: [],
    apiEndpoints: [],
    whiteboards: [],
  };
}

describe('ERD relation selection (ronde 4 — tanpa popover)', () => {
  it('live: clicking a line lifts via onSelectRelation without popover or delete', () => {
    const onDelete = vi.fn();
    const onSelectRelation = vi.fn();
    const onSelectTable = vi.fn();
    render(
      <ERD
        state={makeState()}
        onDeleteRelation={onDelete}
        onNewTable={() => {}}
        onSelectRelation={onSelectRelation}
        onSelectTable={onSelectTable}
      />,
    );
    const line = screen.getByRole('button', { name: /users\.id to projects\.user_id/i });
    fireEvent.click(line);
    expect(onDelete).not.toHaveBeenCalled();
    expect(onSelectRelation).toHaveBeenCalledWith('r1');
    expect(onSelectTable).toHaveBeenCalledWith(null);
    // Ronde 4 ITEM 3: tidak ada popover — Delete ada di panel.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/users\.id.*projects\.user_id/i);
  });

  it('live: Enter lifts without deleting, no popover', () => {
    const onDelete = vi.fn();
    const onSelectRelation = vi.fn();
    render(
      <ERD
        state={makeState()}
        onDeleteRelation={onDelete}
        onNewTable={() => {}}
        onSelectRelation={onSelectRelation}
        onSelectTable={() => {}}
      />,
    );
    const line = screen.getByRole('button', { name: /users\.id to projects\.user_id/i });
    fireEvent.keyDown(line, { key: 'Enter' });
    expect(onDelete).not.toHaveBeenCalled();
    expect(onSelectRelation).toHaveBeenCalledWith('r1');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('live: clicking empty canvas clears via onSelect (no popover to close)', () => {
    const onSelectRelation = vi.fn();
    const onSelectTable = vi.fn();
    render(
      <ERD
        state={makeState()}
        onDeleteRelation={() => {}}
        onNewTable={() => {}}
        onSelectRelation={onSelectRelation}
        onSelectTable={onSelectTable}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /users\.id to projects\.user_id/i }));
    expect(onSelectRelation).toHaveBeenCalledWith('r1');
    fireEvent.click(screen.getByRole('group', { name: /Entity relationship diagram/i }));
    expect(onSelectTable).toHaveBeenCalledWith(null);
    expect(onSelectRelation).toHaveBeenCalledWith(null);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('readOnly: relation click never shows popover nor Delete in canvas', () => {
    const onDelete = vi.fn();
    render(<ERD state={makeState()} onDeleteRelation={onDelete} onNewTable={() => {}} readOnly />);
    const line = screen.getByRole('button', { name: /users\.id to projects\.user_id/i });
    fireEvent.click(line);
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete relation/i })).toBeNull();
  });
});

describe('ERD draggable nodes (F2-5)', () => {
  function svgEl(): SVGSVGElement {
    const svg = document.querySelector('.erd-canvas svg');
    if (!svg) throw new Error('ERD svg not found');
    return svg as SVGSVGElement;
  }

  it('live: pointer drag beyond 4px commits a single onMoveTable and shows no relation popover', () => {
    const onMove = vi.fn();
    render(
      <ERD state={makeState()} onDeleteRelation={() => {}} onNewTable={() => {}} onMoveTable={onMove} />,
    );
    const svg = svgEl();
    // tb1 grid cell starts at (16,16); view offset is (16,16) at s=1, jsdom rect is 0,0 —
    // client (50,40) lands inside the node.
    fireEvent.pointerDown(svg, { button: 0, clientX: 50, clientY: 40, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 100, clientY: 80, pointerId: 1 });
    fireEvent.pointerUp(svg, { clientX: 100, clientY: 80, pointerId: 1 });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0]?.[0]).toBe('tb1');
    expect(onMove.mock.calls[0]?.[1]).toMatchObject({ x: 66, y: 56 });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('live: movement below 4px is a click/selection — no commit, node keeps focus', () => {
    const onMove = vi.fn();
    render(
      <ERD state={makeState()} onDeleteRelation={() => {}} onNewTable={() => {}} onMoveTable={onMove} />,
    );
    const svg = svgEl();
    fireEvent.pointerDown(svg, { button: 0, clientX: 50, clientY: 40, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 51, clientY: 41, pointerId: 1 });
    fireEvent.pointerUp(svg, { clientX: 51, clientY: 41, pointerId: 1 });
    expect(onMove).not.toHaveBeenCalled();
    const node = screen.getByRole('button', { name: /Table users/i });
    expect(document.activeElement).toBe(node);
  });

  it('live: Arrow on a focused node moves 8px (Shift 32px) + announces via role=status', () => {
    const onMove = vi.fn();
    render(
      <ERD state={makeState()} onDeleteRelation={() => {}} onNewTable={() => {}} onMoveTable={onMove} />,
    );
    const node = screen.getByRole('button', { name: /Table users/i });
    fireEvent.keyDown(node, { key: 'ArrowRight' });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0]?.[1]).toMatchObject({ x: 24, y: 16 });
    expect(screen.getByRole('status').textContent).toMatch(/users/i);
    fireEvent.keyDown(node, { key: 'ArrowDown', shiftKey: true });
    expect(onMove).toHaveBeenCalledTimes(2);
    expect(onMove.mock.calls[1]?.[1]).toMatchObject({ x: 16, y: 48 });
  });

  it('live: Enter on a node opens the table modal via onOpenTable, Esc returns focus to canvas', () => {
    const onOpen = vi.fn();
    render(
      <ERD
        state={makeState()}
        onDeleteRelation={() => {}}
        onNewTable={() => {}}
        onMoveTable={() => {}}
        onOpenTable={onOpen}
      />,
    );
    const node = screen.getByRole('button', { name: /Table users/i });
    fireEvent.keyDown(node, { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0]?.[0]).toBe('tb1');
    fireEvent.keyDown(node, { key: 'Escape' });
    expect(document.activeElement).toBe(svgEl());
  });

  it('live: stored erdLayout overrides the grid fallback; orphans are ignored', () => {
    const base = makeState();
    const withLayout: State = {
      ...base,
      erdLayout: { tb1: { x: 400, y: 300 }, orphan: { x: 999, y: 999 } } as State['erdLayout'],
    };
    render(<ERD state={withLayout} onDeleteRelation={() => {}} onNewTable={() => {}} />);
    const tb1 = document.querySelector('[data-table-id="tb1"]');
    const tb2 = document.querySelector('[data-table-id="tb2"]');
    expect(tb1?.getAttribute('style')).toContain('translate(400px, 300px)');
    // tb2 has no override → grid fallback (second column at x=272, y=16).
    expect(tb2?.getAttribute('style')).toContain('translate(272px, 16px)');
    expect(document.querySelector('[data-table-id="orphan"]')).toBeNull();
  });

  it('readOnly: pointer drag and keyboard nudge never commit', () => {
    const onMove = vi.fn();
    const onOpen = vi.fn();
    render(
      <ERD
        state={makeState()}
        onDeleteRelation={() => {}}
        onNewTable={() => {}}
        readOnly
        onMoveTable={onMove}
        onOpenTable={onOpen}
      />,
    );
    const svg = svgEl();
    fireEvent.pointerDown(svg, { button: 0, clientX: 50, clientY: 40, pointerId: 1 });
    fireEvent.pointerMove(svg, { clientX: 120, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(svg, { clientX: 120, clientY: 100, pointerId: 1 });
    expect(onMove).not.toHaveBeenCalled();
    const node = screen.getByRole('button', { name: /Table users/i });
    fireEvent.keyDown(node, { key: 'ArrowRight' });
    expect(onMove).not.toHaveBeenCalled();
  });
});
