import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Modal } from './Modal';

describe('Modal scroll lock', () => {
  it('restores body overflow on close', () => {
    const { rerender } = render(
      <Modal open title="Detail" onClose={() => {}}>
        detail
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    rerender(
      <Modal open={false} title="Detail" onClose={() => {}}>
        detail
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('');
  });

  it('keeps body locked while one of two nested modals closes', () => {
    const detail = (
      <Modal open title="Detail" onClose={() => {}}>
        detail
      </Modal>
    );
    const confirm = (
      <Modal open title="Confirm" onClose={() => {}}>
        confirm
      </Modal>
    );
    const { rerender } = render(
      <>
        {detail}
        {confirm}
      </>,
    );
    expect(screen.getByText('detail')).toBeTruthy();
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<>{detail}</>);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores body overflow when nested modals unmount together (delete flow)', () => {
    const { rerender } = render(
      <>
        <Modal open title="Detail" onClose={() => {}}>
          detail
        </Modal>
        <Modal open title="Confirm" onClose={() => {}}>
          confirm
        </Modal>
      </>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<></>);
    expect(document.body.style.overflow).toBe('');
  });

  it('reopens after a previous unlock', () => {
    const { rerender } = render(
      <Modal open title="Detail" onClose={() => {}}>
        detail
      </Modal>,
    );
    rerender(
      <Modal open={false} title="Detail" onClose={() => {}}>
        detail
      </Modal>,
    );
    rerender(
      <Modal open title="Detail" onClose={() => {}}>
        detail
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    rerender(
      <Modal open={false} title="Detail" onClose={() => {}}>
        detail
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('');
  });
});