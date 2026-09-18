import { describe, expect, it } from 'vitest';
import { canAutoincrement, isIntegerType, isPlainIndex, isSerialType, isUniqueIndex, serialTypeFor, togglePlainIndex, toggleUnique } from './column-helpers';

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

describe('serial helpers (auto increment)', () => {
  it('mengenali varian serial + integer', () => {
    expect(isSerialType('SERIAL')).toBe(true);
    expect(isSerialType('bigserial')).toBe(true);
    expect(isSerialType('INTEGER')).toBe(false);
    expect(isIntegerType('INTEGER')).toBe(true);
    expect(isIntegerType('int')).toBe(true);
    expect(isIntegerType('BIGSERIAL')).toBe(true);
    expect(isIntegerType('TEXT')).toBe(false);
    expect(isIntegerType('')).toBe(false);
    expect(canAutoincrement('integer')).toBe(true);
    expect(canAutoincrement('varchar(10)')).toBe(false);
    expect(canAutoincrement(null)).toBe(false);
  });

  it('serialTypeFor memetakan basis integer', () => {
    expect(serialTypeFor('INTEGER')).toBe('SERIAL');
    expect(serialTypeFor('int')).toBe('SERIAL');
    expect(serialTypeFor('BIGINT')).toBe('BIGSERIAL');
    expect(serialTypeFor('smallint')).toBe('SMALLSERIAL');
    expect(serialTypeFor('SERIAL')).toBe('SERIAL');
    expect(serialTypeFor('TEXT')).toBeNull();
    expect(serialTypeFor('')).toBeNull();
    expect(serialTypeFor(null)).toBeNull();
  });
});

describe('plain index helpers', () => {
  it('detect + toggle entri plain saja', () => {
    expect(isPlainIndex(['email'], 'email')).toBe(true);
    expect(isPlainIndex(['unique:email'], 'email')).toBe(false);
    expect(isPlainIndex(['lower(email)'], 'email')).toBe(false);
    expect(togglePlainIndex([], 'email')).toEqual(['email']);
    expect(togglePlainIndex(['email', 'unique:email'], 'email')).toEqual(['unique:email']);
    expect(togglePlainIndex(['unique:email'], 'email')).toEqual(['unique:email', 'email']);
    expect(togglePlainIndex(['x'], '')).toEqual(['x']);
  });
});
