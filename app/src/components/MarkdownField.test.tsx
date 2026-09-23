import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownField } from './MarkdownField';
import type { Attachment } from '../lib/types';

vi.mock('../lib/api', () => ({
  api: {
    attachmentSignDownload: vi.fn().mockResolvedValue({
      downloadUrl: 'https://x.test/f.png',
      expiresIn: 60,
      name: 'ss.png',
      mime: 'image/png',
      size: 10,
    }),
  },
}));

const ATT: Attachment = {
  id: 'a1',
  provider: 'devhub',
  name: 'ss.png',
  mime: 'image/png',
  size: 10,
  storageKey: 'k',
  url: null,
  linkedAt: new Date().toISOString(),
};

describe('MarkdownField embedAttachments', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => new Blob(['x'], { type: 'image/png' }) })));
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
  });

  it('renders attachment refs inline when context is provided', async () => {
    render(
      <MarkdownField
        label="Description"
        value="lihat ![ss.png](attachment:a1) ini"
        onChange={() => {}}
        variant="bare"
        embedAttachments={{ projectId: 'p1', attachments: [ATT] }}
      />,
    );
    expect(await screen.findByAltText('ss.png')).toBeTruthy();
  });

  it('falls back to alt text without context', () => {
    render(<MarkdownField label="Description" value="lihat ![ss.png](attachment:a1) ini" onChange={() => {}} variant="bare" />);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText(/ss\.png/)).toBeTruthy();
  });
});
