import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DetailFooter } from './DetailFooter';

describe('DetailFooter (autosave Tier-1)', () => {
  it('Delete danger sm kiri + save-state kanan sesuai urutan', () => {
    render(
      <DetailFooter onDelete={() => {}} deleteLabel="Delete">
        <span className="save-state" role="status">
          Saved
        </span>
      </DetailFooter>,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    const del = buttons[0] as HTMLButtonElement;
    expect(del.textContent).toContain('Delete');
    expect(del.className).toContain('btn-danger');
    expect(screen.getByRole('status').textContent).toContain('Saved');
    const footer = del.parentElement;
    expect(footer !== null && Array.from(footer.children).map((el) => el.tagName)).toEqual([
      'BUTTON',
      'SPAN',
    ]);
  });

  it('tanpa save-state: hanya tombol Delete', () => {
    render(<DetailFooter onDelete={() => {}} deleteLabel="Delete" />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('onDelete dipanggil saat klik', () => {
    const onDelete = vi.fn();
    render(
      <DetailFooter onDelete={onDelete} deleteLabel="Delete">
        <span className="save-state" role="status">
          Saved
        </span>
      </DetailFooter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
