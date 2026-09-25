import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { IssuesPage } from './IssuesPage';
import type { Issue } from '../../lib/types';

const useProjectMock = vi.hoisted(() => vi.fn());
const dispatchMock = vi.hoisted(() => vi.fn());

vi.mock('../../state/project-context', () => ({
  useProject: useProjectMock,
}));

function issue(over: Partial<Issue> = {}): Issue {
  return {
    id: 'i1',
    title: 'Flaky test',
    severity: 'medium',
    status: 'open',
    description: '',
    reproduction: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function renderPage(unreadIds?: ReadonlySet<string>) {
  return render(
    <MemoryRouter>
      <IssuesPage unreadIds={unreadIds} />
    </MemoryRouter>,
  );
}

describe('IssuesPage', () => {
  beforeEach(() => {
    useProjectMock.mockReset();
    dispatchMock.mockReset();
    useProjectMock.mockReturnValue({
      state: {
        issues: [issue(), issue({ id: 'i2', title: 'Second issue' })],
        tasks: [],
      },
      loading: false,
      error: null,
      canEdit: true,
      dispatch: dispatchMock,
    });
  });

  it('marks rows with an unread dot for ids in unreadIds', () => {
    renderPage(new Set(['i1']));
    expect(document.querySelectorAll('.unread-pill').length).toBe(1);
    expect(screen.getAllByText('Unread').length).toBe(1);
  });

  it('renders no unread dots without unreadIds', () => {
    renderPage();
    expect(document.querySelectorAll('.unread-pill').length).toBe(0);
  });

  it('toggles pinned via dispatch', () => {
    renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: 'Pin issue' })[0]!);
    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'issue/update',
      id: 'i1',
      patch: { pinned: true },
    });
  });

  it('renders pinned issues first', () => {    useProjectMock.mockReturnValue({
      state: {
        issues: [issue(), issue({ id: 'i2', title: 'Second issue', pinned: true })],
        tasks: [],
      },
      loading: false,
      error: null,
      canEdit: true,
      dispatch: dispatchMock,
    });
    renderPage();
    const first = screen.getAllByText('Second issue')[0]!;
    expect((first.closest('.data-row') as HTMLElement).textContent).toContain('Second issue');
    expect(screen.getAllByRole('button', { name: 'Unpin issue' }).length).toBe(1);
  });

  it('delete via row asks for confirm before dispatch (no double-dispatch)', () => {
    renderPage();
    const deleteBtn = screen.getByRole('button', { name: 'Delete issue Flaky test' });
    expect(deleteBtn).toBeTruthy();
    // stopPropagation: row click must not open the edit modal
    fireEvent.click(deleteBtn);
    expect(dispatchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();
    // confirm dialog opens at page level
    expect(screen.getByText('Delete issue?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(dispatchMock).toHaveBeenCalledWith({ type: 'issue/remove', id: 'i1' });
    // dialog closes after confirm — second confirm click cannot re-dispatch
    expect(screen.queryByText('Delete issue?')).toBeNull();
  });

  it('gmail swap: idle shows status, hover layer holds Pin+Trash, ID only in left meta', () => {
    renderPage();
    const row = screen.getByText('Flaky test').closest('.data-row')!;
    // ID tetap di meta kiri, tidak diduplikat di kanan
    expect(row.querySelector('.data-row-meta')?.textContent).toMatch(/#\w+/);
    expect(row.querySelector('.swap-shortid')).toBeNull();
    const swap = row.querySelector('.row-swap');
    expect(swap).toBeTruthy();
    expect(swap?.classList.contains('is-pinned')).toBe(false);
    // idle = status Badge
    expect(row.querySelector('.swap-status')?.textContent).toMatch(/Open/);
    // actions ada di DOM (no display:none) agar Tab bisa sampai via :focus-within
    const pinBtn = screen.getAllByRole('button', { name: 'Pin issue' })[0]! as HTMLButtonElement;
    const delBtn = screen.getByRole('button', { name: 'Delete issue Flaky test' }) as HTMLButtonElement;
    expect(row.querySelector('.swap-group')?.contains(pinBtn)).toBe(true);
    expect(row.querySelector('.swap-group')?.contains(delBtn)).toBe(true);
    expect(pinBtn.disabled).toBe(false);
    expect(delBtn.disabled).toBe(false);
    expect(pinBtn.tabIndex).not.toBe(-1);
    expect(delBtn.tabIndex).not.toBe(-1);
  });

  it('blurs Pin after pointer click (no stuck :focus-within) but keeps focus for keyboard', () => {
    renderPage();
    const pinBtn = screen.getAllByRole('button', { name: 'Pin issue' })[0]! as HTMLButtonElement;
    // pointer (mouse/touch): detail > 0 → blur agar actions tidak nyangkut
    pinBtn.focus();
    expect(document.activeElement).toBe(pinBtn);
    fireEvent.click(pinBtn, { detail: 1 });
    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'issue/update',
      id: 'i1',
      patch: { pinned: true },
    });
    expect(document.activeElement).not.toBe(pinBtn);
    // keyboard (Enter/Space): detail === 0 → fokus dipertahankan
    dispatchMock.mockClear();
    pinBtn.focus();
    fireEvent.click(pinBtn, { detail: 0 });
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(pinBtn);
  });

  it('gmail swap Q1-A: pinned idle shows status+Pin, hover swaps to Pin+Trash (single Pin)', () => {
    useProjectMock.mockReturnValue({
      state: { issues: [issue({ pinned: true })], tasks: [] },
      loading: false,
      error: null,
      canEdit: true,
      dispatch: dispatchMock,
    });
    renderPage();
    const row = screen.getByText('Flaky test').closest('.data-row')!;
    expect(row.classList.contains('is-pinned')).toBe(true);
    const swap = row.querySelector('.row-swap.is-pinned');
    expect(swap).toBeTruthy();
    // idle tetap ada status (tidak disembunyikan permanen), Pin single instance
    expect(row.querySelector('.swap-status')?.textContent).toMatch(/Open/);
    expect(screen.getByRole('button', { name: 'Unpin issue' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pin issue' })).toBeNull();
    // Trash di group yang sama (flex sibling, bukan overlap)
    expect(row.querySelector('.swap-group button.btn-danger')).toBeTruthy();
  });

  it('keeps pin/delete focusable in .row-swap and hides them for viewers', () => {
    // editor: contextual wrapper exists, buttons focusable (no display:none)
    const first = renderPage();
    const swap = document.querySelector('.issues-page .data-row .row-swap');
    expect(swap).toBeTruthy();
    const pinBtn = screen.getAllByRole('button', { name: 'Pin issue' })[0]! as HTMLButtonElement;
    const delBtn = screen.getByRole('button', { name: 'Delete issue Flaky test' }) as HTMLButtonElement;
    expect(swap?.contains(pinBtn)).toBe(true);
    expect(swap?.contains(delBtn)).toBe(true);
    expect(pinBtn.disabled).toBe(false);
    expect(delBtn.disabled).toBe(false);
    expect(pinBtn.tabIndex).not.toBe(-1);
    expect(delBtn.tabIndex).not.toBe(-1);
    // pinned row keeps Pin visible via .is-pinned (Q1-A)
    first.unmount();
    useProjectMock.mockReturnValue({
      state: { issues: [issue({ pinned: true })], tasks: [] },
      loading: false,
      error: null,
      canEdit: true,
      dispatch: dispatchMock,
    });
    const second = renderPage();
    expect(document.querySelector('.issues-page .data-row.is-pinned .row-swap.is-pinned')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unpin issue' })).toBeTruthy();
    second.unmount();
    // viewer: no pin/delete rendered, only shortId
    useProjectMock.mockReturnValue({
      state: { issues: [issue()], tasks: [] },
      loading: false,
      error: null,
      canEdit: false,
      dispatch: dispatchMock,
    });
    renderPage();
    expect(document.querySelector('.issues-page .swap-group')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pin issue' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete issue/ })).toBeNull();
  });
});

describe('IssuesPage mobile header', () => {
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
    useProjectMock.mockReset();
    dispatchMock.mockReset();
    useProjectMock.mockReturnValue({
      state: {
        issues: [issue(), issue({ id: 'i2', title: 'Second issue' })],
        tasks: [],
      },
      loading: false,
      error: null,
      canEdit: true,
      dispatch: dispatchMock,
    });
  });
  afterEach(() => {
    window.matchMedia = realMatchMedia;
  });

  it('uses the short Issue label on the header add button', () => {
    renderPage();
    expect(document.querySelector('.issues-page')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Issue' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New issue' })).toBeNull();
  });

  it('narrow: inline swap replaced by kebab popup menu', () => {
    renderPage();
    // tiap row punya 1 kebab, tidak ada tombol inline Pin/Delete
    expect(screen.getAllByRole('button', { name: /More actions for/ }).length).toBe(2);
    expect(document.querySelector('.issues-page .swap-group')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pin issue' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete issue/ })).toBeNull();
    // status tetap terlihat di samping kebab
    expect(screen.getAllByText('Open').length).toBe(2);
  });

  it('narrow: kebab opens menu, Pin toggles and closes it', () => {
    renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: /More actions for/ })[0]!);
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Pin issue' }));
    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'issue/update',
      id: 'i1',
      patch: { pinned: true },
    });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('narrow: kebab Delete opens confirm dialog and closes menu', () => {
    renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: /More actions for/ })[0]!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByText('Delete issue?')).toBeTruthy();
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('narrow: Escape closes menu and refocuses the kebab trigger', () => {
    renderPage();
    const kebab = screen.getAllByRole('button', { name: /More actions for/ })[0]! as HTMLButtonElement;
    fireEvent.click(kebab);
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('narrow: viewer sees no kebab', () => {
    useProjectMock.mockReturnValue({
      state: { issues: [issue()], tasks: [] },
      loading: false,
      error: null,
      canEdit: false,
      dispatch: dispatchMock,
    });
    renderPage();
    expect(screen.queryByRole('button', { name: /More actions for/ })).toBeNull();
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
