import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Pager } from './Pager';

describe('Pager', () => {
  it('renders Showing x of y + prev/next/numbered', () => {
    const onPage = vi.fn();
    render(<Pager page={1} totalPages={3} totalItems={30} pageSize={25} onPageChange={onPage} ariaLabel="Users pagination" />);
    expect(screen.getByText(/Showing 1.*of 30/)).toBeDefined();
    expect(screen.getByRole('button', { name: /Previous|Sebelumnya/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /Next|Berikutnya/ })).toBeDefined();
    const p2 = screen.getByRole('button', { name: /Go to page 2|Ke halaman 2/ });
    fireEvent.click(p2);
    expect(onPage).toHaveBeenCalledWith(2);
    // current page disabled + aria-current
    expect(screen.getByRole('button', { name: /Go to page 1|Ke halaman 1/ }).getAttribute('aria-current')).toBe('page');
  });

  it('returns null when single page or empty', () => {
    const { container, rerender } = render(
      <Pager page={1} totalPages={1} totalItems={5} pageSize={25} onPageChange={() => {}} ariaLabel="x" />,
    );
    expect(container.firstChild).toBeNull();
    rerender(<Pager page={1} totalPages={1} totalItems={0} pageSize={25} onPageChange={() => {}} ariaLabel="x" />);
    expect(container.firstChild).toBeNull();
  });
});
