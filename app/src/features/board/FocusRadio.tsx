import { useEffect, useRef, useState } from 'react';
import {
  ArrowSquareOut,
  MagnifyingGlass,
  MusicNote,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button';
import { BottomSheet } from '../../components/BottomSheet';
import { track } from '../../lib/analytics';
import { useRadioAudio, type RadioErrorKind } from './useRadioAudio';

function errorMessageKey(kind: RadioErrorKind): string {
  switch (kind) {
    case 'quota':
      return 'board.focus.radioQuotaExhausted';
    case 'not-configured':
      return 'board.focus.radioNotConfigured';
    default:
      return 'board.focus.radioError';
  }
}

const youtubeMusicUrl = (videoId: string) => `https://music.youtube.com/watch?v=${videoId}`;

/**
 * Song radio pill + panel (YouTube embeds): search becomes the queue,
 * auto-advances, visible player. Sits next to the timer pill in the focus
 * topbar. Search metadata flows through our backend proxy; media streams
 * directly browser↔Google.
 */
export function FocusRadio() {
  const { t } = useTranslation('tracker');
  const [panelOpen, setPanelOpen] = useState(false);
  const [coarse, setCoarse] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches,
  );
  const [draft, setDraft] = useState('');
  const displayButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const radioLabel = t('board.focus.radioLabel') as string;

  const {
    results,
    searching,
    searched,
    queue,
    index,
    current,
    playing,
    volume,
    setVolume,
    error,
    containerRef,
    ensureReady,
    search,
    playAt,
    toggle,
    next,
    prev,
    release,
  } = useRadioAudio();

  useEffect(() => {
    const mq = window.matchMedia('(hover: none)');
    const onChange = (e: MediaQueryListEvent) => setCoarse(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Pre-create the player when the panel opens (inside a user gesture chain
  // would be ideal, but creation itself needs no gesture — only play does).
  useEffect(() => {
    if (panelOpen) void ensureReady();
    else release();
  }, [panelOpen, ensureReady, release]);

  // Desktop inline panel dismiss: Escape closes + refocuses the pill button.
  useEffect(() => {
    if (!panelOpen || coarse) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPanelOpen(false);
        displayButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [panelOpen, coarse]);

  // Desktop inline panel dismiss: outside mousedown closes.
  useEffect(() => {
    if (!panelOpen || coarse) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (panelRef.current?.contains(target)) return;
      if (displayButtonRef.current?.contains(target)) return;
      setPanelOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [panelOpen, coarse]);

  const submitSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = draft.trim();
    if (!q || searching) return;
    track('radio_search');
    try {
      await search(q);
    } catch {
      // 401 and friends are owned by the global API handler — never an
      // unhandled rejection from here.
    }
  };

  const onToggle = async () => {
    const r = await toggle();
    if (r.track) track(r.playing ? 'radio_play' : 'radio_stop', { videoId: r.track.videoId });
    else if (r.playing) track('radio_play');
    else track('radio_stop');
  };

  const onPlayAt = async (i: number) => {
    const tr = await playAt(i);
    if (tr) track('radio_play', { videoId: tr.videoId });
  };

  const onNext = async () => {
    const tr = await next();
    if (tr) track('radio_next', { videoId: tr.videoId });
  };

  const onPrev = async () => {
    const tr = await prev();
    if (tr) track('radio_prev', { videoId: tr.videoId });
  };

  const panelBody = (
    <div>
      <form onSubmit={submitSearch} role="search">
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            value={draft}
            maxLength={100}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('board.focus.radioSearchPlaceholder') as string}
            aria-label={t('board.focus.radioSearchLabel') as string}
            style={{ flex: 1, minWidth: 0 }}
          />
          <Button variant="secondary" size="sm" type="submit" disabled={!draft.trim() || searching} aria-label={t('board.focus.radioSearchButton') as string}>
            <MagnifyingGlass size={14} aria-hidden="true" />
          </Button>
        </div>
      </form>
      {!searched && !searching && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0' }}>
          {t('board.focus.radioSearchHint')}
        </p>
      )}
      {searching && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 0' }} role="status">
          …
        </p>
      )}
      {searched && !searching && results.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 0' }}>
          {t('board.focus.radioNoResults')}
        </p>
      )}
      {results.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {results.map((r, i) => (
            <li key={r.videoId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {r.thumbnailUrl ? (
                <img
                  src={r.thumbnailUrl}
                  alt=""
                  width={48}
                  height={36}
                  loading="lazy"
                  style={{ borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                />
              ) : null}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 13,
                    color: i === index && queue.length > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: i === index && queue.length > 0 ? 600 : 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={r.title}
                >
                  {r.title}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.channelTitle}
                </span>
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon"
                onClick={() => void onPlayAt(i)}
                aria-label={t('board.focus.radioPlayTitle', { title: r.title, defaultValue: r.title }) as string}
              >
                <Play size={12} aria-hidden="true" />
              </button>
              <a
                href={youtubeMusicUrl(r.videoId)}
                target="_blank"
                rel="noreferrer"
                aria-label={t('board.focus.radioOpenInYouTube', { title: r.title }) as string}
                title={t('board.focus.radioOpenInYouTube', { title: r.title }) as string}
                style={{ display: 'inline-flex', color: 'var(--text-muted)' }}
              >
                <ArrowSquareOut size={14} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      )}
      <hr className="sheet-divider" aria-hidden="true" />
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
        {t('board.focus.radioNowPlaying')}
      </p>
      <div
        ref={containerRef}
        style={{
          minHeight: 180,
          borderRadius: 8,
          overflow: 'hidden',
          background: 'var(--bg-inset)',
        }}
      />
      {current ? (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={current.title}>
            {current.title}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 8px' }}>{current.channelTitle}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon"
              onClick={() => void onPrev()}
              disabled={index <= 0}
              aria-label={t('board.focus.radioPrev') as string}
            >
              <SkipBack size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon"
              onClick={() => void onToggle()}
              aria-label={(playing ? t('board.focus.timerPause') : t('board.focus.timerPlay')) as string}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--text-primary)',
                color: 'var(--bg-base)',
                border: 'none',
              }}
            >
              {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon"
              onClick={() => void onNext()}
              disabled={index + 1 >= queue.length}
              aria-label={t('board.focus.radioNext') as string}
            >
              <SkipForward size={14} aria-hidden="true" />
            </button>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {t('board.focus.radioQueueCount', { count: Math.max(0, queue.length - index - 1) })}
            </span>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 0' }}>
          {t('board.focus.radioPickHint')}
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(e) => setVolume(Number(e.target.value) / 100)}
          aria-label={t('board.focus.musicVolumeLabel') as string}
          style={{ flex: 1, minWidth: 0, accentColor: 'var(--text-primary)' }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(volume * 100)}%
        </span>
      </div>
      {error && (
        <div role="alert" style={{ marginTop: 8, fontSize: 12, color: 'var(--status-danger)' }}>
          <p style={{ margin: '0 0 4px' }}>{t(errorMessageKey(error))}</p>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>{t('board.focus.radioTrySynth')}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="focus-radio" style={{ position: 'relative' }}>
      <div
        role="group"
        aria-label={radioLabel}
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
          className="btn btn-ghost btn-sm focus-radio-display"
          onClick={() => setPanelOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={panelOpen}
          aria-label={radioLabel}
          title={current?.title ?? radioLabel}
          style={{
            fontWeight: 600,
            fontSize: 13,
            color: 'var(--text-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            border: 0,
            background: 'transparent',
            maxWidth: 160,
          }}
        >
          <MusicNote size={14} aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {current?.title ?? radioLabel}
          </span>
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon focus-radio-toggle"
          onClick={() => void onToggle()}
          aria-label={(playing ? t('board.focus.timerPause') : t('board.focus.timerPlay')) as string}
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: playing ? 'var(--text-primary)' : 'var(--bg-inset)',
            color: playing ? 'var(--bg-base)' : 'var(--text-muted)',
            border: playing ? 'none' : '1px solid var(--border-hairline)',
            flexShrink: 0,
          }}
        >
          {playing ? <Pause size={12} aria-hidden="true" /> : <Play size={12} aria-hidden="true" />}
        </button>
      </div>
      {coarse ? (
        <BottomSheet open={panelOpen} title={radioLabel} onClose={() => setPanelOpen(false)}>
          {panelBody}
        </BottomSheet>
      ) : panelOpen ? (
        <div
          ref={panelRef}
          className="pcard"
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 'var(--z-overlay)',
            minWidth: 320,
            maxWidth: 360,
            padding: 12,
          }}
        >
          {panelBody}
        </div>
      ) : null}
    </div>
  );
}
