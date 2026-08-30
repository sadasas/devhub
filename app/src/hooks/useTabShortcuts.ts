import { useEffect, useRef } from 'react';
import { isModalOrPaletteOpen, isTypingTarget } from '../lib/keys';

const TAB_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export function useTabShortcuts<T extends string>(
  tabs: readonly T[],
  active: T,
  onSelect: (tab: T) => void,
): void {
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeRef = useRef(active);
  activeRef.current = active;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || isModalOrPaletteOpen()) return;
      const mods = e.ctrlKey || e.metaKey || e.shiftKey;
      if (e.altKey && !mods) {
        const digit = TAB_KEYS.indexOf(e.key);
        if (digit !== -1 && digit < tabsRef.current.length) {
          e.preventDefault();
          onSelectRef.current(tabsRef.current[digit]!);
          return;
        }
      }
      // Plain 1-4 → primary tabs (progressive disclosure). No modifier.
      // F3: keyboard 1 2 3 4 for primary, More via Tab + Enter
      if (!mods && !e.altKey) {
        const digit = TAB_KEYS.indexOf(e.key);
        if (digit !== -1 && digit < 4 && digit < tabsRef.current.length) {
          e.preventDefault();
          onSelectRef.current(tabsRef.current[digit]!);
          return;
        }
      }
      if (mods || e.altKey) return;
      if (e.key !== '[' && e.key !== ']') return;
      const n = tabsRef.current.length;
      if (n === 0) return;
      const i = tabsRef.current.indexOf(activeRef.current);
      const dir = e.key === ']' ? 1 : -1;
      const next = i === -1 ? 0 : (i + dir + n) % n;
      onSelectRef.current(tabsRef.current[next]!);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}