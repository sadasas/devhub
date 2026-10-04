import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

const { searchMock } = vi.hoisted(() => ({ searchMock: vi.fn() }));
vi.mock('../../lib/analytics', () => ({ track: vi.fn() }));
vi.mock('../../lib/api', () => ({ api: { youtubeSearch: searchMock } }));

import { FocusRadio } from './FocusRadio';

function mockMatchMedia(m: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: () => ({
      matches: m,
      media: '',
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    }),
  });
}

describe('dbg', () => {
  it('dumps results DOM', async () => {
    mockMatchMedia(true);
    searchMock.mockResolvedValue({
      results: [{ videoId: 'a', title: 'Title a', channelTitle: 'NCS', thumbnailUrl: '' }],
      cached: false,
    });
    render(<FocusRadio />);
    fireEvent.click(screen.getByRole('button', { name: 'Radio' }));
    fireEvent.change(screen.getByLabelText('Search YouTube songs'), { target: { value: 'lofi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    screen.debug(undefined, 30000);
    expect(true).toBe(true);
  });
});
