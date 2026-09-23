import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AttachmentSection } from './AttachmentSection';
import type { Attachment } from '../lib/types';

vi.mock('../lib/api', () => ({
  api: {
    attachmentRemove: vi.fn().mockResolvedValue({ ok: true, version: 2 }),
    attachmentAbandon: vi.fn().mockResolvedValue({ ok: true }),
    attachmentSignDownload: vi.fn().mockRejectedValue(new Error('no storage in test')),
    attachmentUnfurl: vi.fn().mockRejectedValue(new Error('no unfurl in test')),
    attachmentAddLink: vi.fn().mockResolvedValue({
      attachment: { id: 'a9', provider: 'link', name: 'L', mime: '', size: 0, storageKey: null, url: 'https://x.test', linkedAt: '' },
      version: 3,
    }),
  },
  ApiError: class ApiError extends Error {
    status = 0;
    code = 'INTERNAL';
  },
}));

const FILE_ATT: Attachment = {
  id: 'a1',
  provider: 'devhub',
  name: 'screenshot.png',
  mime: 'image/png',
  size: 1887437,
  storageKey: 't/p/tasks/e/a1-screenshot.png',
  url: null,
  linkedAt: new Date().toISOString(),
};

const LINK_ATT: Attachment = {
  id: 'a2',
  provider: 'link',
  name: 'Spec',
  mime: '',
  size: 0,
  storageKey: null,
  url: 'https://example.com/spec.pdf',
  linkedAt: new Date().toISOString(),
};

type Props = ComponentProps<typeof AttachmentSection>;

function renderSection(props?: Partial<Props>) {
  return render(
    <AttachmentSection
      projectId="p1"
      entity="tasks"
      entityId="e1"
      attachments={[FILE_ATT, LINK_ATT]}
      canEdit
      onChanged={() => {}}
      {...props}
    />,
  );
}

describe('AttachmentSection', () => {
  it('lists file size and link badge', () => {
    renderSection();
    expect(screen.getByText('screenshot.png')).toBeDefined();
    expect(screen.getByText('1.8 MB')).toBeDefined();
    expect(screen.getByText('Spec')).toBeDefined();
    expect(screen.getByText('Link')).toBeDefined();
  });

  it('renders no decorative icons (text-only rows)', () => {
    const { container } = renderSection();
    const section = container.querySelector('section')!;
    const heading = section.querySelector('h4')!;
    expect(heading.querySelector('svg')).toBeNull();
    const rows = section.querySelectorAll('.mini-row');
    expect(rows.length).toBe(2);
    for (const row of rows) {
      // Ikon hanya boleh hidup di dalam tombol aksi, bukan sebagai dekorasi teks.
      for (const svg of row.querySelectorAll('svg')) {
        expect(svg.closest('button')).not.toBeNull();
      }
    }
  });

  it('hides upload controls for viewers', () => {
    renderSection({ canEdit: false, attachments: [] });
    expect(screen.queryByRole('button', { name: /Add attachment|Tambah lampiran/ })).toBeNull();
    expect(screen.getByText('Attachments')).toBeDefined();
  });

  it('delete opens a confirm modal and removes on confirm', async () => {
    const onChanged = vi.fn();
    renderSection({ onChanged });
    fireEvent.click(screen.getByRole('button', { name: 'Remove screenshot.png' }));
    expect(await screen.findByText('Remove attachment?')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(onChanged.mock.calls[0]![0]).toHaveLength(1);
  });

  it('shows cap notice at 20 attachments', () => {
    const many: Attachment[] = Array.from({ length: 20 }, (_, i) => ({ ...FILE_ATT, id: `a-${i}` }));
    renderSection({ attachments: many });
    expect(screen.getByText(/Attachment limit reached/)).toBeDefined();
  });

  it('staged mode shows staged hint and hides download for stored files', () => {
    renderSection({ mode: 'staged' });
    expect(screen.getByText(/attached when you save/)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Open screenshot.png' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open Spec' })).toBeDefined();
  });

  it('staged link add is local (no server call)', async () => {
    const { api } = await import('../lib/api');
    const onChanged = vi.fn();
    renderSection({ mode: 'staged', attachments: [], onChanged });
    fireEvent.click(screen.getByRole('button', { name: /Add attachment/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Add link/ }));
    fireEvent.change(screen.getByLabelText(/Link name/), { target: { value: 'Doc' } });
    fireEvent.change(screen.getByLabelText('Link URL'), { target: { value: 'https://example.com/d.pdf' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.attachmentAddLink)).not.toHaveBeenCalled();
    const next = onChanged.mock.calls[0]![0] as Attachment[];
    expect(next).toHaveLength(1);
    expect(next[0]!.provider).toBe('link');
  });

  it('staged delete of a stored file calls abandon', async () => {
    const { api } = await import('../lib/api');
    const onChanged = vi.fn();
    renderSection({ mode: 'staged', onChanged });
    fireEvent.click(screen.getByRole('button', { name: 'Remove screenshot.png' }));
    expect(await screen.findByText('Remove attachment?')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(vi.mocked(api.attachmentAbandon)).toHaveBeenCalledTimes(1));
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('shows Eye preview for previewable files and opens the preview modal', async () => {
    renderSection();
    const previewBtn = screen.getByRole('button', { name: 'Preview screenshot.png' });
    expect(previewBtn).toBeDefined();
    // Link tanpa mime previewable tidak dapat tombol preview.
    expect(screen.queryByRole('button', { name: 'Preview Spec' })).toBeNull();
    fireEvent.click(previewBtn);
    // Modal terbuka (sign-download gagal di test → tampil error, bukan crash).
    expect(await screen.findByRole('dialog')).toBeDefined();
    expect(await screen.findByText(/Download failed/)).toBeDefined();
  });

  it('link allows empty title (defaults to domain)', async () => {
    const { api } = await import('../lib/api');
    const onChanged = vi.fn();
    renderSection({ mode: 'staged', attachments: [], onChanged });
    fireEvent.click(screen.getByRole('button', { name: /Add attachment/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Add link/ }));
    fireEvent.change(screen.getByLabelText('Link URL'), { target: { value: 'https://example.com/d.pdf' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    const next = onChanged.mock.calls[0]![0] as Attachment[];
    expect(next).toHaveLength(1);
    expect(next[0]!.name).toBe('example.com');
    expect(vi.mocked(api.attachmentAddLink)).not.toHaveBeenCalled();
  });
});
