import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTabShortcuts } from './useTabShortcuts';

const TABS = ['board', 'issues', 'tests', 'stack', 'schema', 'decisions', 'releases', 'api', 'stats', 'about', 'whiteboard'];

function setup(active = 'board') {
  const selected: string[] = [];
  const onSelect = vi.fn((tab: string) => selected.push(tab));
  renderHook(() => useTabShortcuts(TABS, active, onSelect));
  return { onSelect, selected };
}

function press(key: string, opts: { altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; target?: EventTarget } = {}) {
  const { altKey = false, ctrlKey = false, metaKey = false, shiftKey = false, target } = opts;
  const event = new KeyboardEvent('keydown', { key, altKey, ctrlKey, metaKey, shiftKey, bubbles: true, cancelable: true });
  act(() => {
    if (target) target.dispatchEvent(event);
    else window.dispatchEvent(event);
  });
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('useTabShortcuts', () => {
  it('switches tab with Alt+digit', () => {
    const { onSelect } = setup();
    press('3', { altKey: true });
    expect(onSelect).toHaveBeenCalledWith('tests');
  });

  it('maps Alt+0 to the tenth tab', () => {
    const { onSelect } = setup();
    press('0', { altKey: true });
    expect(onSelect).toHaveBeenCalledWith('about');
  });

  it('does not switch on plain digits or with ctrl/meta/shift modifiers', () => {
    const { onSelect } = setup();
    press('2');
    press('2', { ctrlKey: true });
    press('2', { metaKey: true });
    press('2', { shiftKey: true });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('cycles to the next and previous tab with brackets', () => {
    const next = setup('issues');
    press(']');
    expect(next.onSelect).toHaveBeenCalledWith('tests');
    const prev = setup('board');
    press('[');
    expect(prev.onSelect).toHaveBeenCalledWith('whiteboard');
    const fromLast = setup('whiteboard');
    press(']');
    expect(fromLast.onSelect).toHaveBeenCalledWith('board');
  });

  it('ignores keys while typing in an input', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    const { onSelect } = setup();
    press('1', { altKey: true, target: input });
    press(']', { target: input });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('ignores keys while a modal or the palette is open', () => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    document.body.appendChild(backdrop);
    const { onSelect } = setup();
    press('2', { altKey: true });
    press(']');
    expect(onSelect).not.toHaveBeenCalled();
  });
});