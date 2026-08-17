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
  useProject: () => ({ state: mockState, dispatch: mocks.dispatch, canEdit: true, setStatus: mocks.setStatus }),
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

  it('dispatches task/add with the chosen milestone', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: 'Ship calendar' } });
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

  it('dispatches task/add with the chosen due date', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: 'Ship calendar' } });
    fireEvent.change(screen.getByLabelText(/Due date/), { target: { value: '2026-08-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'task/add',
        task: expect.objectContaining({ title: 'Ship calendar', dueDate: '2026-08-20' }),
      }),
    );
  });

  it('sends a null due date when left empty', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: 'Ship calendar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'task/add',
        task: expect.objectContaining({ dueDate: null }),
      }),
    );
  });

  it('dispatches task/add with the chosen start date', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: 'Ship calendar' } });
    fireEvent.change(screen.getByLabelText(/Start date/), { target: { value: '2026-08-14' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'task/add',
        task: expect.objectContaining({ title: 'Ship calendar', startDate: '2026-08-14' }),
      }),
    );
  });

  it('sends a null start date when left empty', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: 'Ship calendar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'task/add',
        task: expect.objectContaining({ startDate: null }),
      }),
    );
  });

  it('warns when the start date is after the due date', () => {
    renderModal();
    fireEvent.change(screen.getByLabelText(/Due date/), { target: { value: '2026-08-14' } });
    fireEvent.change(screen.getByLabelText(/Start date/), { target: { value: '2026-08-20' } });
    expect(screen.getByText('Start date is after the due date.')).toBeTruthy();
  });

  it('keeps no milestone when the None option is chosen', () => {
    renderModal({ milestoneId: MILESTONE_A });
    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: 'Ship calendar' } });
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