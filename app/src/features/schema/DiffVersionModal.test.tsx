import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { SchemaVersion } from '../../lib/types';
import { DiffVersionModal } from './DiffVersionModal';

vi.mock('../../state/project-context', () => ({
  useProject: () => ({ setStatus: vi.fn() }),
}));

const V1 = '11111111-1111-4111-8111-111111111111';
const V2 = '22222222-2222-4222-8222-222222222222';
const V3 = '33333333-3333-4333-8333-333333333333';

function makeVersion(over: Partial<SchemaVersion>): SchemaVersion {
  return {
    id: V1,
    version: '1.0.0',
    appliedAt: '2026-08-01T00:00:00.000Z',
    notes: 'Initial schema',
    snapshot: { tables: [], relations: [] },
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

describe('DiffVersionModal version selects', () => {
  it('lists all snapshot versions in both selects', () => {
    render(
      <MemoryRouter>
        <DiffVersionModal
          open
          onClose={vi.fn()}
          versions={[
            makeVersion({ id: V1, version: '1.0.0', appliedAt: '2026-08-01T00:00:00.000Z' }),
            makeVersion({ id: V2, version: '1.1.0', appliedAt: '2026-08-02T00:00:00.000Z' }),
            makeVersion({ id: V3, version: '1.2.0', appliedAt: '2026-08-03T00:00:00.000Z' }),
          ]}
        />
      </MemoryRouter>,
    );
    const from = screen.getByRole('button', { name: 'From (older)' });
    const to = screen.getByRole('button', { name: 'To (newer)' });
    expect(from.textContent).toContain('1.1.0');
    expect(to.textContent).toContain('1.2.0');
    fireEvent.click(from);
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toHaveLength(3);
    expect(options.join(' ')).toContain('1.0.0');
    expect(options.join(' ')).toContain('1.2.0');
  });

  it('shows the diff summary after picking two versions', () => {
    render(
      <MemoryRouter>
        <DiffVersionModal
          open
          onClose={vi.fn()}
          versions={[
            makeVersion({ id: V1, version: '1.0.0', appliedAt: '2026-08-01T00:00:00.000Z' }),
            makeVersion({ id: V2, version: '1.1.0', appliedAt: '2026-08-02T00:00:00.000Z' }),
          ]}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'From (older)' }));
    fireEvent.click(screen.getByRole('option', { name: /1\.0\.0/ }));
    expect(screen.getByText(/Showing changes from 1.0.0 to 1.1.0/)).toBeTruthy();
  });
});