import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GitHubLinkBadge } from './GitHubLinkBadge';
import { GitHubTaskSection } from './GitHubTaskSection';
import type { GitHubLink, Task } from '../../lib/types';

vi.mock('../../hooks/useCopyFeedback', () => ({
  useCopyFeedback: () => ({ copied: false, copy: vi.fn() }),
}));

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

function task(over: Partial<Task> = {}): Task {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    title: 'Fix login',
    status: 'inProgress',
    priority: 'high',
    labels: [],
    blockedBy: [],
    description: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('GitHubLinkBadge', () => {
  it('renders null without PR links', () => {
    const { container } = render(<GitHubLinkBadge links={undefined} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders aggregate label linking to the PR', () => {
    render(<GitHubLinkBadge links={[link({ status: 'open', ciState: 'fail' })]} />);
    const a = screen.getByRole('link', { name: /PR #7 Open · CI failing/ });
    expect(a.getAttribute('href')).toBe('https://github.com/org/repo/pull/7');
  });
});

describe('GitHubTaskSection', () => {
  it('shows empty hint with DEV key and copy-branch command', () => {
    render(<GitHubTaskSection task={task()} canEdit onChanged={() => {}} onMarkDone={() => {}} />);
    expect(screen.getByText(/No linked branches or PRs yet/)).toBeTruthy();
    expect(screen.getByText(/git checkout -b feat\/22222222-fix-login/)).toBeTruthy();
  });

  it('lists links and unlinks via onChanged', () => {
    const onChanged = vi.fn();
    render(
      <GitHubTaskSection
        task={task({ githubLinks: [link(), link({ id: '33333333-3333-4333-8333-333333333333', kind: 'branch', ref: 'feat/x' })] })}
        canEdit
        onChanged={onChanged}
        onMarkDone={() => {}}
      />,
    );
    expect(screen.getByText(/PR #7 · org\/repo/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Unlink 7' }));
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(onChanged.mock.calls[0]?.[0]).toHaveLength(1);
  });

  it('shows suggest-done banner on merged PR and calls onMarkDone', () => {
    const onMarkDone = vi.fn();
    render(
      <GitHubTaskSection
        task={task({ status: 'review', githubLinks: [link({ status: 'merged' })] })}
        canEdit
        onChanged={() => {}}
        onMarkDone={onMarkDone}
      />,
    );
    expect(screen.getByRole('status')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mark done' }));
    expect(onMarkDone).toHaveBeenCalledTimes(1);
  });

  it('hides the banner when task is done', () => {
    render(
      <GitHubTaskSection
        task={task({ status: 'done', githubLinks: [link({ status: 'merged' })] })}
        canEdit
        onChanged={() => {}}
        onMarkDone={() => {}}
      />,
    );
    expect(screen.queryByRole('status')).toBeNull();
  });
});
