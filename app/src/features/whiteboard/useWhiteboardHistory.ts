import { useCallback, useRef, useState } from 'react';
import type { WhiteboardElement } from '../../lib/types';
import { useProject } from '../../state/project-context';

export const HISTORY_LIMIT = 30;

export interface WhiteboardHistory {
  canUndo: boolean;
  canRedo: boolean;
  record: () => void;
  undo: () => void;
  redo: () => void;
}

export function useWhiteboardHistory(boardId: string, elements: WhiteboardElement[]): WhiteboardHistory {
  const { dispatch } = useProject();
  const [stack, setStack] = useState<{ undo: WhiteboardElement[][]; redo: WhiteboardElement[][] }>({
    undo: [],
    redo: [],
  });
  const snapshotsRef = useRef(stack);
  snapshotsRef.current = stack;

  const record = useCallback(() => {
    setStack((s) => {
      if (s.undo.length >= HISTORY_LIMIT) {
        return { undo: [...s.undo.slice(1), elements], redo: [] };
      }
      return { undo: [...s.undo, elements], redo: [] };
    });
  }, [elements]);

  const undo = useCallback(() => {
    const s = snapshotsRef.current;
    const prev = s.undo[s.undo.length - 1];
    if (!prev) return;
    dispatch({ type: 'whiteboard/update', id: boardId, patch: { elements: prev } });
    setStack({ undo: s.undo.slice(0, -1), redo: [...s.redo, elements] });
  }, [boardId, dispatch, elements]);

  const redo = useCallback(() => {
    const s = snapshotsRef.current;
    const next = s.redo[s.redo.length - 1];
    if (!next) return;
    dispatch({ type: 'whiteboard/update', id: boardId, patch: { elements: next } });
    setStack({ undo: [...s.undo, elements], redo: s.redo.slice(0, -1) });
  }, [boardId, dispatch, elements]);

  return { canUndo: stack.undo.length > 0, canRedo: stack.redo.length > 0, record, undo, redo };
}