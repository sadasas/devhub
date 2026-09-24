import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FilterControl } from './FilterControl';

const FILTERS = [
  { id: 'mine', label: 'Only mine', checked: false, onChange: () => {} },
  { id: 'hide-sub', label: 'Hide subtasks', checked: false, onChange: () => {} },
];

describe('FilterControl', () => {
  it('renders the trigger with the funnel label and no badge when inactive', () => {
    render(<FilterControl filters={FILTERS} />);
    const trigger = screen.getByRole('button', { name: 'Filter' });
    expect(trigger.querySelector('svg')).toBeTruthy();
    expect(trigger.querySelector('.tab-count')).toBeNull();
  });

  it('shows the active count badge only when filters are on', () => {
    render(
      <FilterControl
        filters={[
          { ...FILTERS[0]!, checked: true },
          { ...FILTERS[1]!, checked: true },
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Filter · 2' })).toBeTruthy();
  });

  it('opens its own menu with checkboxes and closes on Escape', () => {
    render(<FilterControl filters={FILTERS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Only mine' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('forwards checkbox toggles', () => {
    const onFilter = vi.fn();
    render(
      <FilterControl
        filters={[{ id: 'mine', label: 'Only mine', checked: false, onChange: onFilter }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Only mine' }));
    expect(onFilter).toHaveBeenCalledWith(true);
  });
});
