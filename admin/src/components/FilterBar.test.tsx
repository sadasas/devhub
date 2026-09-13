import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FilterBar } from './FilterBar';

describe('FilterBar', () => {
  it('renders compact search (sr-only label) + segmented + mono count + hint', () => {
    const onSearch = vi.fn();
    const onSeg = vi.fn();
    render(
      <FilterBar
        searchValue="pro"
        onSearchChange={onSearch}
        searchLabel="Search teams"
        searchPlaceholder="Search…"
        segments={[
          { value: '', label: 'All' },
          { value: 'free', label: 'Free' },
          { value: 'pro', label: 'Pro' },
        ]}
        selectedSegment="pro"
        onSegmentChange={onSeg}
        segmentsAriaLabel="Filter plan"
        countText="3 teams"
        hintText="Showing 3 of 10"
      />,
    );
    // label sr-only
    expect(document.querySelector('label.sr-only')).not.toBeNull();
    const input = screen.getByLabelText('Search teams') as HTMLInputElement;
    expect(input.value).toBe('pro');
    fireEvent.change(input, { target: { value: 'free' } });
    expect(onSearch).toHaveBeenCalledWith('free');
    // segmented radiogroup ≤3
    expect(screen.getByRole('radiogroup', { name: 'Filter plan' })).toBeDefined();
    expect(screen.getByRole('radio', { name: 'Pro' }).getAttribute('aria-checked')).toBe('true');
    // count mono tabular
    expect(screen.getByText('3 teams').className).toMatch(/filter-bar-count/);
    expect(screen.getByText('Showing 3 of 10')).toBeDefined();
  });

  it('falls back to dropdown when options > 3', () => {
    render(
      <FilterBar
        segments={[
          { value: '', label: 'All' },
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
          { value: 'c', label: 'C' },
        ]}
        selectedSegment="a"
        onSegmentChange={() => {}}
        segmentsAriaLabel="Filter"
      />,
    );
    expect(document.querySelector('select.filter-bar-select')).not.toBeNull();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('moves segmented selection with arrow keys (APG radiogroup)', () => {
    const onSeg = vi.fn();
    render(
      <FilterBar
        segments={[
          { value: '', label: 'All' },
          { value: 'free', label: 'Free' },
          { value: 'pro', label: 'Pro' },
        ]}
        selectedSegment=""
        onSegmentChange={onSeg}
        segmentsAriaLabel="Filter plan"
      />,
    );
    const all = screen.getByRole('radio', { name: 'All' });
    all.focus();
    fireEvent.keyDown(all, { key: 'ArrowRight' });
    expect(onSeg).toHaveBeenCalledWith('free');
    // roving tabindex: hanya opsi aktif yang tabbable
    expect(all.getAttribute('tabindex')).toBe('0');
    expect(screen.getByRole('radio', { name: 'Free' }).getAttribute('tabindex')).toBe('-1');
  });
});
