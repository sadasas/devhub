import { useEffect, useRef } from 'react';
import { isModalOrPaletteOpen, isTypingTarget } from '../lib/keys';

export const NEW_ITEM_PARAMS: Record<string, string> = {
  board: '1',
  issues: '1',
  tests: '1',
  stack: '1',
  decisions: '1',
  releases: '1',
  api: 'endpoint',
  whiteboard: '1',
};

export function useNewItemShortcut(
  active: string,
  canEdit: boolean,
  onActivate: (tab: string, value: string) => void,
): void {
  const activeRef = useRef(active);
  activeRef.current = active;
  const canEditRef = useRef(canEdit);
  canEditRef.current = canEdit;
  const onActivateRef = useRef(onActivate);
  onActivateRef.current = onActivate;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'n' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (!canEditRef.current) return;
      if (isTypingTarget(e.target) || isModalOrPaletteOpen()) return;
      if (document.querySelector('.wb-shell')) return;
      const value = NEW_ITEM_PARAMS[activeRef.current];
      if (value === undefined) return;
      onActivateRef.current(activeRef.current, value);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}