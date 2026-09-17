import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Whiteboard } from '../../lib/types';
import { EditWhiteboardModal } from './EditWhiteboardModal';

const mockDispatch = vi.fn();
const setStatusMock = vi.fn();

vi.mock('../../state/project-context', () => ({
  useProject: () => ({ dispatch: mockDispatch, canEdit: true, setStatus: setStatusMock }),
}));

function board(over: Partial<Whiteboard> = {}): Whiteboard {
  return {
    id: 'wb1',
    name: 'Roadmap',
    description: 'Q3 plans',
    elements: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function renderModal(onClose: () => void = () => {}, b: Whiteboard = board()) {
  return render(
    <MemoryRouter><EditWhiteboardModal board={b} onClose={onClose} /></MemoryRouter>,
  );
}

describe('EditWhiteboardModal', () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    setStatusMock.mockClear();
  });

  it('prefills name and description, saves trimmed update', () => {
    const onClose = vi.fn();
    renderModal(onClose);
    expect((screen.getByLabelText(/Name/) as HTMLInputElement).value).toBe('Roadmap');
    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe('Q3 plans');
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: '  Roadmap v2  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'whiteboard/update',
      id: 'wb1',
      patch: { name: 'Roadmap v2', description: 'Q3 plans' },
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('disables save when the name is blank and cancels via Cancel', () => {
    const onClose = vi.fn();
    renderModal(onClose);
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: '   ' } });
    expect((screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
