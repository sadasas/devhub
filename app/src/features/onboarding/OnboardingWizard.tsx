import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Flag } from '@phosphor-icons/react';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
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
    <>
      {/* Skip: always visible, one click, >=24px. */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onSkip}
        autoFocus={autoFocusDesktop && blocked}
        aria-label={t('tour.common.skipAll')}
        className="tour-skip-btn"
        data-tour-id="wizard-skip"
      >
        {t('tour.common.skip')}
      </Button>
      <span className="tour-footer-spacer" aria-hidden="true" />
      {!isFirst && (
        <Button variant="ghost" size="sm" onClick={onBack} leftIcon={<ArrowLeft size={14} aria-hidden="true" />}>
          {t('tour.common.back')}
        </Button>
      )}
      {isLast ? (
        <Button
          variant="primary"
          size="sm"
          onClick={onFinish}
          autoFocus={autoFocusDesktop && !blocked}
          leftIcon={<Flag size={14} aria-hidden="true" />}
          data-tour-id="wizard-finish"
        >
          {t('tour.common.done')}
        </Button>
      ) : (
        <Button
          variant="primary"
          size="sm"
          onClick={onNext}
          autoFocus={autoFocusDesktop && !blocked}
          disabled={blocked}
          aria-disabled={blocked}
          title={blocked ? t(blockReason === 'team' ? 'tour.common.needTeam' : 'tour.common.needProject') : undefined}
          data-tour-id="wizard-next"
        >
          <span>{def.id === 'welcome' ? t('tour.common.start') : t('tour.common.next')}</span>
          <ArrowRight size={14} aria-hidden="true" />
        </Button>
      )}
    </>
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
