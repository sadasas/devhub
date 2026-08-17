import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { MemoryRouter, useSearchParams } from 'react-router';
import { useNewParam } from './useNewParam';

function wrapper(initialEntry: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>;
  };
}

describe('useNewParam', () => {
  it('triggers once and clears the param', async () => {
    const onTrigger = vi.fn();
    let params = '';
    const { rerender } = renderHook(
      () => {
        useNewParam(onTrigger, '1', true);
        const [sp] = useSearchParams();
        params = sp.toString();
      },
      { wrapper: wrapper('/p1?tab=board&new=1') },
    );
    await act(async () => {});
    expect(onTrigger).toHaveBeenCalledTimes(1);
    expect(params).not.toContain('new');
    rerender();
    await act(async () => {});
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it('triggers with any value when no value is specified', async () => {
    const onTrigger = vi.fn();
    renderHook(() => useNewParam(onTrigger), { wrapper: wrapper('/p1?new=endpoint') });
    await act(async () => {});
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it('does not trigger when the param value does not match', async () => {
    const onTrigger = vi.fn();
    renderHook(() => useNewParam(onTrigger, '1', true), {
      wrapper: wrapper('/p1?tab=api&new=endpoint'),
    });
    await act(async () => {});
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it('does not trigger when disabled', async () => {
    const onTrigger = vi.fn();
    renderHook(() => useNewParam(onTrigger, undefined, false), { wrapper: wrapper('/p1?new=1') });
    await act(async () => {});
    expect(onTrigger).not.toHaveBeenCalled();
  });
});