import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InlineError } from './InlineError';

describe('InlineError (global field-level error)', () => {
  it('renders role alert + icon + text', () => {
    const { unmount } = render(<InlineError>Boom failed</InlineError>);
    const node = screen.getByRole('alert');
    expect(node.getAttribute('aria-atomic')).toBe('true');
    expect(node.querySelector('svg')).toBeTruthy();
    expect(node.textContent).toContain('Boom failed');
    unmount();
  });

  it('forwards className and id', () => {
    const { unmount } = render(
      <InlineError id="field-err" className="billing-warn">
        Warn text
      </InlineError>,
    );
    const node = screen.getByRole('alert');
    expect(node.getAttribute('id')).toBe('field-err');
    expect(node.className).toContain('billing-warn');
    unmount();
  });
});
