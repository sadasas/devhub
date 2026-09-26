import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Plus } from '@phosphor-icons/react';
import { Button } from './Button';
import { ModalFooter } from './ModalFooter';
import { ConfirmFooter } from './ConfirmFooter';

describe('ModalFooter (kanonis Tier-1 §4b)', () => {
  it('render Cancel ghost kiri + aksi kanan sesuai urutan', () => {
    render(
      <ModalFooter onCancel={() => {}}>
        <Button size="md">Save</Button>
      </ModalFooter>,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.textContent).toContain('Cancel');
    expect(buttons[1]?.textContent).toContain('Save');
    expect(buttons[0]?.className).toContain('btn-ghost');
  });

  it('cancelLabel kustom + onCancel dipanggil', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <ModalFooter onCancel={onCancel} cancelLabel="Back">
        <Button size="md">Save</Button>
      </ModalFooter>,
    );
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('cancelDisabled menonaktifkan Cancel saja', () => {
    render(
      <ModalFooter onCancel={() => {}} cancelDisabled>
        <Button size="md">Save</Button>
      </ModalFooter>,
    );
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('ConfirmFooter (konfirmasi 2-langkah)', () => {
  it('default: danger + Delete + ikon Trash', () => {
    render(<ConfirmFooter onCancel={() => {}} onConfirm={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.textContent).toContain('Cancel');
    const confirm = buttons[1] as HTMLButtonElement;
    expect(confirm?.textContent).toContain('Delete');
    expect(confirm?.className).toContain('btn-danger');
  });

  it('tone primary + label dan ikon kustom', () => {
    render(
      <ConfirmFooter
        onCancel={() => {}}
        onConfirm={() => {}}
        tone="primary"
        confirmLabel="Unlink"
        confirmIcon={<Plus size={14} aria-hidden="true" />}
      />,
    );
    const confirm = screen.getByRole('button', { name: 'Unlink' });
    expect(confirm.className).toContain('btn-primary');
    expect(confirm.className).not.toContain('btn-danger');
  });

  it('tone ghost untuk pengembalian non-destruktif (Restore)', () => {
    render(
      <ConfirmFooter onCancel={() => {}} onConfirm={() => {}} tone="ghost" confirmLabel="Restore" />,
    );
    expect(screen.getByRole('button', { name: 'Restore' }).className).toContain('btn-ghost');
  });

  it('busy: Cancel disabled + konfirmasi loading (aria-busy)', () => {
    render(<ConfirmFooter onCancel={() => {}} onConfirm={() => {}} busy />);
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true);
    const confirm = screen.getByRole('button', { name: 'Delete' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(confirm.getAttribute('aria-busy')).toBe('true');
  });

  it('confirmDisabled tanpa busy: Cancel tetap aktif', () => {
    render(<ConfirmFooter onCancel={() => {}} onConfirm={() => {}} confirmDisabled />);
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: 'Delete' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('onConfirm dipanggil saat klik', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmFooter onCancel={() => {}} onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
