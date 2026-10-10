import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
      <DeletedItemsBanner items={[entry({ action: 'updated' })]} activeTab="board" dismissedUntil={{}} onDismiss={() => {}} />,
    );
    expect(container.querySelector('.deleted-banner')).toBeNull();
  });

  it('renders the count badge and item rows', () => {
    const { container } = render(
      <DeletedItemsBanner
        items={[
          entry({ id: 'a1', entity: 'tasks', summary: 'Build login', createdAt: '2026-08-20T10:00:00.000Z' }),
          entry({ id: 'a2', entity: 'tasks', summary: 'Flaky test', createdAt: '2026-08-20T09:00:00.000Z' }),
          entry({ id: 'a3', action: 'updated', entity: 'tasks', summary: 'Ignore me' }),
        ]}
        activeTab="board"
        dismissedUntil={{}}
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
        activeTab="board"
        dismissedUntil={{ board: '2026-08-20T12:00:00.000Z' }}
        onDismiss={() => {}}
      />,
    );
    expect(container.textContent).not.toContain('Old one');
    expect(container.textContent).toContain('Fresh one');
  });

  it('calls onDismiss when the Dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <DeletedItemsBanner items={[entry({})]} activeTab="board" dismissedUntil={{}} onDismiss={onDismiss} />,
    );
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    button!.click();
    expect(onDismiss).toHaveBeenCalledWith('board');
  });

  it('renders Dismiss as a real ghost button separate from the copy text', () => {
    const { container } = render(
      <DeletedItemsBanner items={[entry({})]} activeTab="board" dismissedUntil={{}} onDismiss={() => {}} />,
    );
    // Kunci regresi mobile: varian ghost minim chrome terbaca sebagai body
    // text bila ter-wrap rata-kiri di bawah copy — pastikan ia tetap button
    // dengan nama aksesibel, bukan teks.
    const dismiss = screen.getByRole('button', { name: 'Dismiss' });
    expect(dismiss.tagName).toBe('BUTTON');
    expect(dismiss.classList.contains('btn-ghost')).toBe(true);
    expect(dismiss.classList.contains('deleted-banner-dismiss')).toBe(true);
    // Copy adalah span terpisah dan tidak mengandung label tombol.
    const copy = container.querySelector('.deleted-banner-copy');
    expect(copy?.tagName).toBe('SPAN');
    expect(copy?.textContent).not.toContain('Dismiss');
    expect(copy?.querySelector('button')).toBeNull();
  });

  it('keeps Badge + copy + Dismiss DOM order so the <=640px rule can pin Dismiss top-right', () => {
    const { container } = render(
      <DeletedItemsBanner items={[entry({})]} activeTab="board" dismissedUntil={{}} onDismiss={() => {}} />,
    );
    // jsdom tak punya layout engine: kunci kontrak struktur (urutan DOM +
    // hook kelas) yang ditarget rule @media (max-width: 640px) di global.css
    // (.deleted-banner-dismiss order:2 margin-left:auto; copy order:3
    // flex-basis:100%), bukan posisi piksel.
    const head = container.querySelector('.deleted-banner-head');
    expect(head).not.toBeNull();
    const kids = Array.from(head!.children);
    expect(kids.map((el) => el.tagName)).toEqual(['SPAN', 'SPAN', 'BUTTON']);
    expect(kids[0].classList.contains('badge')).toBe(true);
    expect(kids[1].classList.contains('deleted-banner-copy')).toBe(true);
    expect(kids[2].classList.contains('deleted-banner-dismiss')).toBe(true);
  });
});