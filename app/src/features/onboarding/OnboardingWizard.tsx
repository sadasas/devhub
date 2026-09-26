import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../components/Modal';
import { WizardFooter } from '../../components/WizardFooter';
import { TourProgressPill } from './TourProgressPill';
import { TourPopover } from './TourPopover';
import { TourSpotlight } from './TourSpotlight';
import { getTourStep } from './tourSteps';

interface OnboardingWizardProps {
  step: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onFinish: () => void;
  /**
   * Hard gate for Next: 'team' (step 1, no team yet) or 'project'
   * (step 2, no project yet). Back/Skip/ESC stay free.
   */
  blockReason?: 'team' | 'project' | null;
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  );
}

/**
 * True while another modal (create team/project) stacks above the tour.
 * The popover + spotlight hide until it closes, then resume at the same step.
 */
function useStackedModal(): boolean {
  const [stacked, setStacked] = useState(false);
  useEffect(() => {
    const check = () => {
      try {
        setStacked(document.querySelectorAll('.modal-backdrop').length > 1);
      } catch {
        /* DOM unavailable */
      }
    };
    check();
    let observer: MutationObserver | null = null;
    try {
      observer = new MutationObserver(check);
      observer.observe(document.body, { childList: true, subtree: false });
    } catch {
      observer = null;
    }
    return () => {
      try {
        observer?.disconnect();
      } catch {
        /* ignore */
      }
    };
  }, []);
  return stacked;
}

export function OnboardingWizard({
  step,
  total,
  onNext,
  onBack,
  onSkip,
  onFinish,
  blockReason = null,
}: OnboardingWizardProps) {
  const { t } = useTranslation('project');
  const def = getTourStep(step);
  const title = t(`tour.${def.id}.title`);
  const body = t(`tour.${def.id}.body`);
  const isFirst = step === 0;
  const isLast = step === total - 1;
  const bodyId = useId();
  const titleId = useId();
  const hasTargets = def.targetIds.length > 0;
  const suppressed = useStackedModal();
  // Hard gate: Next stays disabled until the required object exists.
  // Skip/Back/ESC are never blocked.
  const blocked = blockReason === 'team' || blockReason === 'project';
  // autoFocus hanya desktop (hover) — di touch, keyboard virtual melonjak (pola Modal).
  // Satu target saja: blocked → Skip, tak blocked → Next/Finish.
  const autoFocusDesktop = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

  // ArrowLeft/Right = Back/Next (full keyboard nav). ESC = skip (Modal owns it
  // for the welcome step; TourPopover owns it for anchored steps).
  // A hard block also stops ArrowRight (same guard style as stacked modals).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      // Don't steal keys when another modal (create team/project) sits above us.
      const modals = document.querySelectorAll('.modal-backdrop');
      if (modals.length > 1) return;
      if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (blocked) return;
        if (isLast) onFinish();
        else onNext();
      } else if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (!isFirst) {
          e.preventDefault();
          onBack();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFirst, isLast, onBack, onFinish, onNext, blocked]);

  const footer = (
    <WizardFooter
      onSkip={onSkip}
      skipLabel={t('tour.common.skip')}
      skipAriaLabel={t('tour.common.skipAll')}
      autoFocusSkip={autoFocusDesktop && blocked}
      onBack={!isFirst ? onBack : undefined}
      backLabel={t('tour.common.back')}
      onAdvance={isLast ? onFinish : onNext}
      advanceLabel={isLast ? t('tour.common.done') : def.id === 'welcome' ? t('tour.common.start') : t('tour.common.next')}
      advanceMode={isLast ? 'finish' : 'next'}
      advanceDisabled={blocked}
      advanceDisabledReason={blocked ? t(blockReason === 'team' ? 'tour.common.needTeam' : 'tour.common.needProject') : undefined}
      autoFocusAdvance={autoFocusDesktop && !blocked}
    />
  );

  const cardBody = (
    <div className="tour-wizard-body">
      <div className="tour-wizard-top">
        <TourProgressPill current={step + 1} total={total} />
      </div>
      <p id={bodyId} className="modal-copy">
        {body}
      </p>
      {blocked && blockReason && (
        <p className="tour-block-hint" role="note">
          {t(blockReason === 'team' ? 'tour.common.needTeam' : 'tour.common.needProject')}
        </p>
      )}
    </div>
  );

  return (
    <>
      <TourSpotlight targetIds={def.targetIds} suppressed={suppressed} />
      {suppressed ? null : hasTargets ? (
        <TourPopover
          targetIds={def.targetIds}
          labelledBy={titleId}
          describedBy={bodyId}
          onEscape={onSkip}
        >
          <div className="tour-popover-head">
            <h2 id={titleId} className="tour-popover-title">
              {title}
            </h2>
          </div>
          <div className="tour-popover-body">{cardBody}</div>
          <div className="tour-popover-foot">{footer}</div>
        </TourPopover>
      ) : (
        <Modal
          open
          title={title}
          onClose={onSkip}
          width="sm"
          className="tour-wizard-modal"
          ariaDescribedBy={bodyId}
          footer={footer}
        >
          {cardBody}
        </Modal>
      )}
    </>
  );
}
