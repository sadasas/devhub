import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DeletedItemsBanner } from './DeletedItemsBanner';
import type { ActivityEntry } from '../../lib/api';

function entry(over: Partial<ActivityEntry>): ActivityEntry {
  return {
    id: 'a1',
    projectId: 'p1',
    entity: 'tasks',
    entityId: 't1',
    action: 'deleted',
    authorId: 'u1',
    authorName: 'Ana',
    summary: 'Build login',
    changes: {},
    createdAt: '2026-08-20T10:00:00.000Z',
    ...over,
  };
}

describe('DeletedItemsBanner', () => {
  it('returns null when there are no deleted items', () => {
    const { container } = render(
      <DeletedItemsBanner items={[entry({ action: 'updated' })]} dismissedUntil={null} onDismiss={() => {}} />,
    );
    expect(container.querySelector('.deleted-banner')).toBeNull();
  });

  it('renders the count badge and item rows', () => {
    const { container } = render(
      <DeletedItemsBanner
        items={[
          entry({ id: 'a1', entity: 'tasks', summary: 'Build login', createdAt: '2026-08-20T10:00:00.000Z' }),
          entry({ id: 'a2', entity: 'issues', summary: 'Flaky test', createdAt: '2026-08-20T09:00:00.000Z' }),
          entry({ id: 'a3', action: 'updated', entity: 'tasks', summary: 'Ignore me' }),
        ]}
        dismissedUntil={null}
        onDismiss={() => {}}
      />,
    );
    expect(container.querySelector('.deleted-banner')).not.toBeNull();
    expect(container.textContent).toContain('2 deleted');
    expect(container.textContent).toContain('Build login');
    expect(container.textContent).toContain('Flaky test');
    expect(container.textContent).not.toContain('Ignore me');
    expect(container.querySelectorAll('.deleted-banner-item').length).toBe(2);
  });

  it('hides items older than the dismissed boundary', () => {
    const { container } = render(
      <DeletedItemsBanner
        items={[
          entry({ id: 'a1', summary: 'Old one', createdAt: '2026-08-20T10:00:00.000Z' }),
          entry({ id: 'a2', summary: 'Fresh one', createdAt: '2026-08-21T10:00:00.000Z' }),
        ]}
        dismissedUntil="2026-08-20T12:00:00.000Z"
        onDismiss={() => {}}
      />,
    );
    expect(container.textContent).not.toContain('Old one');
    expect(container.textContent).toContain('Fresh one');
  });

  it('calls onDismiss when the Dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <DeletedItemsBanner items={[entry({})]} dismissedUntil={null} onDismiss={onDismiss} />,
    );
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    button!.click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});