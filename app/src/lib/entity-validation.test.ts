import { describe, expect, it } from 'vitest';
import {
  isApiCollectionValid,
  isApiEndpointValid,
  isColumnValid,
  isDecisionValid,
  isErdGroupValid,
  isIssueValid,
  isMilestoneValid,
  isNonEmptyTitle,
  isRelationValid,
  isSchemaVersionValid,
  isTableValid,
  isTaskValid,
  isTechValid,
  isTestCaseValid,
  isWhiteboardValid,
} from './entity-validation';

describe('isNonEmptyTitle', () => {
  it('rejects empty and whitespace-only strings', () => {
    expect(isNonEmptyTitle('')).toBe(false);
    expect(isNonEmptyTitle('   ')).toBe(false);
    expect(isNonEmptyTitle(null)).toBe(false);
    expect(isNonEmptyTitle(undefined)).toBe(false);
  });

  it('accepts non-blank strings', () => {
    expect(isNonEmptyTitle('aku')).toBe(true);
    expect(isNonEmptyTitle('  aku  ')).toBe(true);
  });
});

describe('entity validators (autosave guard)', () => {
  it('requires a non-empty title', () => {
    expect(isTaskValid({ title: '' })).toBe(false);
    expect(isTaskValid({ title: '  ' })).toBe(false);
    expect(isTaskValid({ title: 'Ship' })).toBe(true);
    expect(isIssueValid({ title: '' })).toBe(false);
    expect(isIssueValid({ title: 'Bug' })).toBe(true);
    expect(isDecisionValid({ title: '' })).toBe(false);
    expect(isDecisionValid({ title: 'ADR-1' })).toBe(true);
  });

  it('requires a non-empty name', () => {
    expect(isTestCaseValid({ name: '' })).toBe(false);
    expect(isTestCaseValid({ name: 'Login flow' })).toBe(true);
    expect(isTechValid({ name: '' })).toBe(false);
    expect(isTechValid({ name: 'React' })).toBe(true);
    expect(isMilestoneValid({ name: '' })).toBe(false);
    expect(isMilestoneValid({ name: 'M26' })).toBe(true);
  });

  it('table valid hanya bila nama + semua kolom (nama & type) terisi', () => {
    const col = { name: 'id', type: 'uuid' };
    expect(isTableValid({ name: '', columns: [col] })).toBe(false);
    expect(isTableValid({ name: '  ', columns: [col] })).toBe(false);
    expect(isTableValid({ name: 'users', columns: [] })).toBe(true);
    expect(isTableValid({ name: 'users', columns: [{ name: '', type: 'uuid' }] })).toBe(false);
    expect(isTableValid({ name: 'users', columns: [{ name: 'id', type: '' }] })).toBe(false);
    expect(isTableValid({ name: 'users', columns: [col, { name: 'email', type: 'text' }] })).toBe(true);
    expect(isColumnValid({ name: '', type: 'uuid' })).toBe(false);
    expect(isColumnValid({ name: 'id', type: '' })).toBe(false);
    expect(isColumnValid(col)).toBe(true);
  });

  it('relation valid bila 4 ujung terisi; api/version/whiteboard ikut min(1)', () => {
    const rel = { fromTableId: 't1', fromColumnId: 'c1', toTableId: 't2', toColumnId: 'c2' };
    expect(isRelationValid(rel)).toBe(true);
    expect(isRelationValid({ ...rel, toColumnId: '' })).toBe(false);
    expect(isApiCollectionValid({ name: '' })).toBe(false);
    expect(isApiCollectionValid({ name: 'Users API' })).toBe(true);
    expect(isApiEndpointValid({ name: 'List', path: '' })).toBe(false);
    expect(isApiEndpointValid({ name: '', path: '/a' })).toBe(false);
    expect(isApiEndpointValid({ name: 'List', path: '/a' })).toBe(true);
    expect(isSchemaVersionValid({ version: '' })).toBe(false);
    expect(isSchemaVersionValid({ version: 'v1' })).toBe(true);
    expect(isWhiteboardValid({ name: '' })).toBe(false);
    expect(isWhiteboardValid({ name: 'Plan' })).toBe(true);
  });

  it('area valid bila nama terisi', () => {
    expect(isErdGroupValid({ name: '' })).toBe(false);
    expect(isErdGroupValid({ name: '  ' })).toBe(false);
    expect(isErdGroupValid({ name: 'Billing' })).toBe(true);
  });
});
