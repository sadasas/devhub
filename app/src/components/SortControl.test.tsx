import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    // klik pertama = pending, menu tetap buka, belum ada onChange
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeTruthy();
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
    expect(onChange).not.toHaveBeenCalled();
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

  it('closes the menu on Escape', () => {    render(<SortControl options={OPTIONS} value={null} onChange={() => {}} />);
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

  it('hides the direction group until a key is picked', () => {
    render(<SortControl options={OPTIONS} value={null} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Sort/ }));
    expect(screen.queryByRole('menuitemradio', { name: 'Ascending' })).toBeNull();
    expect(screen.queryByRole('menuitemradio', { name: 'Descending' })).toBeNull();
  });

  it('reveals the direction group neutral after picking a key', () => {
    render(<SortControl options={OPTIONS} value={null} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Sort/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Created' }));
    expect(screen.getByRole('menuitemradio', { name: 'Ascending' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('menuitemradio', { name: 'Descending' }).getAttribute('aria-checked')).toBe('false');
  });

  it('applies the picked direction for the pending key and closes', () => {
    const onChange = vi.fn();
    render(<SortControl options={OPTIONS} value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Sort/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Created' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Descending' }));
    expect(onChange).toHaveBeenCalledWith({ key: 'createdAt', dir: 'desc' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('applies direction + key in a single opening', () => {
    const onChange = vi.fn();
    render(<SortControl options={OPTIONS} value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Sort/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Created' }));
    // menu tetap buka, belum ada onChange — arah baru muncul
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.getByRole('menuitemradio', { name: 'Descending' })).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Descending' }));
    expect(onChange).toHaveBeenCalledWith({ key: 'createdAt', dir: 'desc' });
  });

  it('moves focus with ArrowDown/ArrowUp inside the menu', () => {
    render(<SortControl options={OPTIONS} value={null} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Sort/ }));
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent).toBe('Name');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent).toBe('Created');
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement?.textContent).toBe('Name');
  });

  describe('mobile sheet', () => {
    const realMatchMedia = window.matchMedia;
    beforeEach(() => {
      window.matchMedia = ((query: string) => ({
        matches: query.includes('640px'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      })) as unknown as typeof window.matchMedia;
    });
    afterEach(() => {
      window.matchMedia = realMatchMedia;
    });

    it('titles the sheet Filter when there are no sort options', () => {
      render(
        <SortControl
          options={[]}
          value={null}
          onChange={() => {}}
          filters={[{ id: 'mine', label: 'Only mine', checked: false, onChange: () => {} }]}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Sort' }));
      expect(screen.getByRole('heading', { name: 'Filter' })).toBeTruthy();
      expect(screen.queryByRole('heading', { name: 'Sort' })).toBeNull();
    });

    it('titles the sheet Sort when options exist', () => {
      render(<SortControl options={OPTIONS} value={null} onChange={() => {}} />);
      fireEvent.click(screen.getByRole('button', { name: 'Sort' }));
      expect(screen.getByRole('heading', { name: 'Sort' })).toBeTruthy();
    });
  });

  it('renders filter toggles inside the desktop menu', () => {
    const onFilter = vi.fn();
    render(
      <SortControl
        options={OPTIONS}
        value={null}
        onChange={() => {}}
        filters={[{ id: 'mine', label: 'Only mine', checked: false, onChange: onFilter }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Sort/ }));
    const box = screen.getByRole('checkbox', { name: 'Only mine' });
    fireEvent.click(box);
    expect(onFilter).toHaveBeenCalledWith(true);
  });

  it('hides sort sections when options are empty but keeps filters', () => {
    render(
      <SortControl
        options={[]}
        value={null}
        onChange={() => {}}
        filters={[{ id: 'mine', label: 'Only mine', checked: false, onChange: () => {} }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Sort/ }));
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.queryByRole('menuitemradio')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Only mine' })).toBeTruthy();
  });
});