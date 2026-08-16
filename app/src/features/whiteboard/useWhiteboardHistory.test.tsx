import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { WhiteboardElement } from '../../lib/types';
import { useWhiteboardHistory } from './useWhiteboardHistory';

const useProjectMock = vi.hoisted(() => vi.fn());

vi.mock('../../state/project-context', () => ({
  useProject: useProjectMock,
}));

const el = (id: string): WhiteboardElement => ({
  id,
  kind: 'sticky',
  x: 0,
  y: 0,
  w: 200,
  h: 120,
  color: '#e8b955',
  text: id,
});

const BOARD_ID = 'wb1';

describe('useWhiteboardHistory', () => {
  beforeEach(() => {
    useProjectMock.mockReturnValue({ dispatch: vi.fn() });
  });

  it('records snapshots and undoes to the previous state', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({ dispatch });
    const { result } = renderHook(() =>
      useWhiteboardHistory(BOARD_ID, [el('a'), el('b')]),
    );

    act(() => result.current.record());
    act(() => result.current.record());

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    act(() => result.current.undo());

    expect(dispatch).toHaveBeenCalledTimes(1);
    const action = dispatch.mock.calls[0]![0] as {
      type: 'whiteboard/update';
      id: string;
      patch: { elements: Array<{ id: string }> };
    };
    expect(action.type).toBe('whiteboard/update');
    expect(action.id).toBe(BOARD_ID);
    expect(action.patch.elements.map((x) => x.id)).toEqual(['a', 'b']);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.undo());
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('redoes after an undo', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({ dispatch });
    const { result } = renderHook(() =>
      useWhiteboardHistory(BOARD_ID, [el('a')]),
    );

    act(() => result.current.record());
    act(() => result.current.undo());
    expect(dispatch).toHaveBeenCalledTimes(1);

    act(() => result.current.redo());
    expect(dispatch).toHaveBeenCalledTimes(2);
    const action = dispatch.mock.calls[1]![0] as {
      patch: { elements: Array<{ id: string }> };
    };
    expect(action.patch.elements.map((x) => x.id)).toEqual(['a']);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('caps the undo stack at 30 snapshots', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({ dispatch });
    const { result } = renderHook(() =>
      useWhiteboardHistory(BOARD_ID, [el('a')]),
    );

    for (let i = 0; i < 35; i += 1) {
      act(() => result.current.record());
    }

    let undos = 0;
    while (result.current.canUndo) {
      act(() => result.current.undo());
      undos += 1;
    }
    expect(undos).toBe(30);
    expect(dispatch).toHaveBeenCalledTimes(30);
  });

  it('clears the redo stack after a new record', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({ dispatch });
    const { result } = renderHook(() =>
      useWhiteboardHistory(BOARD_ID, [el('a')]),
    );

    act(() => result.current.record());
    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.record());
    expect(result.current.canRedo).toBe(false);
  });

  it('does nothing when there is nothing to undo or redo', () => {
    const dispatch = vi.fn();
    useProjectMock.mockReturnValue({ dispatch });
    const { result } = renderHook(() =>
      useWhiteboardHistory(BOARD_ID, [el('a')]),
    );

    expect(result.current.canUndo).toBe(false);
    act(() => result.current.undo());
    act(() => result.current.redo());
    expect(dispatch).not.toHaveBeenCalled();
  });
});