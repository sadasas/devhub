import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SearchField } from './SearchField';

function renderField(overrides: Partial<Parameters<typeof SearchField>[0]> = {}) {
  const onChange = vi.fn();
  const view = render(
    <SearchField
      value=""
      onChange={onChange}
      placeholder="Search things…"
      ariaLabel="Search things"
      clearLabel="Clear search"
      {...overrides}
    />,
  );
  return { view, onChange };
}

describe('SearchField', () => {
  it('renders icon, input and landmark with the given labels', () => {
    const { view } = renderField();
    // Wrapper sengaja TANPA role agar nama aksesibel tidak ganda dengan input.
    expect(view.container.querySelector('.search-field')).toBeTruthy();
    expect(screen.getByLabelText('Search things')).toBeTruthy();
    // No clear button while empty.
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
  });

  it('emits typed text and clears via the X button', () => {
    const { onChange } = renderField();
    fireEvent.change(screen.getByLabelText('Search things'), { target: { value: 'ab' } });
    expect(onChange).toHaveBeenCalledWith('ab');

    const { onChange: onClear } = renderField({ value: 'ab' });
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onClear).toHaveBeenCalledWith('');
  });

  it('hides the clear button when showClear is false', () => {
    renderField({ value: 'ab', showClear: false });
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
  });

  it('applies size, variant and alignment contracts', () => {
    const { view } = renderField({ size: 'lg', variant: 'underline', align: 'center' });
    const wrap = view.container.querySelector('.search-field') as HTMLElement;
    expect(wrap.className).toContain('search-field--lg');
    expect(wrap.className).toContain('search-field--underline');
    expect(wrap.getAttribute('data-align')).toBe('center');
    view.unmount();
  });

  it('forwards refs and extra input props (combobox, autofocus, keydown)', () => {
    const ref = createRef<HTMLInputElement>();
    const onKeyDown = vi.fn();
    renderField({ inputRef: ref, autoFocus: true, onKeyDown, role: 'combobox', name: 'q' });
    const input = screen.getByLabelText('Search things') as HTMLInputElement;
    expect(ref.current).toBe(input);
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('name')).toBe('q');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it('renders the hint slot', () => {
    renderField({ hint: <span data-testid="kbd-hint">K</span> });
    expect(screen.getByTestId('kbd-hint')).toBeTruthy();
  });
});
