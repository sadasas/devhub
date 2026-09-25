import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownBlocks } from './markdown';

describe('markdown image embeds (Linear-style)', () => {
  it('renders external image syntax as img', () => {
    render(<MarkdownBlocks text="lihat ![denah](https://x.test/denah.png) ini" />);
    const img = document.querySelector('img[alt="denah"]') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.src).toBe('https://x.test/denah.png');
  });

  it('falls back to alt text for attachment refs without context', () => {
    render(<MarkdownBlocks text="lihat ![ss.png](attachment:abc123) ini" />);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText(/ss\.png/)).toBeDefined();
  });

  it('keeps classic link and bold rendering', () => {
    render(<MarkdownBlocks text="baca [dok](https://x.test/d) dan **tegas**" />);
    expect(screen.getByRole('link', { name: 'dok' }).getAttribute('href')).toBe('https://x.test/d');
    expect(document.querySelector('strong')).not.toBeNull();
  });

  it('renders javascript: links as plain text (XSS fixture)', () => {
    render(<MarkdownBlocks text="Link jahat harus jadi teks plain: [evil](javascript:alert(1))" />);
    expect(screen.queryByRole('link', { name: 'evil' })).toBeNull();
    expect(screen.getByText(/evil/)).toBeDefined();
  });
});
