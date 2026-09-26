import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ArrowSquareOut, Tag } from '@phosphor-icons/react';
import { LinkButton } from './LinkButton';

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('LinkButton (link Tier-1 §9)', () => {
  it('internal: RouterLink + varian + size + ikon kiri', () => {
    renderWithRouter(
      <LinkButton to="/docs/mcp" variant="primary" size="md" leftIcon={<Tag size={14} aria-hidden="true" />}>
        Guide
      </LinkButton>,
    );
    const link = screen.getByRole('link', { name: 'Guide' });
    expect(link.getAttribute('href')).toBe('/docs/mcp');
    expect(link.className).toContain('btn-primary');
    expect(link.className).toContain('btn-md');
    expect(link.querySelector('.btn-icon-wrap')).not.toBeNull();
  });

  it('eksternal: anchor + rel default saat target blank', () => {
    renderWithRouter(
      <LinkButton href="https://example.com" target="_blank">
        Demo
      </LinkButton>,
    );
    const link = screen.getByRole('link', { name: 'Demo' });
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('https://example.com');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.className).toContain('btn-secondary');
    expect(link.className).toContain('btn-sm');
  });

  it('rel eksplisit dipertahankan + atribut anchor diteruskan', () => {
    renderWithRouter(
      <LinkButton href="/api/v1/auth/google" rel="external" data-external="true" aria-label="Connect Google">
        Connect
      </LinkButton>,
    );
    const link = screen.getByRole('link', { name: 'Connect Google' });
    expect(link.getAttribute('rel')).toBe('external');
    expect(link.getAttribute('data-external')).toBe('true');
  });

  it('iconPosition right: ikon di belakang label', () => {
    const { container } = renderWithRouter(
      <LinkButton href="https://example.com" target="_blank" iconPosition="right" leftIcon={<ArrowSquareOut size={11} aria-hidden="true" />}>
        Demo
      </LinkButton>,
    );
    const link = container.querySelector('a') as HTMLElement;
    const tags = Array.from(link.childNodes).map((n) =>
      n.nodeType === 3 ? '#text' : (n as HTMLElement).tagName,
    );
    expect(tags[tags.length - 1]).toBe('SPAN');
    expect(link.querySelector('.btn-icon-wrap')).not.toBeNull();
  });
});
