import { describe, expect, it } from 'vitest';
import { sanitizeDecimalInput, sanitizeIntegerInput, isDigitKey, parseLabels } from './utils';

describe('sanitizeDecimalInput', () => {
  it('keeps digits and decimal points', () => {
    expect(sanitizeDecimalInput('12.5')).toBe('12.5');
  });

  it('strips letters and symbols', () => {
    expect(sanitizeDecimalInput('1a2b')).toBe('12');
    expect(sanitizeDecimalInput('5x')).toBe('5');
    expect(sanitizeDecimalInput('h8')).toBe('8');
  });

  it('keeps empty string empty', () => {
    expect(sanitizeDecimalInput('')).toBe('');
  });
});

describe('sanitizeIntegerInput', () => {
  it('keeps digits and drops decimal points', () => {
    expect(sanitizeIntegerInput('8.5')).toBe('85');
    expect(sanitizeIntegerInput('12')).toBe('12');
  });

  it('strips letters and symbols', () => {
    expect(sanitizeIntegerInput('1a2b')).toBe('12');
    expect(sanitizeIntegerInput('h8')).toBe('8');
  });

  it('keeps empty string empty', () => {
    expect(sanitizeIntegerInput('')).toBe('');
  });
});

describe('isDigitKey', () => {
  it('allows digits and control keys', () => {
    expect(isDigitKey('5')).toBe(true);
    expect(isDigitKey('Backspace')).toBe(true);
    expect(isDigitKey('Delete')).toBe(true);
    expect(isDigitKey('Tab')).toBe(true);
    expect(isDigitKey('ArrowLeft')).toBe(true);
    expect(isDigitKey('Enter')).toBe(true);
    expect(isDigitKey('Escape')).toBe(true);
  });

  it('blocks dots, signs, letters and symbols', () => {
    expect(isDigitKey('.')).toBe(false);
    expect(isDigitKey('e')).toBe(false);
    expect(isDigitKey('-')).toBe(false);
    expect(isDigitKey('+')).toBe(false);
    expect(isDigitKey('a')).toBe(false);
  });
});

describe('parseLabels', () => {
  it('dedupes repeated labels to avoid duplicate React keys', () => {
    expect(parseLabels('d, d')).toEqual(['d']);
    expect(parseLabels('a, b, a, c, b')).toEqual(['a', 'b', 'c']);
  });

  it('trims, drops empties and caps at 20', () => {
    expect(parseLabels('  a ,, b , ')).toEqual(['a', 'b']);
    expect(parseLabels(Array.from({ length: 25 }, (_, i) => `l${i}`).join(','))).toHaveLength(20);
  });
});
