import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Milestone, State } from '../../lib/types';
import { MilestoneModal } from './MilestoneModal';

const { setStatusMock } = vi.hoisted(() => ({
  setStatusMock: vi.fn(),
}));

vi.mock('../../state/project-context', () => ({
  useProject: () => ({ state: mockState, dispatch: mockDispatch, canEdit: true, projectId: 'p1', teamId: 'team1', setStatus: setStatusMock }),
}));

const MILESTONE_ID = '44444444-4444-4444-8444-444444444444';

function makeMilestone(over: Partial<Milestone> = {}): Milestone {
  return {
    id: MILESTONE_ID,
    name: 'Public beta',
    version: '0.1.0',
    targetDate: null,
    status: 'planned',
    changelog: '- initial',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

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
    milestones: [makeMilestone()],
    apiCollections: [],
    apiEndpoints: [],
    whiteboards: [],
  };
}

let mockState: State;
const mockDispatch = vi.fn();

function renderModal(onClose: () => void = () => {}) {
  return render(
    <MemoryRouter><MilestoneModal milestoneId={MILESTONE_ID} onClose={onClose} /></MemoryRouter>,
  );
}

describe('MilestoneModal', () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    setStatusMock.mockClear();
    mockState = makeState();
  });

  it('renders name, status, date and changelog controls', () => {
    renderModal();
    expect((screen.getByLabelText('Name') as HTMLTextAreaElement).value).toBe('Public beta');
    expect(screen.getByRole('button', { name: 'Planned' })).toBeTruthy();
    expect(document.querySelector('[data-prop="targetDate"]')?.textContent).toContain('—');
    expect(document.querySelector('[data-prop="version"]')).toBeTruthy();
    expect(screen.getByRole('button', { name: '0.1.0' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Changelog' }));
    expect((screen.getByLabelText('Changelog') as HTMLTextAreaElement).value).toBe('- initial');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
  });

  it('dispatches milestone/update when the name is edited', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Public beta 2' } });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'milestone/update',
      id: MILESTONE_ID,
      patch: { name: 'Public beta 2' },
    });
  });

  it('edits version from the sidebar popup and filters non-numeric input', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: '0.1.0' }));
    expect(screen.getByRole('dialog', { name: 'Version' })).toBeTruthy();
    const input = screen.getByRole('textbox', { name: 'Version' }) as HTMLInputElement;
    expect(input.getAttribute('maxlength') ?? input.getAttribute('maxLength')).toBe('100');
    fireEvent.change(input, { target: { value: '1x.2a' } });
    fireEvent.blur(input);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'milestone/update',
      id: MILESTONE_ID,
      patch: { version: '1.2' },
    });
  });

  it('opens the version popup panel from the sidebar activator', () => {
    renderModal();
    expect(screen.queryByRole('dialog', { name: 'Version' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '0.1.0' }));
    const dialog = screen.getByRole('dialog', { name: 'Version' });
    expect(dialog).toBeTruthy();
    expect(dialog.classList.contains('prop-pop')).toBe(true);
    expect(screen.getByRole('textbox', { name: 'Version' })).toBeTruthy();
  });

  it('cancels the version edit on Escape without dispatching', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: '0.1.0' }));
    const input = screen.getByRole('textbox', { name: 'Version' });
    fireEvent.change(input, { target: { value: '9.9.9' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(mockDispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'milestone/update', patch: expect.objectContaining({ version: '9.9.9' }) }),
    );
    expect(screen.queryByRole('dialog', { name: 'Version' })).toBeNull();
  });

  it('shows a dash with a label column when version is empty', () => {
    mockState = makeState();
    mockState.milestones = [makeMilestone({ version: null })];
    renderModal();
    expect(document.querySelector('[data-prop="version"] .prop-label')?.textContent).toBe('Version');
    expect(document.querySelector('[data-prop="version"] .prop-view')?.textContent).toContain('—');
  });

  it('picks a single target date and closes the picker', () => {
    renderModal();
    fireEvent.click(document.querySelector('[data-prop="targetDate"] .prop-view') as Element);
    expect(screen.getByRole('dialog', { name: 'Choose date' })).toBeTruthy();
    const now = new Date();
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
    fireEvent.click(screen.getByRole('button', { name: iso }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'milestone/update',
      id: MILESTONE_ID,
      patch: { targetDate: iso },
    });
    expect(screen.queryByRole('dialog', { name: 'Choose date' })).toBeNull();
  });

  it('changes status from the sidebar select', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Planned' }));
    fireEvent.click(screen.getByRole('option', { name: 'Released' }));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'milestone/update',
      id: MILESTONE_ID,
      patch: { status: 'released' },
    });
    expect(document.querySelector('#milestone-status')).toBeNull();
  });

  it('reverts edits on Cancel and shows the original value when reopened', () => {
    const onClose = vi.fn();
    const { unmount } = renderModal(onClose);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Renamed draft' } });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'milestone/update',
      id: MILESTONE_ID,
      patch: { name: 'Renamed draft' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    // Cancel me-revert snapshot via replace — state kembali seperti saat modal dibuka.
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'replace', state: mockState });
    expect(onClose).toHaveBeenCalled();
    unmount();
    // Buka lagi: nilai kembali ke semula (mock state tak pernah termutasi karena dispatch di-mock).
    renderModal();
    expect((screen.getByLabelText('Name') as HTMLTextAreaElement).value).toBe('Public beta');
  });

  it('closes on Done without reverting', () => {
    const onClose = vi.fn();
    renderModal(onClose);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Renamed draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'replace' }));
  });
});
