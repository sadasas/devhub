import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { State } from '../../lib/types';
import { NewTaskModal } from './NewTaskModal';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  setStatus: vi.fn(),
}));

vi.mock('../../state/project-context', () => ({
  useProject: () => ({
    state: mockState,
    dispatch: mocks.dispatch,
    canEdit: true,
    setStatus: mocks.setStatus,
    projectId: mockCtx.projectId,
    teamId: mockCtx.teamId,
  }),
}));

const MILESTONE_A = '44444444-4444-4444-8444-444444444444';
const MILESTONE_B = '99999999-9999-4999-8999-999999999999';

function makeState(milestones: State['milestones']): State {
  return {
    tasks: [],
    issues: [],
    testCases: [],
    techEntries: [],
    tables: [],
    relations: [],
    schemaVersions: [],
    decisions: [],
    milestones,
    apiCollections: [],
    apiEndpoints: [],
    whiteboards: [],
  };
}

let mockState: State;
let mockCtx: { projectId?: string; teamId?: string } = {};

function renderModal(props: Partial<React.ComponentProps<typeof NewTaskModal>> = {}) {
  return render(
    <MemoryRouter>
      <NewTaskModal open status={null} onClose={() => {}} {...props} />
    </MemoryRouter>,
  );
}

describe('NewTaskModal milestone picker', () => {
  beforeEach(() => {
    mocks.dispatch.mockReset();
    mockCtx = {};
    mockState = makeState([
      { id: MILESTONE_A, name: 'V0.2.0', version: '0.2.0', status: 'planned', changelog: '', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
      { id: MILESTONE_B, name: 'V0.3.0', version: '0.3.0', status: 'planned', changelog: '', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a milestone select when milestones exist', () => {
    renderModal();
    expect(screen.getByLabelText('Milestone')).toBeTruthy();
  });

  it('omits the milestone select when there are no milestones', () => {
    mockState = makeState([]);
    renderModal();
    expect(screen.queryByLabelText('Milestone')).not.toBeTruthy();
  });

  it('preselects the milestone passed from the By Milestone view', () => {
    renderModal({ milestoneId: MILESTONE_A });
    expect(screen.getByLabelText('Milestone').textContent).toContain('V0.2.0');
  });

  it('shows the property label on empty pills and the value once set', () => {
    renderModal({ milestoneId: MILESTONE_A });
    expect(screen.getByRole('button', { name: 'Assignee' })).toBeTruthy();
    expect(screen.getByLabelText('Milestone').textContent).toContain('V0.2.0');
  });

  it('opens the input popup directly from the estimate pill', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /Estimate \(hours\)/ }));
    expect(screen.getByRole('dialog', { name: /Estimate \(hours\)/ })).toBeTruthy();
  });

  it('submits numeric estimate from the popup input', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Ship calendar' } });
    fireEvent.click(screen.getByRole('button', { name: /Estimate \(hours\)/ }));
    fireEvent.change(screen.getByRole('spinbutton', { name: /Estimate \(hours\)/ }), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'task/add',
        task: expect.objectContaining({ estimate: 8 }),
      }),
    );
  });

  it('toggles fullscreen via the expand button and Ctrl+Shift+F', () => {
    renderModal();
    expect(document.querySelector('.modal-composer--fullscreen')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Expand to fullscreen' }));
    expect(document.querySelector('.modal-composer--fullscreen')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'F', ctrlKey: true, shiftKey: true });
    expect(document.querySelector('.modal-composer--fullscreen')).toBeNull();
  });

  it('dispatches task/add with the chosen milestone', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Ship calendar' } });
    fireEvent.click(screen.getByRole('button', { name: /Milestone/ }));
    fireEvent.click(screen.getByRole('option', { name: /V0\.3\.0/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'task/add',
        task: expect.objectContaining({ title: 'Ship calendar', milestoneId: MILESTONE_B }),
      }),
    );
  });

  it('dispatches task/add with the range picked from the date picker', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Ship calendar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Date' }));
    const now = new Date();
    const iso = (day: number) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    fireEvent.click(screen.getByRole('button', { name: iso(10) }));
    fireEvent.click(screen.getByRole('button', { name: iso(20) }));
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'task/add',
        task: expect.objectContaining({ title: 'Ship calendar', startDate: iso(10), dueDate: iso(20) }),
      }),
    );
  });

  it('sends a null due date when left empty', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Ship calendar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'task/add',
        task: expect.objectContaining({ dueDate: null }),
      }),
    );
  });

  it('sends a null start date when left empty', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Ship calendar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'task/add',
        task: expect.objectContaining({ startDate: null }),
      }),
    );
  });

  it('normalizes a backwards range pick without warning', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Ship calendar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Date' }));
    const now = new Date();
    const iso = (day: number) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    fireEvent.click(screen.getByRole('button', { name: iso(20) }));
    fireEvent.click(screen.getByRole('button', { name: iso(10) }));
    expect(screen.queryByText('Start date is after the due date.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'task/add',
        task: expect.objectContaining({ startDate: iso(10), dueDate: iso(20) }),
      }),
    );
  });

  it('prefills start and due dates passed from the calendar click', () => {
    renderModal({ startDate: '2026-09-08', dueDate: '2026-09-08' });
    // Pill no longer shows the empty "Date" label.
    expect(screen.queryByRole('button', { name: 'Date' })).toBeNull();
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Calendar task' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'task/add',
        task: expect.objectContaining({ title: 'Calendar task', startDate: '2026-09-08', dueDate: '2026-09-08' }),
      }),
    );
  });

  it('keeps no milestone when the None option is chosen', () => {
    renderModal({ milestoneId: MILESTONE_A });
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Ship calendar' } });
    fireEvent.click(screen.getByRole('button', { name: /Milestone/ }));
    fireEvent.click(screen.getByRole('option', { name: 'None' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'task/add',
        task: expect.objectContaining({ milestoneId: null }),
      }),
    );
  });
});

describe('NewTaskModal staged attachments', () => {
  beforeEach(() => {
    mocks.dispatch.mockReset();
    mockCtx = { projectId: 'p1', teamId: 't1' };
    mockState = makeState([]);
  });

  afterEach(() => {
    mockCtx = {};
    vi.restoreAllMocks();
  });

  it('hides the section without project context', () => {
    mockCtx = {};
    renderModal();
    expect(screen.queryByText(/Files upload now, attached when you save/)).toBeNull();
  });

  it('stages a link and includes it in task/add on submit', () => {
    renderModal();
    expect(screen.getByText(/Files upload now, attached when you save/)).toBeDefined();
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Task with link' } });
    fireEvent.click(screen.getByRole('button', { name: /Add attachment/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Add link/ }));
    fireEvent.change(screen.getByLabelText(/Link name/), { target: { value: 'Spec' } });
    fireEvent.change(screen.getByLabelText('Link URL'), { target: { value: 'https://example.com/s.pdf' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Spec')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'task/add',
        task: expect.objectContaining({
          title: 'Task with link',
          attachments: [
            expect.objectContaining({ provider: 'link', name: 'Spec', url: 'https://example.com/s.pdf' }),
          ],
        }),
      }),
    );
  });
});