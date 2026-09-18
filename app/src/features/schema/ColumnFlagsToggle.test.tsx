import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColumnFlagsToggle, nextColumnFlags } from './ColumnFlagsToggle';

describe('nextColumnFlags (invarian PK ⟹ NOT NULL)', () => {
  it('PK ON mematikan Nullable; PK OFF membiarkan Nullable', () => {
    expect(nextColumnFlags({ nullable: true, primaryKey: false, unique: false }, 'primary')).toEqual({
      nullable: false,
      primaryKey: true,
      unique: false,
      autoincrement: false,
      indexed: false,
    });
    expect(nextColumnFlags({ nullable: false, primaryKey: true, unique: false }, 'primary')).toEqual({
      nullable: false,
      primaryKey: false,
      unique: false,
      autoincrement: false,
      indexed: false,
    });
  });

  it('Nullable ON mematikan PK; Nullable OFF membiarkan PK', () => {
    expect(nextColumnFlags({ nullable: false, primaryKey: true, unique: false }, 'nullable')).toEqual({
      nullable: true,
      primaryKey: false,
      unique: false,
      autoincrement: false,
      indexed: false,
    });
    expect(nextColumnFlags({ nullable: true, primaryKey: false, unique: true }, 'nullable')).toEqual({
      nullable: false,
      primaryKey: false,
      unique: true,
      autoincrement: false,
      indexed: false,
    });
  });

  it('Unique independen; input rusak -> fallback aman', () => {
    expect(nextColumnFlags({ nullable: true, primaryKey: false, unique: false }, 'unique')).toEqual({
      nullable: true,
      primaryKey: false,
      unique: true,
      autoincrement: false,
      indexed: false,
    });
    expect(nextColumnFlags(null as never, 'primary')).toEqual({
      nullable: false,
      primaryKey: true,
      unique: false,
      autoincrement: false,
      indexed: false,
    });
  });

  it('Auto independen, dibawa lewat semua transisi', () => {
    const base = { nullable: false, primaryKey: true, unique: false, autoincrement: true };
    expect(nextColumnFlags(base, 'auto')).toEqual({ ...base, autoincrement: false, indexed: false });
    expect(nextColumnFlags({ ...base, autoincrement: false }, 'auto')).toEqual({ ...base, autoincrement: true, indexed: false });
    expect(nextColumnFlags(base, 'nullable')).toEqual({
      nullable: true,
      primaryKey: false,
      unique: false,
      autoincrement: true,
      indexed: false,
    });
  });
});

describe('ColumnFlagsToggle (N/kunci/U)', () => {
  const labels = {
    nullableLabel: 'Nullable',
    primaryLabel: 'Primary key',
    uniqueLabel: 'Unique',
    autoLabel: 'Auto increment',
    indexedLabel: 'Index',
  };

  it('render 4 toggle + pressed sesuai value; klik PK mematikan N', () => {
    const onChange = vi.fn();
    render(
      <ColumnFlagsToggle
        value={{ nullable: true, primaryKey: false, unique: false }}
        onChange={onChange}
        {...labels}
      />,
    );
    const group = screen.getByRole('group');
    expect(group).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nullable' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Primary key' }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Primary key' }));
    expect(onChange).toHaveBeenCalledWith({ nullable: false, primaryKey: true, unique: false, autoincrement: false, indexed: false });
  });

  it('disabled mengunci semua; uniqueDisabled/autoDisabled hanya mengunci masing-masing', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ColumnFlagsToggle value={{ nullable: true, primaryKey: false, unique: false }} onChange={onChange} disabled {...labels} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Primary key' }));
    expect(onChange).not.toHaveBeenCalled();
    rerender(
      <ColumnFlagsToggle
        value={{ nullable: true, primaryKey: false, unique: false }}
        onChange={onChange}
        uniqueDisabled
        uniqueDisabledTitle="Need a name"
        {...labels}
      />,
    );
    const u = screen.getByRole('button', { name: 'Unique' }) as HTMLButtonElement;
    expect(u.disabled).toBe(true);
    expect(u.title).toBe('Need a name');
    fireEvent.click(u);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Nullable' }));
    expect(onChange).toHaveBeenCalledWith({ nullable: false, primaryKey: false, unique: false, autoincrement: false, indexed: false });
  });

  it('auto toggle independen + autoDisabled mengunci', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ColumnFlagsToggle
        value={{ nullable: false, primaryKey: true, unique: false, autoincrement: false }}
        onChange={onChange}
        {...labels}
      />,
    );
    const auto = screen.getByRole('button', { name: 'Auto increment' });
    expect(auto.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(auto);
    expect(onChange).toHaveBeenCalledWith({ nullable: false, primaryKey: true, unique: false, autoincrement: true, indexed: false });
    onChange.mockClear();
    rerender(
      <ColumnFlagsToggle
        value={{ nullable: false, primaryKey: true, unique: false, autoincrement: false }}
        onChange={onChange}
        autoDisabled
        autoDisabledTitle="Need integer"
        {...labels}
      />,
    );
    const locked = screen.getByRole('button', { name: 'Auto increment' }) as HTMLButtonElement;
    expect(locked.disabled).toBe(true);
    expect(locked.title).toBe('Need integer');
    fireEvent.click(locked);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('indexed toggle independen + indexedDisabled mengunci', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ColumnFlagsToggle
        value={{ nullable: true, primaryKey: false, unique: false, indexed: false }}
        onChange={onChange}
        indexedLabel="Index"
        nullableLabel="Nullable"
        primaryLabel="Primary key"
        uniqueLabel="Unique"
        autoLabel="Auto increment"
      />,
    );
    const idx = screen.getByRole('button', { name: 'Index' });
    expect(idx.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(idx);
    expect(onChange).toHaveBeenCalledWith({
      nullable: true,
      primaryKey: false,
      unique: false,
      autoincrement: false,
      indexed: true,
    });
    onChange.mockClear();
    rerender(
      <ColumnFlagsToggle
        value={{ nullable: true, primaryKey: false, unique: false, indexed: false }}
        onChange={onChange}
        indexedDisabled
        indexedDisabledTitle="Need a name"
        indexedLabel="Index"
        nullableLabel="Nullable"
        primaryLabel="Primary key"
        uniqueLabel="Unique"
        autoLabel="Auto increment"
      />,
    );
    const locked = screen.getByRole('button', { name: 'Index' }) as HTMLButtonElement;
    expect(locked.disabled).toBe(true);
    expect(locked.title).toBe('Need a name');
    fireEvent.click(locked);
    expect(onChange).not.toHaveBeenCalled();
  });
});
