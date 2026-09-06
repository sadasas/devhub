import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { State } from '../../lib/types';
import { NewMilestoneModal } from './NewMilestoneModal';

const { setStatusMock } = vi.hoisted(() => ({
  setStatusMock: vi.fn(),
}));

vi.mock('../../state/project-context', () => ({
  useProject: () => ({ state: mockState, dispatch: mockDispatch, canEdit: true, projectId: 'p1', teamId: 'team1', setStatus: setStatusMock }),
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
const mockDispatch = vi.fn();

function renderModal(onClose: () => void = () => {}) {
  return render(
    <MemoryRouter><NewMilestoneModal onClose={onClose} /></MemoryRouter>,
  );
}

describe('NewMilestoneModal', () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    setStatusMock.mockClear();
    mockState = makeState();
  });

  it('renders the composer with Create disabled until a name is entered', () => {
    renderModal();
    expect(screen.getByLabelText('Name')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Version' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Target date' })).toBeTruthy();
    expect(screen.getByLabelText('Changelog')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Add milestone' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Public beta' } });
    expect((screen.getByRole('button', { name: 'Add milestone' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('opens the version popup panel from the pill activator', () => {
    renderModal();
    expect(screen.queryByRole('dialog', { name: 'Version' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Version' }));
    const dialog = screen.getByRole('dialog', { name: 'Version' });
    expect(dialog).toBeTruthy();
    expect(dialog.classList.contains('prop-pop')).toBe(true);
    expect(screen.getByRole('textbox', { name: 'Version' })).toBeTruthy();
  });

  it('cancels the version popup on Escape without saving the draft', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Version' }));
    const input = screen.getByRole('textbox', { name: 'Version' });
    fireEvent.change(input, { target: { value: '9.9.9' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Version' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Public beta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add milestone' }));
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'milestone/add',
        milestone: expect.objectContaining({ version: null }),
      }),
    );
  });

  it('picks a single target date from the picker popup', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Target date' }));
    expect(screen.getByRole('dialog', { name: 'Choose date' })).toBeTruthy();
    const now = new Date();
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
    fireEvent.click(screen.getByRole('button', { name: iso }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.queryByRole('dialog', { name: 'Choose date' })).toBeNull();
    expect(screen.getByRole('button', { name: /2026/ })).toBeTruthy();
  });

  it('submits milestone/add with normalized payload', () => {
    const onClose = vi.fn();
    renderModal(onClose);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Public beta  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Version' }));
    const versionInput = screen.getByRole('textbox', { name: 'Version' });
    fireEvent.change(versionInput, { target: { value: 'v1.2.0' } });
    fireEvent.blur(versionInput);
    fireEvent.change(screen.getByLabelText('Changelog'), { target: { value: '  - shipped x  ' } });
    const now = new Date();
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
    fireEvent.click(screen.getByRole('button', { name: 'Target date' }));
    fireEvent.click(screen.getByRole('button', { name: iso }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    fireEvent.click(screen.getByLabelText('Status'));
    fireEvent.click(screen.getByRole('option', { name: 'In progress' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add milestone' }));
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'milestone/add',
        milestone: expect.objectContaining({
          name: 'Public beta',
          version: '1.2.0',
          targetDate: iso,
          status: 'inProgress',
          changelog: '- shipped x',
        }),
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('sends null version and targetDate when left empty', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Public beta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add milestone' }));
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'milestone/add',
        milestone: expect.objectContaining({ version: null, targetDate: null, status: 'planned' }),
      }),
    );
  });
});
