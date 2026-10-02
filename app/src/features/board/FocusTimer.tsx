import { useEffect, useRef, useState } from 'react';
import { ArrowCounterClockwise, CheckCircle, Hourglass, Pause, Play, Timer } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button';
import { BottomSheet } from '../../components/BottomSheet';
import { Tooltip } from '../../components/Tooltip';
import { track } from '../../lib/analytics';

export function formatFocusTimer(secs: number): string {
  const safe = Math.max(0, Math.floor(secs));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

interface TimerSheetBodyProps {
  display: string;
  almostDone: boolean;
  mode: 'up' | 'down';
  running: boolean;
  finished: boolean;
  showReset: boolean;
  durationSecs: number;
  onChangeMode: (next: 'up' | 'down') => void;
  onStep: (delta: number) => void;
  onPlay: () => void;
  onReset: () => void;
  onSetDuration: (totalSecs: number) => void;
}

function TimerSheetBody({
  display,
  almostDone,
  mode,
  running,
  finished,
  showReset,
  durationSecs,
  onChangeMode,
  onStep,
  onPlay,
  onReset,
  onSetDuration,
}: TimerSheetBodyProps) {
  const { t } = useTranslation('tracker');
  const showStepper = mode === 'down' && !running && !finished;
  const canEdit = mode === 'down' && !running && !finished;
  const [editing, setEditing] = useState(false);
  const [mm, setMm] = useState('');
  const [ss, setSs] = useState('');
  const mmRef = useRef<HTMLInputElement>(null);
  const ssRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!canEdit) setEditing(false);
  }, [canEdit]);

  const startEdit = () => {
    if (!canEdit) return;
    setMm(String(Math.floor(durationSecs / 60)).padStart(2, '0'));
    setSs(String(durationSecs % 60).padStart(2, '0'));
    setEditing(true);
  };

  const applyEdit = () => {
    const parsedMm = parseInt(mm.replace(/\D/g, '') || '0', 10);
    const parsedSs = parseInt(ss.replace(/\D/g, '') || '0', 10);
    const clampedMm = Math.min(999, Math.max(0, Number.isNaN(parsedMm) ? 0 : parsedMm));
    const clampedSs = Math.min(59, Math.max(0, Number.isNaN(parsedSs) ? 0 : parsedSs));
    onSetDuration(clampedMm * 60 + clampedSs);
    setEditing(false);
  };

  const cancelEdit = () => setEditing(false);

  const inputStyle = {
    width: '3ch',
    textAlign: 'center' as const,
    fontSize: 'var(--text-display)',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums' as const,
    padding: '4px 6px',
  };

  return (
    <div>
      {canEdit && editing ? (
        <div
          className="focus-timer-big"
          style={{
            fontSize: 'var(--text-display)',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontVariantNumeric: 'tabular-nums',
            color: almostDone ? 'var(--status-warn)' : 'var(--text-primary)',
          }}
          onBlur={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
            applyEdit();
          }}
        >
          <input
            ref={mmRef}
            autoFocus
            className="input"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            aria-label={t('board.focus.timerMinutes') as string}
            value={mm}
            onChange={(e) => {
              const next = e.target.value.replace(/\D/g, '').slice(0, 3);
              if (mm.length < 2 && next.length >= 2) ssRef.current?.focus();
              setMm(next);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyEdit();
              else if (e.key === 'Escape') {
                e.stopPropagation();
                cancelEdit();
              }
            }}
            style={inputStyle}
          />
          <span aria-hidden="true">:</span>
          <input
            ref={ssRef}
            className="input"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={2}
            aria-label={t('board.focus.timerSeconds') as string}
            value={ss}
            onChange={(e) => {
              setSs(e.target.value.replace(/\D/g, '').slice(0, 2));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyEdit();
              else if (e.key === 'Escape') {
                e.stopPropagation();
                cancelEdit();
              } else if (e.key === 'Backspace' && ss === '') {
                mmRef.current?.focus();
              }
            }}
            style={inputStyle}
          />
        </div>
      ) : canEdit ? (
        <button
          type="button"
          className="focus-timer-big"
          onClick={startEdit}
          title={display}
          aria-label={display}
          style={{
            display: 'block',
            width: '100%',
            padding: 0,
            background: 'transparent',
            border: 'none',
            fontFamily: 'inherit',
            fontSize: 'var(--text-display)',
            fontWeight: 700,
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
            color: almostDone ? 'var(--status-warn)' : 'var(--text-primary)',
            cursor: 'text',
          }}
        >
          {display}
        </button>
      ) : (
        <div
          aria-hidden="true"
          className="focus-timer-big"
          style={{
            fontSize: 'var(--text-display)',
            fontWeight: 700,
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
            color: almostDone ? 'var(--status-warn)' : 'var(--text-primary)',
          }}
        >
          {display}
        </div>
      )}
      <hr className="sheet-divider" aria-hidden="true" />
      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          variant={mode === 'up' ? 'primary' : 'secondary'}
          size="sm"
          aria-pressed={mode === 'up'}
          onClick={() => onChangeMode('up')}
        >
          {t('board.focus.timerStopwatch')}
        </Button>
        <Button
          variant={mode === 'down' ? 'primary' : 'secondary'}
          size="sm"
          aria-pressed={mode === 'down'}
          onClick={() => onChangeMode('down')}
        >
          {t('board.focus.timerCountdown')}
        </Button>
      </div>
      {showStepper && (
        <>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Button variant="secondary" size="sm" style={{ flex: 1 }} onClick={() => onStep(-1)}>
              {t('board.focus.timerSubtractMinute')}
            </Button>
            <Button variant="secondary" size="sm" style={{ flex: 1 }} onClick={() => onStep(1)}>
              {t('board.focus.timerAddMinute')}
            </Button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', margin: '8px 0 0' }}>
            {t('board.focus.timerDurationHint')}
          </p>
        </>
      )}
      <hr className="sheet-divider" aria-hidden="true" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <button
          type="button"
          onClick={onPlay}
          aria-label={running ? (t('board.focus.timerPause') as string) : (t('board.focus.timerPlay') as string)}
          title={running ? (t('board.focus.timerPause') as string) : (t('board.focus.timerPlay') as string)}
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            border: 'none',
            background: 'var(--text-primary)',
            color: 'var(--bg-base)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {running ? <Pause size={22} aria-hidden="true" /> : <Play size={22} aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={!showReset}
          aria-label={t('board.focus.timerReset') as string}
          title={t('board.focus.timerReset') as string}
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'transparent',
            border: '1px solid var(--border-strong)',
            color: 'var(--text-muted)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: showReset ? 'pointer' : 'default',
            opacity: showReset ? 1 : 0.45,
          }}
        >
          <ArrowCounterClockwise size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function FocusTimer() {
  const { t } = useTranslation('tracker');
  const [mode, setMode] = useState<'up' | 'down'>('down');
  const [secs, setSecs] = useState(0);
  const [running, setRunning] = useState(false);
  const [durationSecs, setDurationSecs] = useState(1500);
  const [finished, setFinished] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [coarse, setCoarse] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches,
  );
  const displayButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(hover: none)');
    const onChange = (e: MediaQueryListEvent) => setCoarse(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSecs((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (mode === 'down' && running && secs >= durationSecs) {
      setRunning(false);
      setFinished(true);
      track('timer_complete', { mode, duration: durationSecs });
    }
  }, [secs, durationSecs, mode, running]);

  useEffect(() => {
    if (sheetOpen) track('timer_sheet_open');
  }, [sheetOpen]);

  // Desktop inline panel dismiss: Escape closes + refocuses the number button.
  // Sheet (mobile) owns its own Escape via BottomSheet — unchanged.
  useEffect(() => {
    if (!sheetOpen || coarse) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSheetOpen(false);
        displayButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheetOpen, coarse]);

  // Desktop inline panel dismiss: outside mousedown closes.
  useEffect(() => {
    if (!sheetOpen || coarse) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (panelRef.current?.contains(target)) return;
      if (displayButtonRef.current?.contains(target)) return;
      setSheetOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [sheetOpen, coarse]);

  const displaySecs = mode === 'up' ? secs : Math.max(0, durationSecs - secs);
  const almostDone = mode === 'down' && !finished && displaySecs >= 1 && displaySecs <= 10;
  const display = formatFocusTimer(displaySecs);
  const timerLabel = t('board.focus.timerLabel') as string;

  const toggle = () => {
    if (finished) return;
    if (running) {
      track('timer_pause', { mode, elapsed: secs });
    } else if (secs === 0) {
      track('timer_start', { mode, duration: durationSecs });
    } else {
      track('timer_resume', { mode, elapsed: secs });
    }
    setRunning((v) => !v);
  };

  const reset = () => {
    track('timer_reset');
    setSecs(0);
    setRunning(false);
    setFinished(false);
  };

  const changeMode = (next: 'up' | 'down') => {
    track('timer_mode_switch', { mode: next });
    setMode(next);
    setSecs(0);
    setRunning(false);
    setFinished(false);
  };

  const stepDuration = (deltaMin: number) => {
    const next = Math.min(59940, Math.max(60, durationSecs + deltaMin * 60));
    setDurationSecs(next);
    track('timer_duration_set', { seconds: next, source: 'stepper' });
  };

  const setDuration = (totalSecs: number) => {
    const next = Math.min(59940, Math.max(60, totalSecs));
    setDurationSecs(next);
    track('timer_duration_set', { seconds: next, source: 'edit' });
  };

  const playInSheet = () => {
    const willStart = !running && !finished;
    toggle();
    if (willStart) setSheetOpen(false);
  };

  const showReset = secs > 0 || running || finished;
  // @phosphor-icons/react@2.1.10 has no Stopwatch export — Timer is the fallback.
  const ModeIcon = mode === 'down' ? Hourglass : Timer;

  return (
    <div className="focus-timer" style={{ position: 'relative' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span aria-hidden="true" style={{ display: 'inline-flex', color: 'var(--text-muted)' }}>
          <ModeIcon size={14} aria-hidden="true" />
        </span>
        <button
          type="button"
          ref={displayButtonRef}
          className="btn btn-ghost focus-timer-display"
          onClick={() => setSheetOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-label={timerLabel}
          title={display}
          style={{
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            color: almostDone ? 'var(--status-warn)' : 'var(--text-primary)',
          }}
        >
          {display}
          <span
            aria-hidden="true"
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              marginLeft: 4,
              display: 'inline-block',
              transform: sheetOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform var(--duration-fast) var(--ease-out)',
            }}
          >
            ▾
          </span>
        </button>
        <Tooltip title={running ? (t('board.focus.timerPause') as string) : (t('board.focus.timerPlay') as string)}>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon focus-timer-toggle"
          onClick={toggle}
          aria-label={running ? (t('board.focus.timerPause') as string) : (t('board.focus.timerPlay') as string)}
          style={{ color: 'var(--text-muted)' }}
        >
          {running ? <Pause size={12} aria-hidden="true" /> : <Play size={12} aria-hidden="true" />}
        </button>
        </Tooltip>
        {finished && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--status-success)' }}>
            <CheckCircle size={14} aria-hidden="true" />
            {t('board.focus.timerFinished')}
          </span>
        )}
      </div>
      {coarse ? (
        <BottomSheet open={sheetOpen} title={timerLabel} onClose={() => setSheetOpen(false)}>
          <TimerSheetBody
            display={display}
            almostDone={almostDone}
            mode={mode}
            running={running}
            finished={finished}
            showReset={showReset}
            durationSecs={durationSecs}
            onChangeMode={changeMode}
            onStep={stepDuration}
            onPlay={playInSheet}
            onReset={reset}
            onSetDuration={setDuration}
          />
        </BottomSheet>
      ) : sheetOpen ? (
        <div
          ref={panelRef}
          className="pcard"
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 'var(--z-overlay)',
            minWidth: 280,
            padding: 12,
          }}
        >
          <TimerSheetBody
            display={display}
            almostDone={almostDone}
            mode={mode}
            running={running}
            finished={finished}
            showReset={showReset}
            durationSecs={durationSecs}
            onChangeMode={changeMode}
            onStep={stepDuration}
            onPlay={toggle}
            onReset={reset}
            onSetDuration={setDuration}
          />
        </div>
      ) : null}
    </div>
  );
}
