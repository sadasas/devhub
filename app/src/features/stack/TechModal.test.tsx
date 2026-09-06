import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { State, TechEntry } from '../../lib/types';
import { TechModal } from './TechModal';

const { setStatusMock, fetchActivityMock, canEditMock, saveMock } = vi.hoisted(() => ({
  setStatusMock: vi.fn(),
  fetchActivityMock: vi.fn(),
  canEditMock: { value: true },
  saveMock: { saving: false, lastSavedAt: null as number | null },
}));

vi.mock('../../state/project-context', () => ({
  useProject: () => ({
    state: mockState,
    dispatch: mockDispatch,
    canEdit: canEditMock.value,
    projectId: 'p1',
    saving: saveMock.saving,
    lastSavedAt: saveMock.lastSavedAt,
    setStatus: setStatusMock,
  }),
}));

vi.mock('../../lib/api', () => ({
  api: { fetchActivity: fetchActivityMock },
}));

const ENTRY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function makeEntry(over: Partial<TechEntry> = {}): TechEntry {
  return {
    id: ENTRY_ID,
    name: 'React',
    version: '19.0.0',
    category: 'frontend',
    status: 'current',
    notes: 'UI lib',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function makeState(): State {
  return {
    tasks: [],
    issues: [],
    testCases: [],
    techEntries: [makeEntry()],
    tables: [],
    relations: [],
    schemaVersions: [],
    decisions: [],
    milestones: [],
    apiCollections: [],
    apiEndpoints: [],
    whiteboards: [],
  };
}

let mockState: State;
const mockDispatch = vi.fn();

describe('TechModal composer', () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    canEditMock.value = true;
    saveMock.saving = false;
    saveMock.lastSavedAt = null;
    setStatusMock.mockClear();
    fetchActivityMock.mockReset();
    fetchActivityMock.mockResolvedValue([]);
    mockState = makeState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders DetailShell with sidebar props and composer main', () => {
    render(<MemoryRouter><TechModal entryId={ENTRY_ID} onClose={vi.fn()} /></MemoryRouter>);
    // Sidebar PropRows
    expect(document.querySelector('[data-prop="category"]')).toBeTruthy();
    expect(document.querySelector('[data-prop="status"]')).toBeTruthy();
    expect(document.querySelector('[data-prop="version"]')).toBeTruthy();
    // Main: name autogrow + notes bare field (non-empty notes shows preview)
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Notes' })).toBeTruthy();
    expect(screen.getByText('UI lib')).toBeTruthy();
    // Pills + footer
    expect(screen.getByRole('button', { name: 'Frontend' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Current' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
    expect(document.querySelector('.detail-grid')).toBeTruthy();
    // i18n: pinjaman tracker ter-render, bukan raw key
    expect(screen.queryByText(/board\.taskModal/)).toBeNull();
    expect(screen.queryByText(/issues\.modal/)).toBeNull();
    expect(screen.getByText('Properties')).toBeTruthy();
    expect(screen.getByText('Created time')).toBeTruthy();
    // Badge tanpa dot 6px, teks + warna tetap
    expect(document.querySelector('[data-prop="category"] span[style*="width: 6px"]')).toBeNull();
    expect(document.querySelector('[data-prop="status"] span[style*="width: 6px"]')).toBeNull();
    // Created time tepat di bawah name (di atas notes)
    const main = document.querySelector('.detail-main');
    expect(main).toBeTruthy();
    const createdIdx = Array.from(main!.children).findIndex((el) => el.textContent?.includes('Created time'));
    const notesIdx = Array.from(main!.children).findIndex((el) => el.textContent?.includes('Notes'));
    expect(createdIdx).toBeGreaterThanOrEqual(0);
    expect(notesIdx).toBeGreaterThan(createdIdx);
  });

  it('autosaves name and filters version input on blur commit', () => {
    render(<MemoryRouter><TechModal entryId={ENTRY_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'React 19' } });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'tech/update',
      id: ENTRY_ID,
      patch: { name: 'React 19' },
    });
    mockDispatch.mockClear();
    fireEvent.click(screen.getByRole('button', { name: '19.0.0' }));
    const versionInput = screen.getByRole('textbox', { name: 'Version' });
    fireEvent.change(versionInput, { target: { value: '19x.2a' } });
    // Belum dispatch sebelum blur/Enter
    expect(mockDispatch).not.toHaveBeenCalled();
    fireEvent.blur(versionInput);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'tech/update',
      id: ENTRY_ID,
      patch: { version: '19.2' },
    });
  });

  it('cancels version popup on Escape without dispatch', () => {
    render(<MemoryRouter><TechModal entryId={ENTRY_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: '19.0.0' }));
    const versionInput = screen.getByRole('textbox', { name: 'Version' });
    fireEvent.change(versionInput, { target: { value: '9x' } });
    fireEvent.keyDown(versionInput, { key: 'Escape' });
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: 'Version' })).toBeNull();
  });

  it('commits version popup on Enter with filter', () => {
    render(<MemoryRouter><TechModal entryId={ENTRY_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: '19.0.0' }));
    const versionInput = screen.getByRole('textbox', { name: 'Version' });
    fireEvent.change(versionInput, { target: { value: '20a.1b' } });
    fireEvent.keyDown(versionInput, { key: 'Enter' });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'tech/update',
      id: ENTRY_ID,
      patch: { version: '20.1' },
    });
  });

  it('picks category and status from searchable=false selects in one click', () => {
    render(<MemoryRouter><TechModal entryId={ENTRY_ID} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Frontend' }));
    fireEvent.click(screen.getByRole('option', { name: 'Backend' }));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'tech/update',
      id: ENTRY_ID,
      patch: { category: 'backend' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Current' }));
    fireEvent.click(screen.getByRole('option', { name: 'Major upgrade' }));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'tech/update',
      id: ENTRY_ID,
      patch: { status: 'majorUpgrade' },
    });
  });

  it('renders plain values without controls when read-only', () => {
    canEditMock.value = false;
    render(<MemoryRouter><TechModal entryId={ENTRY_ID} onClose={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText('React')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Name' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Frontend' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.getByText('UI lib')).toBeTruthy();
  });

  it('shows version label when version is empty (not dash)', () => {
    mockState.techEntries = [makeEntry({ version: '' })];
    render(<MemoryRouter><TechModal entryId={ENTRY_ID} onClose={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText('Version')).toBeTruthy();
    expect(screen.queryByText(/board\.taskModal/)).toBeNull();
    expect(screen.queryByText(/issues\.modal/)).toBeNull();
  });

  it('renders translated autosave and properties labels (no raw keys)', () => {
    saveMock.saving = true;
    const { unmount } = render(<MemoryRouter><TechModal entryId={ENTRY_ID} onClose={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText('Saving…')).toBeTruthy();
    expect(screen.queryByText(/board\.taskModal/)).toBeNull();
    unmount();
    saveMock.saving = false;
    saveMock.lastSavedAt = Date.now();
    render(<MemoryRouter><TechModal entryId={ENTRY_ID} onClose={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText('All changes saved')).toBeTruthy();
    expect(screen.getByText('Properties')).toBeTruthy();
    expect(screen.getByText('Created time')).toBeTruthy();
    expect(screen.queryByText(/board\.taskModal/)).toBeNull();
    expect(screen.queryByText(/issues\.modal/)).toBeNull();
  });
});
