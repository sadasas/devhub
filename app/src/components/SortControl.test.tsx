import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SortControl } from './SortControl';

const OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'createdAt', label: 'Created' },
];

describe('SortControl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the trigger with the default label', () => {
    render(<SortControl options={OPTIONS} value={null} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Sort/ })).toBeTruthy();
  });

  it('shows the active key label on the trigger', () => {
    render(<SortControl options={OPTIONS} value={{ key: 'name', dir: 'asc' }} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Name/ })).toBeTruthy();
  });

  it('opens the menu and selects a key with the default asc direction', () => {
    const onChange = vi.fn();
    render(<SortControl options={OPTIONS} value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Sort/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Created' }));
    expect(onChange).toHaveBeenCalledWith({ key: 'createdAt', dir: 'asc' });
  });

  it('keeps the current direction when switching keys', () => {
    const onChange = vi.fn();
    render(
      <SortControl options={OPTIONS} value={{ key: 'name', dir: 'desc' }} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Name/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Created' }));
    expect(onChange).toHaveBeenCalledWith({ key: 'createdAt', dir: 'desc' });
  });

  it('toggles the direction', () => {
    const onChange = vi.fn();
    render(
      <SortControl options={OPTIONS} value={{ key: 'name', dir: 'asc' }} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Name/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Descending' }));
    expect(onChange).toHaveBeenCalledWith({ key: 'name', dir: 'desc' });
  });

  it('clears the sort via the None row', () => {
    const onChange = vi.fn();
    render(
      <SortControl options={OPTIONS} value={{ key: 'name', dir: 'asc' }} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Name/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'None' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('closes the menu on Escape', () => {
    render(<SortControl options={OPTIONS} value={null} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Sort/ }));
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('exposes the expanded state via aria-expanded', () => {
    render(<SortControl options={OPTIONS} value={null} onChange={() => {}} />);
    const trigger = screen.getByRole('button', { name: /Sort/ });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: /Sort/ }).getAttribute('aria-expanded')).toBe('true');
  });
});