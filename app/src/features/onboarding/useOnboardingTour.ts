import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  TOUR_REPLAY_EVENT,
  TOUR_TOTAL,
  clearReplayPending,
  clearTourStep,
  isTourFinished,
  isTourSkipped,
  readTourStep,
  setTourActiveFlag,
  setTourFinished,
  setTourSkipped,
  subscribeTour,
  trackTourEvent,
  writeTourStep,
} from './tour-events';

export interface OnboardingTour {
  active: boolean;
  step: number;
  total: number;
  skipped: boolean;
  finished: boolean;
  start: (at?: number) => void;
  next: () => void;
  back: () => void;
  goTo: (step: number) => void;
  skip: () => void;
  finish: () => void;
  replay: () => void;
}

function getSnapshot(): number {
  return readTourStep();
}

export function useOnboardingTour(): OnboardingTour {
  const stepFromStore = useSyncExternalStore(subscribeTour, getSnapshot, getSnapshot);
  const [active, setActive] = useState(false);
  const [skipped, setSkipped] = useState(() => isTourSkipped());
  const [finished, setFinished] = useState(() => isTourFinished());
  const [step, setStep] = useState(() => readTourStep());

  // Keep local step in sync with cross-route writes (Dashboard -> Project nav).
  useEffect(() => {
    setStep(stepFromStore);
  }, [stepFromStore]);

  // Publish active flag for N / Alt+digit guards + spotlight CSS.
  useEffect(() => {
    setTourActiveFlag(active);
    return () => {
      setTourActiveFlag(false);
    };
  }, [active]);

  const start = useCallback((at = 0) => {
    const clamped = Math.min(Math.max(at, 0), TOUR_TOTAL - 1);
    setSkipped(false);
    setFinished(false);
    setTourSkipped(false);
    setTourFinished(false);
    try {
      localStorage.removeItem('devhub:tour:skipped');
      localStorage.removeItem('devhub:tour:finished');
    } catch {
      /* ignore */
    }
    setStep(clamped);
    writeTourStep(clamped);
    setActive(true);
    trackTourEvent('tour_started', { at: clamped });
  }, []);

  const goTo = useCallback((next: number) => {
    const clamped = Math.min(Math.max(next, 0), TOUR_TOTAL - 1);
    setStep(clamped);
    writeTourStep(clamped);
    trackTourEvent('tour_step', { step: clamped });
  }, []);

  const next = useCallback(() => {
    setStep((prev) => {
      const clamped = Math.min(prev + 1, TOUR_TOTAL - 1);
      writeTourStep(clamped);
      trackTourEvent('tour_step', { step: clamped, dir: 'next' });
      return clamped;
    });
  }, []);

  const back = useCallback(() => {
    setStep((prev) => {
      const clamped = Math.max(prev - 1, 0);
      writeTourStep(clamped);
      trackTourEvent('tour_step', { step: clamped, dir: 'back' });
      return clamped;
    });
  }, []);

  const skip = useCallback(() => {
    setTourSkipped(true);
    setSkipped(true);
    setActive(false);
    setTourActiveFlag(false);
    trackTourEvent('tour_skipped', { step });
  }, [step]);

  const finish = useCallback(() => {
    setTourFinished(true);
    setFinished(true);
    setActive(false);
    setTourActiveFlag(false);
    clearTourStep();
    trackTourEvent('tour_finished', {});
  }, []);

  const replay = useCallback(() => {
    clearReplayPending();
    trackTourEvent('tour_replayed', {});
    start(0);
  }, [start]);

  // Global replay entry (Sidebar Help + command palette + docs).
  useEffect(() => {
    const onReplay = () => replay();
    window.addEventListener(TOUR_REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(TOUR_REPLAY_EVENT, onReplay);
  }, [replay]);

  return { active, step, total: TOUR_TOTAL, skipped, finished, start, next, back, goTo, skip, finish, replay };
}
