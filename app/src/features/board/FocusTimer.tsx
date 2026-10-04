import { useEffect, useRef, useState } from 'react';
import { Check, Pause, PencilSimple, Play, Timer } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button';
import { BottomSheet } from '../../components/BottomSheet';
import { Tooltip } from '../../components/Tooltip';
import { track } from '../../lib/analytics';
import { useViewportPanel } from './useViewportPanel';

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
  onPlay: () => void;
  onReset: () => void;
  onSetDuration: (totalSecs: number, source?: 'edit' | 'preset') => void;
}

const SESSION_PRESETS_MIN = [15, 25, 50, 90];

function TimerSheetBody({
  display,
  almostDone,
  mode,
  running,
  finished,
  showReset,
  durationSecs,
  onChangeMode,
  onPlay,
  onReset,
  onSetDuration,
}: TimerSheetBodyProps) {
  const { t } = useTranslation('tracker');
  const canEdit = mode === 'down' && !running && !finished;
  const showPresets = mode === 'down' && !running && !finished;
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
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums' as const,
    padding: '4px 6px',
  };

  return (
    <div>
      <div role="tablist" aria-label={t('board.focus.timerLabel') as string} style={{ display: 'flex', borderBottom: '1px solid var(--border-hairline)', marginBottom: 4 }}>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'down'}
          className="focus-mode-tab"
          onClick={() => onChangeMode('down')}
        >
          {t('board.focus.timerCountdown')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'up'}
          className="focus-mode-tab"
          onClick={() => onChangeMode('up')}
        >
          {t('board.focus.timerStopwatch')}
        </button>
      </div>
      {showPresets && (
        <div style={{ marginTop: 8 }}>
          <div
            role="group"
            aria-label={t('board.focus.timerSessionLength') as string}
            style={{ display: 'flex', gap: 8 }}
          >
            {SESSION_PRESETS_MIN.map((min) => {
              const active = durationSecs === min * 60;
              return (
                <Button
                  key={min}
                  variant={active ? 'primary' : 'secondary'}
                  size="sm"
                  style={
                    active
                      ? { flex: 1, background: 'var(--accent-focus)', borderColor: 'transparent', color: 'var(--text-on-accent)' }
                      : { flex: 1 }
                  }
                  aria-pressed={active}
                  onClick={() => onSetDuration(min * 60, 'preset')}
                >
                  {min}
                </Button>
              );
            })}
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', margin: '8px 0 0' }}>
            {t('board.focus.timerMinutesCaption')}
          </p>
        </div>
      )}
      {canEdit && editing ? (
        <div
          className="focus-timer-big"
          style={{
            fontWeight: 700,
            display: 'flex',
            marginTop: 12,
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
        <span className="focus-timer-editwrap" style={{ position: 'relative', display: 'block', marginTop: 12 }}>
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
            fontWeight: 700,
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
            color: almostDone ? 'var(--status-warn)' : 'var(--text-primary)',
            cursor: 'text',
          }}
        >
          {display}
        </button>
        <span
          aria-hidden="true"
          data-testid="timer-edit-badge"
          className="focus-timer-editbadge"
        >
          <PencilSimple size={13} aria-hidden="true" />
        </span>
        </span>
      ) : (
        <div
          aria-hidden="true"
          className="focus-timer-big"
          style={{
            fontWeight: 700,
            marginTop: 12,
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
            color: almostDone ? 'var(--status-warn)' : 'var(--text-primary)',
          }}
        >
          {display}
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <Button
          variant="primary"
          size="md"
          style={{ width: '100%', background: 'var(--accent-focus)', borderColor: 'transparent', color: 'var(--text-on-accent)' }}
          onClick={onPlay}
        >
          {running ? t('board.focus.timerPause') : t('board.focus.timerStartFocus')}
        </Button>
      </div>
      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onReset}
          disabled={!showReset}
          aria-label={t('board.focus.timerReset') as string}
          style={showReset ? undefined : { opacity: 0.45 }}
        >
          {t('board.focus.timerReset')}
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
  // Viewport-clamped popover (PresenceChip pattern) — never cut off at edges.
  const panelPos = useViewportPanel(displayButtonRef, 300);

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

  const setDuration = (totalSecs: number, source: 'edit' | 'preset' = 'edit') => {
    const next = Math.min(59940, Math.max(60, totalSecs));
    setDurationSecs(next);
    track('timer_duration_set', { seconds: next, source });
  };

  const startFresh = () => {
    track('timer_start', { mode, duration: durationSecs });
    setSecs(0);
    setFinished(false);
    setRunning(true);
  };

  // Panel CTA: restart sesi baru saat finished, selain itu toggle biasa.
  // Sheet (mobile) menutup saat mulai; panel desktop tetap terbuka.
  const sheetPlay = () => {
    if (finished) {
      startFresh();
      setSheetOpen(false);
      return;
    }
    const willStart = !running;
    toggle();
    if (willStart) setSheetOpen(false);
  };

  const desktopPlay = () => {
    if (finished) {
      startFresh();
      return;
    }
    toggle();
  };

  const showReset = secs > 0 || running || finished;

  return (
    <div className="focus-timer" style={{ position: 'relative' }}>
      <div
        role="group"
        aria-label={timerLabel}
        className="focus-pill-half"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 2,
          border: '1px solid var(--border-hairline)',
          borderRadius: 999,
          padding: '2px 2px 2px 4px',
          background: 'var(--bg-base)',
        }}
      >
        <button
          type="button"
          ref={displayButtonRef}
          className="btn btn-ghost btn-sm focus-timer-display"
          onClick={() => setSheetOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          aria-label={timerLabel}
          title={display}
          style={{
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            color: almostDone ? 'var(--status-warn)' : 'var(--text-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            border: 0,
            background: 'transparent',
          }}
        >
          <Timer size={14} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
          {display}
        </button>
        <Tooltip title={finished ? (t('board.focus.timerFinished') as string) : running ? (t('board.focus.timerPause') as string) : (t('board.focus.timerPlay') as string)}>
        <button
          type="button"
          className={`btn btn-ghost btn-sm btn-icon focus-timer-toggle${finished ? ' is-done' : ''}`}
          onClick={finished ? reset : toggle}
          aria-label={finished ? (t('board.focus.timerFinished') as string) : running ? (t('board.focus.timerPause') as string) : (t('board.focus.timerPlay') as string)}
          style={
            finished
              ? {
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'var(--status-success)',
                  color: 'var(--bg-base)',
                  border: 'none',
                }
              : {
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: running ? 'var(--text-primary)' : 'var(--bg-inset)',
                  color: running ? 'var(--bg-base)' : 'var(--text-muted)',
                  border: running ? 'none' : '1px solid var(--border-hairline)',
                }
          }
        >
          {finished ? (
            <Check size={12} weight="bold" aria-hidden="true" />
          ) : running ? (
            <Pause size={12} aria-hidden="true" />
          ) : (
            <Play size={12} aria-hidden="true" />
          )}
        </button>
        </Tooltip>
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
            onPlay={sheetPlay}
            onReset={reset}
            onSetDuration={setDuration}
          />
        </BottomSheet>
      ) : sheetOpen ? (
        <div
          ref={panelRef}
          className="pcard"
          style={{
            position: 'fixed',
            top: panelPos.top,
            left: panelPos.left,
            width: panelPos.width,
            zIndex: 'var(--z-overlay)',
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
            onPlay={desktopPlay}
            onReset={reset}
            onSetDuration={setDuration}
          />
        </div>
      ) : null}
    </div>
  );
}
