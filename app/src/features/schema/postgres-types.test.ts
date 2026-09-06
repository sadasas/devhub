import { describe, expect, it } from 'vitest';
import { matchPgType, POSTGRES_TYPES } from './postgres-types';

describe('postgres-types', () => {
  it('memuat ±20 tipe generik yang diharapkan', () => {
    const names = POSTGRES_TYPES.map((t) => t.name);
    for (const want of [
      'SMALLINT',
      'INTEGER',
      'BIGINT',
      'SERIAL',
      'BIGSERIAL',
      'NUMERIC',
      'VARCHAR',
      'TEXT',
      'BOOLEAN',
      'TIMESTAMP',
      'UUID',
      'JSONB',
      'BYTEA',
    ]) {
      expect(names).toContain(want);
    }
  });

  it('match grup integer', () => {
    expect(matchPgType('INTEGER')?.group).toBe('integer');
  });

  it('match grup numeric', () => {
    expect(matchPgType('NUMERIC')?.group).toBe('numeric');
  });

  it('match grup character', () => {
    expect(matchPgType('TEXT')?.group).toBe('character');
  });

  it('match grup boolean', () => {
    expect(matchPgType('BOOLEAN')?.group).toBe('boolean');
  });

  it('match grup datetime', () => {
    expect(matchPgType('TIMESTAMP')?.group).toBe('datetime');
  });

  it('match grup uuid', () => {
    expect(matchPgType('UUID')?.group).toBe('uuid');
  });

  it('match grup json', () => {
    expect(matchPgType('JSONB')?.group).toBe('json');
  });

  it('match grup binary', () => {
    expect(matchPgType('BYTEA')?.group).toBe('binary');
  });

  it('case-insensitive dan trim', () => {
    expect(matchPgType('varchar')?.name).toBe('VARCHAR');
    expect(matchPgType('  uuid  ')?.name).toBe('UUID');
    expect(matchPgType('timestamptz')?.name).toBe('TIMESTAMPTZ');
  });

  it('strip param ukuran/presisi', () => {
    expect(matchPgType('varchar(255)')?.name).toBe('VARCHAR');
    expect(matchPgType('CHAR(10)')?.name).toBe('CHAR');
    expect(matchPgType('DECIMAL(10,2)')?.name).toBe('DECIMAL');
    expect(matchPgType('TIMESTAMP(6)')?.name).toBe('TIMESTAMP');
  });

  it('unknown -> null', () => {
    expect(matchPgType('FOOBAR')).toBeNull();
    expect(matchPgType('VARCHAR2')).toBeNull();
  });

  it('kosong -> null dan tidak pernah throw', () => {
    expect(matchPgType('')).toBeNull();
    expect(matchPgType('   ')).toBeNull();
    expect(matchPgType('(255)')).toBeNull();
  });
});
