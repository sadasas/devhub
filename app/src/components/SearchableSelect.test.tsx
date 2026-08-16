import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SearchableSelect } from './SearchableSelect';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma', hint: 'g' },
];

function renderSelect(props: Partial<Parameters<typeof SearchableSelect>[0]> = {}) {
  const onChange = vi.fn();
  const utils = render(
    <SearchableSelect
      id="test-select"
      value={null}
      options={OPTIONS}
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange, ...utils };
}

describe('SearchableSelect', () => {
  it('renders the trigger with the selected label', () => {
    renderSelect({ value: 'b' });
    expect(screen.getByRole('button', { name: 'Beta' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Beta' }).getAttribute('aria-haspopup')).toBe('listbox');
  });

  it('renders the label bound to the trigger', () => {
    renderSelect({ label: 'Pick one' });
    const label = screen.getByText('Pick one');
    expect(label.tagName).toBe('LABEL');
    expect(label.getAttribute('for')).toBe('test-select');
  });

  it('shows the empty label when no value and allowEmpty', () => {
    renderSelect();
    expect(screen.getByRole('button', { name: 'None' })).toBeTruthy();
  });

  it('shows the placeholder when no value and allowEmpty is false', () => {
    renderSelect({ allowEmpty: false, placeholder: 'Select…' });
    expect(screen.getByRole('button', { name: 'Select…' })).toBeTruthy();
  });

  it('opens on click and lists all options', () => {
    renderSelect();
    fireEvent.click(screen.getByRole('button'));
    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeTruthy();
    expect(screen.getAllByRole('option').map((o) => o.querySelector('.ss-option-label')?.textContent)).toEqual(['None', 'Alpha', 'Beta', 'Gamma']);
  });

  it('selects an option and calls onChange', () => {
    const { onChange } = renderSelect();
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('option', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('clears via the empty row', () => {
    const { onChange } = renderSelect({ value: 'a' });
    fireEvent.click(screen.getByRole('button', { name: 'Alpha' }));
    fireEvent.click(screen.getByRole('option', { name: 'None' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('filters options by typed query and shows empty state', () => {
    renderSelect();
    fireEvent.click(screen.getByRole('button'));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'et' } });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Beta']);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzz' } });
    expect(screen.getByText(/No matches/)).toBeTruthy();
  });

  it('selects the highlighted option with keyboard', () => {
    const { onChange } = renderSelect();
    fireEvent.click(screen.getByRole('button'));
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('closes on Escape', () => {
    renderSelect();
    fireEvent.click(screen.getByRole('button'));
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes on outside click', () => {
    renderSelect();
    fireEvent.click(screen.getByRole('button'));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('renders the panel in a portal on document.body', () => {
    renderSelect();
    fireEvent.click(screen.getByRole('button'));
    const listbox = screen.getByRole('listbox');
    expect(document.body.contains(listbox)).toBe(true);
    expect(listbox.closest('.ss-wrap')).toBeNull();
  });

  it('does not render the empty row when allowEmpty is false', () => {
    renderSelect({ allowEmpty: false });
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getAllByRole('option').map((o) => o.querySelector('.ss-option-label')?.textContent)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('renders option hints', () => {
    renderSelect();
    fireEvent.click(screen.getByRole('button'));
    const gamma = screen.getByRole('option', { name: /Gamma/ });
    expect(gamma.textContent).toContain('g');
  });
});