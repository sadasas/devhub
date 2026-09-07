import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { WelcomeListSkeleton, WELCOME_SKELETON_ROWS } from './WelcomeListSkeleton';
import { SKELETON_SIZES } from '../../lib/skeleton-presets';

describe('WelcomeListSkeleton', () => {
  it('mirrors the real row structure (list > wrap > row with main + meta)', () => {
    const { container } = render(<WelcomeListSkeleton />);
    const list = container.querySelector('.welcome-list');
    expect(list).toBeTruthy();
    const wraps = list!.querySelectorAll(':scope > .welcome-row-wrap');
    expect(wraps.length).toBe(WELCOME_SKELETON_ROWS);
    expect(WELCOME_SKELETON_ROWS).toBe(SKELETON_SIZES.welcomeRow.count);
    wraps.forEach((w) => {
      const row = w.querySelector(':scope > .welcome-row') as HTMLElement;
      expect(row).toBeTruthy();
      // No inline layout overrides — geometry comes from the shared CSS classes.
      expect(row.style.gap).toBe('');
      expect(row.style.padding).toBe('');
      expect(row.style.height).toBe('');
      expect(row.querySelector('.welcome-row-main')).toBeTruthy();
      expect(row.querySelector('.welcome-row-meta')).toBeTruthy();
      // 8px dot comes from .welcome-row-dot CSS (no fixed inline size).
      expect(row.querySelector('.welcome-row-dot')).toBeTruthy();
      // 56x4 progress track placeholder.
      const track = row.querySelector('.welcome-row-progress div, .welcome-row-progress span');
      expect(track).toBeTruthy();
    });
  });

  it('renders a 7-bar spark with 3px bars like the real sparkline', () => {
    const { container } = render(<WelcomeListSkeleton rows={2} />);
    expect(container.querySelectorAll('.welcome-row-wrap').length).toBe(2);
    const sparks = container.querySelectorAll('.welcome-spark');
    expect(sparks.length).toBe(2);
    sparks.forEach((s) => {
      const bars = s.querySelectorAll(':scope > *');
      expect(bars.length).toBe(7);
      bars.forEach((b) => {
        expect((b as HTMLElement).style.width).toBe('3px');
      });
    });
  });
});
