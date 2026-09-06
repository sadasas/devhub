import { describe, expect, it } from 'vitest';
import { isUniqueIndex, toggleUnique } from './column-helpers';

describe('column-helpers toggle unique', () => {
  it('off -> on: append unique:<col> di akhir', () => {
    expect(toggleUnique([], 'email')).toEqual(['unique:email']);
    expect(toggleUnique(['name', 'unique:name'], 'email')).toEqual([
      'name',
      'unique:name',
      'unique:email',
    ]);
  });

  it('on -> off: hapus semua entri unique kolom itu', () => {
    expect(toggleUnique(['unique:email'], 'email')).toEqual([]);
    expect(toggleUnique(['unique:email', 'UNIQUE:email', 'unique email'], 'email')).toEqual(
      [],
    );
  });

  it('case-insensitive untuk kedua prefix unique:/unique-space', () => {
    expect(isUniqueIndex(['UNIQUE:Email'], 'email')).toBe(true);
    expect(isUniqueIndex(['unique EMAIL'], 'email')).toBe(true);
    expect(isUniqueIndex(['Unique : EMAIL'], 'email')).toBe(true);
    expect(toggleUnique(['UNIQUE:Email'], 'EMAIL')).toEqual([]);
  });

  it('plain bukan unique: hanya unique: yang dihapus, entri lain dipertahankan', () => {
    expect(isUniqueIndex(['email'], 'email')).toBe(false);
    expect(toggleUnique(['email'], 'email')).toEqual(['email', 'unique:email']);
    expect(toggleUnique(['email', 'unique:email', 'unique:name', 'name'], 'email')).toEqual([
      'email',
      'unique:name',
      'name',
    ]);
  });

  it('nama kosong: kembalikan salinan tanpa perubahan', () => {
    expect(toggleUnique(['unique:email'], '')).toEqual(['unique:email']);
    expect(toggleUnique(['unique:email'], '   ')).toEqual(['unique:email']);
    expect(isUniqueIndex(['unique:email'], '')).toBe(false);
  });

  it('composite unique:(a, b) tak tersentuh toggle per-kolom', () => {
    expect(isUniqueIndex(['unique:(a, b)'], 'a')).toBe(false);
    expect(toggleUnique(['unique:(a, b)'], 'a')).toEqual(['unique:(a, b)', 'unique:a']);
    expect(toggleUnique(['unique:(a, b)', 'unique:a'], 'a')).toEqual(['unique:(a, b)']);
  });

  it('immutability: input tidak dimutasi, return array baru yang deterministik', () => {
    const input = ['name', 'unique:email'];
    const snapshot = [...input];
    const out = toggleUnique(input, 'email');
    expect(input).toEqual(snapshot);
    expect(out).toEqual(['name']);
    expect(out).not.toBe(input);
    const added = toggleUnique(input, 'phone');
    expect(added).toEqual(['name', 'unique:email', 'unique:phone']);
    expect(added).not.toBe(input);
    expect(input).toEqual(snapshot);
  });
});
