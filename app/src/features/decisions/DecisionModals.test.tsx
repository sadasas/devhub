import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { Flag } from '@phosphor-icons/react';
import type { Decision, State } from '../../lib/types';
import { CONCEPT_ICON } from '../../components/propertyIcons';
import { DecisionModal } from './DecisionModal';
import { NewDecisionModal } from './NewDecisionModal';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  setStatus: vi.fn(),
  fetchActivity: vi.fn(),
}));

vi.mock('../../state/project-context', () => ({
  useProject: () => ({
    state: mockState,
    dispatch: mocks.dispatch,
    canEdit: true,
    projectId: 'p1',
    saving: false,
    lastSavedAt: null,
    setStatus: mocks.setStatus,
  }),
}));

vi.mock('../../lib/api', () => ({
  api: { fetchActivity: mocks.fetchActivity },
}));

function makeDecision(over: Partial<Decision> = {}): Decision {
  return {
    id: 'd1',
    title: 'Use Postgres',
    status: 'proposed',
    date: '2026-01-15',
    context: 'ctx',
    options: ['Postgres', 'MySQL'],
    decision: 'Pick Postgres',
    consequences: 'Migrate later',
    milestoneId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function makeState(decisions: Decision[] = [makeDecision()]): State {
  return {
    tasks: [],
    issues: [],
    testCases: [],
    techEntries: [],
    tables: [],
    relations: [],
    schemaVersions: [],
    decisions,
    milestones: [],
    apiCollections: [],
    apiEndpoints: [],
    whiteboards: [],
  };
}

let mockState: State;

describe('Decision modals smoke', () => {
  beforeEach(() => {
    mocks.dispatch.mockReset();
    mocks.setStatus.mockClear();
    mocks.fetchActivity.mockReset();
    mocks.fetchActivity.mockResolvedValue([]);
    mockState = makeState();
  });

  it('edits the title via the autogrow textarea', () => {
    render(<MemoryRouter><DecisionModal decisionId="d1" onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Use Postgres v2' } });
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'decision/update',
      id: 'd1',
      patch: { title: 'Use Postgres v2' },
    });
  });

  it('picks a single date from the DatePicker and closes', () => {
    render(<MemoryRouter><DecisionModal decisionId="d1" onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(document.querySelector('[data-prop="date"] .prop-view') as Element);
    expect(screen.getByRole('dialog', { name: 'Choose date' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '2026-01-20' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(mocks.dispatch).toHaveBeenCalledWith({
      type: 'decision/update',
      id: 'd1',
      patch: { date: '2026-01-20' },
    });
    expect(screen.queryByRole('dialog', { name: 'Choose date' })).toBeNull();
  });

  it('submits a new decision with the picked single date', () => {
    render(<MemoryRouter><NewDecisionModal onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Use Redis' } });
    fireEvent.click(document.querySelector('[data-prop="date"]') as Element);
    const now = new Date();
    const iso = (day: number) =>
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    fireEvent.click(screen.getByRole('button', { name: iso(15) }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add decision' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'decision/add',
        decision: expect.objectContaining({ title: 'Use Redis', date: iso(15) }),
      }),
    );
  });

  it('renders the status pill without a dot', () => {
    render(<MemoryRouter><DecisionModal decisionId="d1" onClose={vi.fn()} /></MemoryRouter>);
    const pill = document.querySelector('[data-prop="status"] .prop-view > span');
    expect(pill).toBeTruthy();
    expect(pill?.textContent).toContain('Proposed');
    expect(pill?.querySelector('span')).toBeNull();
  });

  it('renders the milestone row with a label column and plain text', () => {
    expect(CONCEPT_ICON.milestone).toBe(Flag);
    render(<MemoryRouter><DecisionModal decisionId="d1" onClose={vi.fn()} /></MemoryRouter>);
    const row = document.querySelector('[data-prop="milestone"]');
    expect(row).toBeTruthy();
    expect(row?.querySelector('.prop-label')).toBeTruthy();
    expect(row?.querySelector('.prop-ic')).toBeNull();
    const viewSpan = row?.querySelector('.prop-view > span');
    expect(viewSpan).toBeTruthy();
    const style = viewSpan?.getAttribute('style') ?? '';
    expect(style).not.toContain('border');
    expect(style).not.toContain('background');
  });

  it('defaults new status to empty label and falls back to proposed on submit', () => {
    render(<MemoryRouter><NewDecisionModal onClose={vi.fn()} /></MemoryRouter>);
    // Pill kosong tampil label (triggerEmptyLabel).
    const pill = screen.getByLabelText('Status');
    expect(pill.textContent).toContain('Status');
    expect(screen.getByRole('button', { name: 'Status' })).toBeTruthy();
    // searchable=false → buka pill, tidak ada combobox, langsung option.
    fireEvent.click(screen.getByRole('button', { name: 'Status' }));
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByRole('option', { name: 'Proposed' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Status' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Use Redis' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add decision' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'decision/add',
        decision: expect.objectContaining({ title: 'Use Redis', status: 'proposed' }),
      }),
    );
  });

  it('picks status via pill then option and submits chosen value', () => {
    render(<MemoryRouter><NewDecisionModal onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Use Redis' } });
    fireEvent.click(screen.getByRole('button', { name: 'Status' }));
    expect(screen.queryByRole('combobox')).toBeNull();
    fireEvent.click(screen.getByRole('option', { name: 'Accepted' }));
    expect(screen.getByLabelText('Status').textContent).toContain('Accepted');
    fireEvent.click(screen.getByRole('button', { name: 'Add decision' }));
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'decision/add',
        decision: expect.objectContaining({ title: 'Use Redis', status: 'accepted' }),
      }),
    );
  });
});
