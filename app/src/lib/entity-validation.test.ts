import { describe, expect, it } from 'vitest';
import {
  isDecisionValid,
  isIssueValid,
  isMilestoneValid,
  isNonEmptyTitle,
  isTaskValid,
  isTechValid,
  isTestCaseValid,
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
});
