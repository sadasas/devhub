import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { State, Task } from '../../lib/types';
import { DueCalendar } from './DueCalendar';

const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), setStatus: vi.fn() }));

vi.mock('../../lib/due-dates', async () => {
  const actual = await vi.importActual<typeof import('../../lib/due-dates')>('../../lib/due-dates');
  return { ...actual, todayIso: () => '2026-08-15' };
});

vi.mock('../../state/project-context', () => ({
  useProject: () => ({ state: mockState, dispatch: mocks.dispatch, canEdit: true, setStatus: mocks.setStatus }),
}));

function makeState(): State {
  return {
    tasks: [
      {
        id: '55555555-5555-4555-8555-555555555555',
        title: 'Ship calendar',
        status: 'inProgress',
        priority: 'medium',
        labels: [],
        blockedBy: [],
        dueDate: '2026-08-20',
        description: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: '66666666-6666-4666-8666-666666666666',
        title: 'No date task',
        status: 'todo',
        priority: 'low',
        labels: [],
        blockedBy: [],
        dueDate: null,
        description: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    issues: [],
    testCases: [],
    techEntries: [],
    tables: [],
    relations: [],
    schemaVersions: [],
    decisions: [],
    milestones: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        name: 'V0.2.0',
        version: '0.2.0',
        status: 'planned',
        targetDate: '2026-08-25',
        changelog: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    apiCollections: [],
    apiEndpoints: [],
    whiteboards: [],
  };
}

let mockState: State;

function renderCalendar() {
  const onOpenTask = vi.fn();
  const onQuickCreate = vi.fn();
  const view = render(<DueCalendar onOpenTask={onOpenTask} onQuickCreate={onQuickCreate} />);
  return { onOpenTask, onQuickCreate, view };
}

function dataTransfer() {
  return { getData: () => '55555555-5555-4555-8555-555555555555', setData: vi.fn(), effectAllowed: 'move' } as unknown as DataTransfer;
}

beforeEach(() => {
  mocks.dispatch.mockReset();
  mockState = makeState();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DueCalendar', () => {
  it('renders a month grid with day cells', () => {
    renderCalendar();
    expect(screen.getByText('August 2026')).toBeTruthy();
    expect(screen.getByText('Mon')).toBeTruthy();
    expect(document.querySelectorAll('.due-cal-cell').length).toBe(42);
  });

  it('renders 5 rows (35 cells) for September 2026', () => {
    renderCalendar();
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('September 2026')).toBeTruthy();
    expect(document.querySelectorAll('.due-cal-cell').length).toBe(35);
  });

  it('shows task chips on their due date', () => {
    renderCalendar();
    const chip = screen.getByText('Ship calendar');
    expect(chip).toBeTruthy();
    expect(chip.closest('.due-cal-task')).toBeTruthy();
  });

  it('lists unscheduled tasks in the no-date strip', () => {
    renderCalendar();
    expect(screen.getByText('No date task')).toBeTruthy();
  });

  it('quick-creates on cell click (no modal)', () => {
    const { onQuickCreate } = renderCalendar();
    fireEvent.click(document.querySelector('[data-date="2026-08-20"]')!);
    expect(onQuickCreate).toHaveBeenCalledWith('2026-08-20');
  });

  it('quick-creates on Enter on a focused cell', () => {
    const { onQuickCreate } = renderCalendar();
    fireEvent.focus(document.querySelector('[data-date="2026-08-20"]')!);
    fireEvent.keyDown(document.querySelector('[data-date="2026-08-20"]')!, { key: 'Enter' });
    expect(onQuickCreate).toHaveBeenCalledWith('2026-08-20');
  });

  it('opens the task modal when a chip is clicked', () => {
    const { onOpenTask } = renderCalendar();
    fireEvent.click(screen.getByText('Ship calendar'));
    expect(onOpenTask).toHaveBeenCalledWith('55555555-5555-4555-8555-555555555555');
  });

  it('menutup tooltip chip saat drag dimulai dan bisa dibuka lagi setelah drop', () => {
    renderCalendar();
    const chip = screen.getByText('Ship calendar').closest('.due-cal-task') as HTMLElement;
    fireEvent.focus(chip);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.dragStart(chip, { dataTransfer: dataTransfer() });
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.dragEnd(chip);
    fireEvent.focus(chip);
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });

  it('reschedules a task by dropping it on another day', () => {
    renderCalendar();
    const chip = screen.getByText('Ship calendar');
    fireEvent.dragStart(chip, { dataTransfer: dataTransfer() });
    fireEvent.drop(document.querySelector('[data-date="2026-08-21"]')!, { dataTransfer: dataTransfer() });
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'task/update',
      id: '55555555-5555-4555-8555-555555555555',
      patch: { dueDate: '2026-08-21' },
    });
  });

  it('clears the due date when dropped on the strip', () => {
    renderCalendar();
    const chip = screen.getByText('Ship calendar');
    fireEvent.dragStart(chip, { dataTransfer: dataTransfer() });
    fireEvent.drop(document.querySelector('.due-cal-strip')!, { dataTransfer: dataTransfer() });
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'task/update',
      id: '55555555-5555-4555-8555-555555555555',
      patch: { dueDate: null },
    });
  });

  it('menandai chip sumber pudar + highlight cell target saat drag (ala kanban)', () => {
    renderCalendar();
    const chip = screen.getByText('Ship calendar').closest('.due-cal-task') as HTMLElement;
    const target = document.querySelector('[data-date="2026-08-21"]') as HTMLElement;
    expect(chip.classList.contains('dragging')).toBe(false);
    fireEvent.dragStart(chip, { dataTransfer: dataTransfer() });
    expect(chip.classList.contains('dragging')).toBe(true);
    fireEvent.dragOver(target, { dataTransfer: dataTransfer() });
    expect(target.classList.contains('due-cal-cell--drop-active')).toBe(true);
    fireEvent.drop(target, { dataTransfer: dataTransfer() });
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'task/update',
      id: '55555555-5555-4555-8555-555555555555',
      patch: { dueDate: '2026-08-21' },
    });
    expect(target.classList.contains('due-cal-cell--drop-active')).toBe(false);
    expect(chip.classList.contains('dragging')).toBe(true);
    fireEvent.dragEnd(chip);
    expect(chip.classList.contains('dragging')).toBe(false);
  });

  it('menandai grid is-dragging selama drag agar chip tak menelan dragover', () => {
    renderCalendar();
    const grid = document.querySelector('.due-cal-grid') as HTMLElement;
    const chip = screen.getByText('Ship calendar').closest('.due-cal-task') as HTMLElement;
    expect(grid.classList.contains('is-dragging')).toBe(false);
    fireEvent.dragStart(chip, { dataTransfer: dataTransfer() });
    expect(grid.classList.contains('is-dragging')).toBe(true);
    fireEvent.dragEnd(chip);
    expect(grid.classList.contains('is-dragging')).toBe(false);
  });

  it('highlight seluruh rentang span task multi-hari (bukan 1 cell)', () => {
    mockState.tasks = [
      ...mockState.tasks,
      {
        id: '77777777-7777-4777-8777-777777777777',
        title: 'Span task',
        status: 'todo',
        priority: 'medium',
        labels: [],
        blockedBy: [],
        startDate: '2026-08-19',
        dueDate: '2026-08-20',
        description: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    renderCalendar();
    const chip = screen.getByText('Span task').closest('.due-cal-task') as HTMLElement;
    const spanTransfer = () => ({ getData: () => '77777777-7777-4777-8777-777777777777', setData: vi.fn(), effectAllowed: 'move' }) as unknown as DataTransfer;
    fireEvent.dragStart(chip, { dataTransfer: spanTransfer() });
    const c21 = document.querySelector('[data-date="2026-08-21"]') as HTMLElement;
    const c22 = document.querySelector('[data-date="2026-08-22"]') as HTMLElement;
    const c23 = document.querySelector('[data-date="2026-08-23"]') as HTMLElement;
    fireEvent.dragOver(c21, { dataTransfer: spanTransfer() });
    expect(c21.classList.contains('due-cal-cell--drop-active')).toBe(true);
    expect(c22.classList.contains('due-cal-cell--drop-active')).toBe(true);
    expect(c23.classList.contains('due-cal-cell--drop-active')).toBe(false);
    fireEvent.drop(c21, { dataTransfer: spanTransfer() });
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'task/update',
      id: '77777777-7777-4777-8777-777777777777',
      patch: { dueDate: '2026-08-22', startDate: '2026-08-21' },
    });
    expect(document.querySelector('.due-cal-cell--drop-active')).toBeNull();
  });

  it('navigates months with the prev and next buttons', () => {
    renderCalendar();
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('September 2026')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('August 2026')).toBeTruthy();
  });

  it('toggles between month and week views', () => {
    renderCalendar();
    fireEvent.click(screen.getByRole('tab', { name: 'Week' }));
    expect(document.querySelectorAll('.due-cal-cell').length).toBe(7);
    fireEvent.click(screen.getByRole('tab', { name: 'Month' }));
    expect(document.querySelectorAll('.due-cal-cell').length).toBe(42);
  });

  it('hides completed tasks when hideCompleted is set (controlled from the board toolbar)', () => {
    mockState.tasks[0]!.status = 'done';
    const { rerender } = render(
      <DueCalendar onOpenTask={vi.fn()} onQuickCreate={vi.fn()} hideCompleted={false} />,
    );
    expect(screen.getByText('Ship calendar')).toBeTruthy();
    rerender(<DueCalendar onOpenTask={vi.fn()} onQuickCreate={vi.fn()} hideCompleted />);
    expect(screen.queryByText('Ship calendar')).toBeNull();
  });

  it('caps chips at 3 per row and shows lihat yang lain', () => {
    const tasks: Task[] = Array.from({ length: 7 }, (_, i) => ({
      id: `aaaaaaa${i}-aaaa-4aaa-8aaa-aaaaaaaaaa${i}a`,
      title: `Task ${i}`,
      status: 'todo',
      priority: 'low',
      labels: [],
      blockedBy: [],
      dueDate: '2026-08-20',
      description: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }));
    mockState.tasks = tasks;
    renderCalendar();
    // only 3 visible + strip unscheduled
    const visible = document.querySelectorAll('.due-cal-span');
    expect(visible.length).toBe(3);
    expect(screen.getByText('+4 lagi')).toBeTruthy();
  });

  it('expands row height when lihat yang lain clicked', () => {
    const tasks: Task[] = Array.from({ length: 7 }, (_, i) => ({
      id: `bbbbbb${i}-bbbb-4bbb-8bbb-bbbbbbbbbbb${i}`,
      title: `Overflow task ${i}`,
      status: 'todo',
      priority: 'low',
      labels: [],
      blockedBy: [],
      dueDate: '2026-08-20',
      description: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }));
    mockState.tasks = tasks;
    renderCalendar();
    fireEvent.click(screen.getByText('+4 lagi'));
    // now all 7 visible
    expect(document.querySelectorAll('.due-cal-span').length).toBe(7);
    expect(screen.getByText('ciutkan')).toBeTruthy();
    // grid row height should have expanded
    const grid = document.querySelector('.due-cal-grid') as HTMLElement;
    expect(grid.style.gridTemplateRows).toContain('px');
    // collapse again
    fireEvent.click(screen.getByText('ciutkan'));
    expect(screen.getByText('+4 lagi')).toBeTruthy();
  });

  it('bisa drop ke cell penuh yang tertutup tombol more (pointer-events + forward)', () => {
    const mk = (id: string, title: string, dueDate: string): Task => ({
      id,
      title,
      status: 'todo',
      priority: 'low',
      labels: [],
      blockedBy: [],
      dueDate,
      description: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    mockState.tasks = [
      mk('cccccccc-cccc-4ccc-8ccc-ccccccccccc0', 'Source task', '2026-08-20'),
      ...Array.from({ length: 5 }, (_, i) =>
        mk(`ddddddd${i}-dddd-4ddd-8ddd-ddddddddddd${i}`, `Full ${i}`, '2026-08-21'),
      ),
    ];
    renderCalendar();
    // Cell penuh: tombol more ada + punya data-drop-key (jalur touch elementFromPoint).
    const more = screen.getByText('+2 lagi');
    expect(more.getAttribute('data-drop-key')).toBe('date:2026-08-21');
    const source = screen.getByText('Source task').closest('.due-cal-task') as HTMLElement;
    const target = document.querySelector('[data-date="2026-08-21"]') as HTMLElement;
    const transfer = () => ({ getData: () => 'cccccccc-cccc-4ccc-8ccc-ccccccccccc0', setData: vi.fn(), effectAllowed: 'move' }) as unknown as DataTransfer;
    fireEvent.dragStart(source, { dataTransfer: transfer() });
    fireEvent.dragOver(target, { dataTransfer: transfer() });
    expect(target.classList.contains('due-cal-cell--drop-active')).toBe(true);
    fireEvent.drop(target, { dataTransfer: transfer() });
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'task/update',
      id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc0',
      patch: { dueDate: '2026-08-21' },
    });
  });

  it('drop via tombol more langsung juga sampai (backup onDrop forward)', () => {
    const mk = (id: string, title: string, dueDate: string): Task => ({
      id,
      title,
      status: 'todo',
      priority: 'low',
      labels: [],
      blockedBy: [],
      dueDate,
      description: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    mockState.tasks = [
      mk('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee0', 'Source task', '2026-08-20'),
      ...Array.from({ length: 5 }, (_, i) =>
        mk(`ffffff${i}-ffff-4fff-8fff-fffffffffff${i}`, `Full ${i}`, '2026-08-21'),
      ),
    ];
    renderCalendar();
    const source = screen.getByText('Source task').closest('.due-cal-task') as HTMLElement;
    const transfer = () => ({ getData: () => 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee0', setData: vi.fn(), effectAllowed: 'move' }) as unknown as DataTransfer;
    fireEvent.dragStart(source, { dataTransfer: transfer() });
    fireEvent.drop(screen.getByText('+2 lagi'), { dataTransfer: transfer() });
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'task/update',
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee0',
      patch: { dueDate: '2026-08-21' },
    });
  });

  it('satu tombol ciutkan per baris + muat di slot footer dalam cell', () => {
    const mk = (id: string, title: string, dueDate: string): Task => ({
      id,
      title,
      status: 'todo',
      priority: 'low',
      labels: [],
      blockedBy: [],
      dueDate,
      description: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    mockState.tasks = [
      ...Array.from({ length: 7 }, (_, i) =>
        mk(`1111111${i}-1111-4111-8111-11111111111${i}`, `R3A ${i}`, '2026-08-20'),
      ),
      ...Array.from({ length: 7 }, (_, i) =>
        mk(`2222222${i}-2222-4222-8222-22222222222${i}`, `R3B ${i}`, '2026-08-21'),
      ),
    ];
    renderCalendar();
    // 20 & 21 Agu 2026 satu baris (Sen 17 – Min 23): dua tombol more.
    expect(screen.getAllByText('+4 lagi').length).toBe(2);
    fireEvent.click(screen.getAllByText('+4 lagi')[0]!);
    // Expand satu cell = expand sebaris: tinggal 1 tombol ciutkan.
    const collapses = screen.getAllByText('ciutkan');
    expect(collapses.length).toBe(1);
    const btn = collapses[0] as HTMLElement;
    expect(btn.getAttribute('data-drop-key')).toBeTruthy();
    // Footer math: top + 22 (tinggi tombol) + 8 (pad) <= bawah baris expanded.
    // Baris expanded terdeteksi via tinggi > 200 (collapsed=142, kosong=112).
    const grid = document.querySelector('.due-cal-grid') as HTMLElement;
    const rows = grid.style.gridTemplateRows.split(' ').map((s) => parseFloat(s));
    const expandedIdx = rows.findIndex((v) => v > 200);
    expect(expandedIdx).toBeGreaterThan(0);
    const rowTop = rows.slice(1, expandedIdx).reduce((a, b) => a + b + 1, 0);
    const top = parseFloat(btn.style.top);
    expect(top + 22 + 8).toBeLessThanOrEqual(rowTop + rows[expandedIdx]! + 0.01);
    // Collapse per baris mengembalikan kedua tombol more.
    fireEvent.click(btn);
    expect(screen.getAllByText('+4 lagi').length).toBe(2);
  });

  it('hides day chips and unscheduled tasks rejected by taskFilter', () => {
    render(
      <DueCalendar
        onOpenTask={vi.fn()}
        onQuickCreate={vi.fn()}
        taskFilter={(t) => t.assigneeId === 'u1'}
      />,
    );
    expect(screen.queryByText('Ship calendar')).toBeNull();
    expect(screen.queryByText('No date task')).toBeNull();
  });

  it('keeps day chips and unscheduled tasks accepted by taskFilter', () => {
    mockState.tasks = [
      { ...mockState.tasks[0]!, assigneeId: 'u1' },
      { ...mockState.tasks[1]!, assigneeId: 'u1' },
    ];
    render(
      <DueCalendar
        onOpenTask={vi.fn()}
        onQuickCreate={vi.fn()}
        taskFilter={(t) => t.assigneeId === 'u1'}
      />,
    );
    expect(screen.getByText('Ship calendar')).toBeTruthy();
    expect(screen.getByText('No date task')).toBeTruthy();
  });

  it('opens the month picker from the month label and jumps to the picked month', () => {
    renderCalendar();
    fireEvent.click(screen.getByRole('button', { name: /Pick month|Pilih bulan/i }));
    expect(screen.getByRole('dialog', { name: /month and year|bulan dan tahun/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Sep 2026/i }));
    expect(screen.getByText('September 2026')).toBeTruthy();
  });

  it('marks the today cell with due-cal-today (outline ring, not inset shadow)', () => {
    renderCalendar();
    const todayCell = document.querySelector('[data-date="2026-08-15"]')!;
    expect(todayCell.classList.contains('due-cal-today')).toBe(true);
    expect(todayCell.classList.contains('due-cal-cell')).toBe(true);
  });

  it('renders multi-day task spanning 25-28 as 4 cells wide', () => {
    mockState.tasks = [
      {
        id: '55555555-5555-4555-8555-555555555555',
        title: 'SS',
        status: 'todo',
        priority: 'medium',
        labels: [],
        blockedBy: [],
        dueDate: '2026-08-28',
        startDate: '2026-08-25',
        description: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    renderCalendar();
    const chip = screen.getByText('SS');
    const el = chip.closest('.due-cal-task') as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.style.position).toBe('absolute');
    expect(el.style.width).toContain('calc');
  });

  it('uses the rich Tooltip instead of a native title on chips', () => {
    renderCalendar();
    const el = screen.getByText('Ship calendar').closest('.due-cal-task') as HTMLElement;
    // Native title would double-render alongside the Tooltip card.
    expect(el.getAttribute('title')).toBeNull();
    expect(el.getAttribute('aria-label')).toMatch(/Ship calendar/);
  });

  it('shows the assignee avatar on the chip when the task is assigned', () => {
    mockState.tasks[0]!.assigneeId = 'u1';
    render(
      <DueCalendar
        onOpenTask={vi.fn()}
        onQuickCreate={vi.fn()}
        members={{ u1: { email: 'u@example.com', displayName: 'U', avatarUrl: null } }}
      />,
    );
    const el = screen.getByText('Ship calendar').closest('.due-cal-task') as HTMLElement;
    expect(within(el).getByText('U')).toBeTruthy();
    expect(el.getAttribute('aria-label')).toContain('U');
  });
});

describe('DueCalendar mobile mini layout', () => {
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
  });
  afterEach(() => {
    window.matchMedia = realMatchMedia;
  });

  it('shows month nav only (no Today button, no month/week toggle)', () => {
    renderCalendar();
    expect(document.querySelector('.due-cal--mobile')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Today' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Month' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Week' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeTruthy();
  });

  it('shows a bottom primary add button instead of the header add', () => {
    const { onQuickCreate } = renderCalendar();
    const add = screen.getByRole('button', { name: 'Task' });
    expect(add.className).toContain('due-cal-mini-add');
    expect(add.className).toContain('btn-primary');
    fireEvent.click(add);
    expect(onQuickCreate).toHaveBeenCalledWith('2026-08-15');
  });

  it('selects a date on tap and lists its tasks below', () => {
    renderCalendar();
    expect(screen.queryByText('Ship calendar')).toBeNull();
    fireEvent.click(document.querySelector('[data-date="2026-08-20"]')!);
    expect(screen.getByText('Ship calendar')).toBeTruthy();
  });

  it('hides per-cell + on coarse mobile (only bottom add remains)', () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('640px') || query.includes('coarse'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    renderCalendar();
    expect(document.querySelector('.due-cal--mobile')).toBeTruthy();
    expect(document.querySelector('.due-cal-quickadd')).toBeNull();
    expect(screen.getByRole('button', { name: 'Task' }).className).toContain('due-cal-mini-add');
  });

  it('renders full TaskCards (not mini-cards) for the selected date', () => {
    renderCalendar();
    fireEvent.click(document.querySelector('[data-date="2026-08-20"]')!);
    expect(document.querySelector('.due-cal-mini-card')).toBeNull();
    const card = document.querySelector('.due-cal-mini-cards [data-testid="task-card"]');
    expect(card).toBeTruthy();
    expect(card?.classList.contains('task-card--compact')).toBe(false);
    expect(card?.getAttribute('draggable')).toBe('false');
  });

  it('shows short empty text without repeating the date on mobile', () => {
    renderCalendar();
    expect(screen.queryByText('Tasks dropped on this day appear here.')).toBeNull();
    expect(screen.queryByText('Task yang diletakkan pada hari ini akan muncul di sini.')).toBeNull();
    expect(screen.queryByText('No tasks in Saturday, August 15, 2026')).toBeNull();
  });

  it('renders NO DATE strip with full TaskCards and no drop keys on mobile', () => {
    renderCalendar();
    const strip = document.querySelector('#due-cal-strip');
    expect(strip).toBeTruthy();
    expect(strip?.hasAttribute('data-drop-key')).toBe(false);
    expect(document.querySelector('#due-cal-strip .due-cal-task')).toBeNull();
    expect(screen.queryByText('Drop tasks here to clear their due date')).toBeNull();
  });
});
