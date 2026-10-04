import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthHeroArt } from './AuthHeroArt';

describe('AuthHeroArt', () => {
  it('renders the large brand composition without faces or text', () => {
    const { container } = render(<AuthHeroArt />);
    expect(screen.getByLabelText('auth-hero')).toBeTruthy();
    const svg = container.querySelector('svg');
    expect(svg).toBeDefined();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 480 560');
    expect(svg?.innerHTML).not.toContain('<text');
    expect(svg?.innerHTML).not.toContain('#e8a0a0');
  });
});
