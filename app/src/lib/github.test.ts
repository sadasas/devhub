import { describe, expect, it } from 'vitest';
import { aggregatePrBadge, formatBranchName, hasMergedUnresolved, shortTaskKey } from './github';
import type { GitHubLink } from './types';

function link(over: Partial<GitHubLink> = {}): GitHubLink {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    repo: 'org/repo',
    kind: 'pr',
    ref: '7',
    url: 'https://github.com/org/repo/pull/7',
    title: 'Fix login',
    status: 'open',
    ...over,
  };
}

describe('lib/github (pure)', () => {
  it('returns null without PR links', () => {
    expect(aggregatePrBadge(undefined)).toBeNull();
    expect(aggregatePrBadge([])).toBeNull();
    expect(aggregatePrBadge([link({ kind: 'branch', ref: 'main' })])).toBeNull();
  });

  it('ranks open above merged and flags failing CI', () => {
    const badge = aggregatePrBadge([link({ ref: '8', status: 'merged' }), link({ ref: '9', status: 'open', ciState: 'fail' })]);
    expect(badge?.label).toBe('PR #9 Open · CI failing');
    expect(badge?.tone).toBe('danger');
    expect(badge?.url).toBe('https://github.com/org/repo/pull/7');
  });

  it('shows approved review and merged tone', () => {
    const badge = aggregatePrBadge([link({ status: 'merged', reviewState: 'approved' })]);
    expect(badge?.label).toBe('PR #7 Merged · Approved');
    expect(badge?.tone).toBe('success');
  });

  it('detects merged-but-unresolved for the suggest banner', () => {
    expect(hasMergedUnresolved([link({ status: 'merged' })], 'inProgress')).toBe(true);
    expect(hasMergedUnresolved([link({ status: 'merged' })], 'done')).toBe(false);
    expect(hasMergedUnresolved([link({ status: 'open' })], 'todo')).toBe(false);
    expect(hasMergedUnresolved(undefined, 'todo')).toBe(false);
  });

  it('formats branch names like the server', () => {
    expect(formatBranchName('123e4567-e89b-12d3-a456-426614174000', 'Fix login validation!')).toBe(
      'feat/123e4567-fix-login-validation',
    );
    expect(shortTaskKey('123e4567-e89b-12d3-a456-426614174000')).toBe('123E4567');
  });
});
