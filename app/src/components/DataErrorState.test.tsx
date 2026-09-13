import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ApiError } from '../lib/api';
import { DataErrorState } from './DataErrorState';

describe('DataErrorState', () => {
  it('humanizes a bare 429 without leaking the technical message', () => {
    render(<DataErrorState error={new ApiError(429, 'INTERNAL', 'Too Many Requests')} />);
    expect(screen.getByText('Too many requests')).toBeDefined();
    expect(screen.getByText('Wait a moment, then try again.')).toBeDefined();
    expect(screen.queryByText('Too Many Requests')).toBeNull();
  });
  it('humanizes 5xx and offline errors', () => {
    const { unmount } = render(<DataErrorState error={new ApiError(503, 'UNAVAILABLE', 'boom')} />);
    expect(screen.getByText('Server trouble')).toBeDefined();
    unmount();
    render(<DataErrorState error={new ApiError(0, 'NETWORK', 'fetch failed')} />);
    expect(screen.getByText('Not connected')).toBeDefined();
  });
  it('renders a retry button that calls onRetry', () => {
    const onRetry = vi.fn();
    render(<DataErrorState error={new ApiError(500, 'INTERNAL', 'x')} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
  it('renders business copy for allowlisted codes', () => {
    render(<DataErrorState error={new ApiError(402, 'PLAN_LIMIT', 'Downgrade blocked')} />);
    expect(screen.getByText('Needs attention')).toBeDefined();
  });
});
