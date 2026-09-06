import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { State } from '../../lib/types';
import { NewTechModal } from './NewTechModal';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  setStatus: vi.fn(),
}));

vi.mock('../../state/project-context', () => ({
  useProject: () => ({ state: mockState, dispatch: mocks.dispatch, setStatus: mocks.setStatus }),
}));

function makeState(): State {
  return {
    tasks: [],
    issues: [],
    testCases: [],
    techEntries: [],
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

describe('NewTechModal composer', () => {
  beforeEach(() => {
    mocks.dispatch.mockReset();
    mockState = makeState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders composer title, notes and propbar', () => {
    render(<MemoryRouter><NewTechModal open onClose={() => {}} /></MemoryRouter>);
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Notes' })).toBeTruthy();
    expect(document.querySelector('[data-prop="category"]')).toBeTruthy();
    expect(document.querySelector('[data-prop="status"]')).toBeTruthy();
    expect(document.querySelector('[data-prop="version"]')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add entry' })).toBeTruthy();
    // SearchableSelect triggers (label opsi dari sumber yang sama)
    expect(screen.getByRole('button', { name: 'Category' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Status' })).toBeTruthy();
    // i18n: tidak ada raw key pinjaman
    expect(screen.queryByText(/board\.taskModal/)).toBeNull();
    expect(screen.queryByText(/issues\.modal/)).toBeNull();
    // Version kosong tampilkan label, bukan dash
    expect(screen.getByRole('button', { name: 'Version' })).toBeTruthy();
  });

  it('disables submit until name is filled and sends filtered payload', () => {
    const onClose = vi.fn();
    render(<MemoryRouter><NewTechModal open onClose={onClose} /></MemoryRouter>);
    expect((screen.getByRole('button', { name: 'Add entry' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: '  React  ' } });
    // Version via popup angka: buka, ketik terfilter, blur commit
    fireEvent.click(screen.getByRole('button', { name: 'Version' }));
    const versionInput = screen.getByRole('textbox', { name: 'Version' });
    fireEvent.change(versionInput, { target: { value: '19x.2a' } });
    fireEvent.blur(versionInput);
    // Category via SearchableSelect
    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    fireEvent.click(screen.getByRole('option', { name: 'Backend' }));
    // Status via SearchableSelect
    fireEvent.click(screen.getByRole('button', { name: 'Status' }));
    fireEvent.click(screen.getByRole('option', { name: 'Major upgrade' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Notes' }), { target: { value: '  UI lib  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add entry' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tech/add',
        entry: expect.objectContaining({
          name: 'React',
          version: '19.2',
          category: 'backend',
          status: 'majorUpgrade',
          notes: 'UI lib',
        }),
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('defaults status to empty label and falls back to current on submit', () => {
    const onClose = vi.fn();
    render(<MemoryRouter><NewTechModal open onClose={onClose} /></MemoryRouter>);
    // Pill kosong tampil label Status (SearchableSelect triggerEmptyLabel)
    const statusTrigger = screen.getByRole('button', { name: 'Status' });
    expect(statusTrigger.textContent).toContain('Status');
    expect(screen.getByRole('button', { name: 'Version' })).toBeTruthy();
    expect(screen.queryByText(/board\.taskModal/)).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Redis' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add entry' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tech/add',
        entry: expect.objectContaining({ name: 'Redis', status: 'current' }),
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('commits version popup on blur with filter and cancels on Escape', () => {
    render(<MemoryRouter><NewTechModal open onClose={() => {}} /></MemoryRouter>);
    // Buka popup, ketik, blur -> pill terfilter
    fireEvent.click(screen.getByRole('button', { name: 'Version' }));
    const input = screen.getByRole('textbox', { name: 'Version' });
    fireEvent.change(input, { target: { value: '19x.2a' } });
    fireEvent.blur(input);
    expect(screen.getByRole('button', { name: '19.2' })).toBeTruthy();
    // Buka lagi, ketik, Escape -> pill tak berubah, popup tutup
    fireEvent.click(screen.getByRole('button', { name: '19.2' }));
    const input2 = screen.getByRole('textbox', { name: 'Version' });
    fireEvent.change(input2, { target: { value: '9x' } });
    fireEvent.keyDown(input2, { key: 'Escape' });
    expect(screen.getByRole('button', { name: '19.2' })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Version' })).toBeNull();
  });
});
