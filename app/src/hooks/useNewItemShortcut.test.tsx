import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NEW_ITEM_PARAMS, useNewItemShortcut } from './useNewItemShortcut';

function setup(active: string, canEdit = true) {
  const calls: [string, string][] = [];
  const onActivate = vi.fn((tab: string, value: string) => calls.push([tab, value]));
  renderHook(() => useNewItemShortcut(active, canEdit, onActivate));
  return { onActivate, calls };
}

function press(key: string, opts: { ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; shiftKey?: boolean; target?: EventTarget } = {}) {
  const { ctrlKey = false, metaKey = false, altKey = false, shiftKey = false, target } = opts;
  const event = new KeyboardEvent('keydown', { key, ctrlKey, metaKey, altKey, shiftKey, bubbles: true, cancelable: true });
  act(() => {
    if (target) target.dispatchEvent(event);
    else window.dispatchEvent(event);
  });
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('useNewItemShortcut', () => {
  it.each(['board', 'issues', 'tests', 'stack', 'decisions', 'releases', 'whiteboard'])(
    'activates create on the %s tab with new=1',
    (tab) => {
      const { onActivate } = setup(tab);
      press('n');
      expect(onActivate).toHaveBeenCalledWith(tab, '1');
    },
  );

  it('activates new endpoint on the api tab', () => {
    const { onActivate } = setup('api');
    press('n');
    expect(onActivate).toHaveBeenCalledWith('api', 'endpoint');
  });

  it.each(['schema', 'stats', 'about'])('ignores n on the %s tab', (tab) => {
    const { onActivate } = setup(tab);
    press('n');
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('does nothing without edit access', () => {
    const { onActivate } = setup('board', false);
    press('n');
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('ignores modified keys', () => {
    const { onActivate } = setup('board');
    press('n', { ctrlKey: true });
    press('n', { metaKey: true });
    press('n', { altKey: true });
    press('n', { shiftKey: true });
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('ignores n while typing in an input', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    const { onActivate } = setup('board');
    press('n', { target: input });
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('ignores n while a modal or the palette is open', () => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    document.body.appendChild(backdrop);
    const { onActivate } = setup('board');
    press('n');
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('ignores n while the whiteboard canvas is open', () => {
    const shell = document.createElement('div');
    shell.className = 'wb-shell';
    document.body.appendChild(shell);
    const { onActivate } = setup('whiteboard');
    press('n');
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('covers every create-capable tab in NEW_ITEM_PARAMS', () => {
    expect(Object.keys(NEW_ITEM_PARAMS).sort()).toEqual([
      'api',
      'board',
      'decisions',
      'issues',
      'releases',
      'stack',
      'tests',
      'whiteboard',
    ]);
  });
});