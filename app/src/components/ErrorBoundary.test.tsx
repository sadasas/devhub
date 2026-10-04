import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Boom(): never {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  it('shows the broken doodle on render failure', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>,
      );
      expect(screen.getByLabelText('broken')).toBeTruthy();
      expect(screen.getByTestId('error-boundary')).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  });
});
