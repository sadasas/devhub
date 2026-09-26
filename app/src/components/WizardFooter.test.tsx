import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WizardFooter } from './WizardFooter';

describe('WizardFooter (tur dual-host Tier-1)', () => {
  it('langkah pertama: Skip + spacer + Next, tanpa Back', () => {
    render(
      <WizardFooter
        onSkip={() => {}}
        skipLabel="Skip"
        onAdvance={() => {}}
        advanceLabel="Next"
        advanceMode="next"
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Skip', 'Next']);
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('dengan onBack: urutan Skip, Back, Next + spacer', () => {
    const { container } = render(
      <WizardFooter
        onSkip={() => {}}
        skipLabel="Skip"
        onBack={() => {}}
        backLabel="Back"
        onAdvance={() => {}}
        advanceLabel="Next"
        advanceMode="next"
      />,
    );
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Skip',
      'Back',
      'Next',
    ]);
    const spacer = container.querySelector('.tour-footer-spacer');
    expect(spacer).not.toBeNull();
    expect(spacer?.getAttribute('aria-hidden')).toBe('true');
  });

  it('mode finish: ikon Flag di depan label + tour-id finish', () => {
    render(
      <WizardFooter
        onSkip={() => {}}
        skipLabel="Skip"
        onAdvance={() => {}}
        advanceLabel="Done"
        advanceMode="finish"
      />,
    );
    const done = screen.getByRole('button', { name: 'Done' });
    expect(done.getAttribute('data-tour-id')).toBe('wizard-finish');
    expect(done.querySelector('svg')).not.toBeNull();
  });

  it('gate: Next disabled + aria-disabled + title alasan', () => {
    render(
      <WizardFooter
        onSkip={() => {}}
        skipLabel="Skip"
        onAdvance={() => {}}
        advanceLabel="Next"
        advanceMode="next"
        advanceDisabled
        advanceDisabledReason="Need team"
      />,
    );
    const next = screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    expect(next.getAttribute('aria-disabled')).toBe('true');
    expect(next.getAttribute('title')).toBe('Need team');
  });

  it('handler Skip/Back/Next dipanggil', () => {
    const onSkip = vi.fn();
    const onBack = vi.fn();
    const onAdvance = vi.fn();
    render(
      <WizardFooter
        onSkip={onSkip}
        skipLabel="Skip"
        onBack={onBack}
        backLabel="Back"
        onAdvance={onAdvance}
        advanceLabel="Next"
        advanceMode="next"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });
});
