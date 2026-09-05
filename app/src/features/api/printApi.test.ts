import { describe, expect, it } from 'vitest';
import { buildApiPdfTitle } from './printApi';

describe('buildApiPdfTitle', () => {
  it('slugifies the project name', () => {
    expect(buildApiPdfTitle('Demo Project')).toBe('devhub-demo-project-api');
  });

  it('falls back for blank names', () => {
    expect(buildApiPdfTitle('')).toBe('devhub-api');
    expect(buildApiPdfTitle('   ')).toBe('devhub-api');
  });

  it('strips symbols and casing', () => {
    expect(buildApiPdfTitle('  My  API!! ')).toBe('devhub-my-api-api');
  });
});