import { act, fireEvent, render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Tooltip, TooltipCard } from './Tooltip';

function renderTip() {
  return render(
    <Tooltip content="Halo tip" delay={150}>
      <button type="button">Trigger</button>
    </Tooltip>,
  );
}

describe('Tooltip', () => {
  it('muncul saat hover setelah delay dan hilang saat leave', () => {
    vi.useFakeTimers();
    try {
      renderTip();
      const btn = screen.getByRole('button', { name: 'Trigger' });
      expect(screen.queryByRole('tooltip')).toBeNull();
      // floating-ui pasang listener native mouseenter — pakai mouseEnter, bukan mouseOver.
      fireEvent.mouseEnter(btn);
      expect(screen.queryByRole('tooltip')).toBeNull();
      act(() => {
        vi.advanceTimersByTime(200);
      });
      const tip = screen.getByRole('tooltip');
      expect(tip.textContent).toBe('Halo tip');
      fireEvent.mouseLeave(btn);
      expect(screen.queryByRole('tooltip')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('muncul saat fokus keyboard dan hilang saat blur', async () => {
    renderTip();
    const btn = screen.getByRole('button', { name: 'Trigger' });
    fireEvent.focus(btn);
    expect(screen.getByRole('tooltip').textContent).toBe('Halo tip');
    fireEvent.blur(btn);
    // close-blur floating-ui async (setTimeout) — tunggu sampai hilang.
    await waitForElementToBeRemoved(() => screen.queryByRole('tooltip'));
  });

  it('mendukung title + description + icon + media dalam satu gaya inverse', () => {
    render(
      <Tooltip side="bottom" title="Judul" description="Deskripsi" icon={<span>i</span>} media={<img alt="" src="x.png" />}>
        <button type="button">T</button>
      </Tooltip>,
    );
    fireEvent.focus(screen.getByRole('button', { name: 'T' }));
    const tip = screen.getByRole('tooltip');
    // Satu gaya: tanpa suffix tone apa pun.
    expect(tip.querySelector('.tooltip-card')).not.toBeNull();
    expect(tip.querySelector('.tooltip-card-dark,.tooltip-card-light,.tooltip-card-info')).toBeNull();
    expect(tip.querySelector('.tooltip-arrow-light,.tooltip-arrow-info')).toBeNull();
    expect(tip.textContent).toContain('Judul');
    expect(tip.textContent).toContain('Deskripsi');
  });

  it('disabled menutup tooltip yang sedang terbuka', () => {
    const { rerender } = render(
      <Tooltip content="Halo tip">
        <button type="button">Trigger</button>
      </Tooltip>,
    );
    const btn = screen.getByRole('button', { name: 'Trigger' });
    fireEvent.focus(btn);
    expect(screen.getByRole('tooltip').textContent).toBe('Halo tip');
    rerender(
      <Tooltip content="Halo tip" disabled>
        <button type="button">Trigger</button>
      </Tooltip>,
    );
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('disabled tidak menampilkan tooltip', () => {
    vi.useFakeTimers();
    try {
      render(
        <Tooltip content="Jangan muncul" disabled>
          <button type="button">X</button>
        </Tooltip>,
      );
      fireEvent.mouseEnter(screen.getByRole('button', { name: 'X' }));
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(screen.queryByRole('tooltip')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('TooltipCard', () => {
  it('render kartu single-style dengan judul', () => {
    render(
      <TooltipCard title="Kolom A">
        <span>baris kustom</span>
      </TooltipCard>,
    );
    expect(document.querySelector('.tooltip-card')?.textContent).toContain('Kolom A');
  });
});
