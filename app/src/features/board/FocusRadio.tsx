import { useEffect, useRef, useState } from 'react';
import {
  DotsSixVertical,
  MagnifyingGlass,
  MusicNote,
  Pause,
  Play,
  Plus,
  SkipBack,
  SkipForward,
  X,
} from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button';
import { BottomSheet } from '../../components/BottomSheet';
import { Tooltip } from '../../components/Tooltip';
import { InlineError } from '../../components/InlineError';
import { track } from '../../lib/analytics';
import { useViewportPanel } from './useViewportPanel';
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
  // Viewport-clamped popover (PresenceChip pattern) — never cut off at edges.
  const panelPos = useViewportPanel(displayButtonRef, 340);

  const {
    results,
    searching,
    searched,
    queue,
    index,
    current,
    playing,
    error,
    notice,
    containerRef,
    ensureReady,
    search,
    clearSearch,
    playAt,
    toggle,
    next,
    prev,
    enqueue,
    removeAt,
    move,
    release,
  } = useRadioAudio();
  const dragFromRef = useRef<number | null>(null);

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

  /** Play a search result: enqueue first (dedup), then play its position. */
  const onPlayResult = async (i: number) => {
    const video = results[i];
    if (!video) return;
    const qi = enqueue(video);
    // Done browsing → dismiss results back to the queue view.
    clearSearch();
    setDraft('');
    const tr = await playAt(qi);
    if (tr) track('radio_play', { videoId: tr.videoId });
  };

  const onEnqueue = (i: number) => {
    const video = results[i];
    if (!video) return;
    enqueue(video);
    track('radio_queue_add', { videoId: video.videoId });
    // Done browsing → dismiss results back to the queue view.
    clearSearch();
    setDraft('');
  };

  const onClear = () => {
    setDraft('');
    clearSearch();
  };

  const onRemove = (i: number) => {
    const removed = removeAt(i);
    if (removed) track('radio_queue_remove', { videoId: removed.videoId });
  };

  const onMove = (from: number, to: number) => {
    const video = queue[from];
    if (move(from, to) && video) track('radio_queue_move', { videoId: video.videoId, to });
  };

  const onNext = async () => {
    const tr = await next();
    if (tr) track('radio_next', { videoId: tr.videoId });
  };

  const onPrev = async () => {
    const tr = await prev();
    if (tr) track('radio_prev', { videoId: tr.videoId });
  };

  // Mutually exclusive views: results XOR queue. Searching (or showing
  // results) hides the queue + now playing; clearing returns to them.
  const showResults = searching || searched;

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
          {(draft.trim() !== '' || searched) && (
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon"
              onClick={onClear}
              aria-label={t('board.focus.radioClearSearch') as string}
              title={t('board.focus.radioClearSearch') as string}
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </form>
      {!searched && !searching && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0' }}>
          {t('board.focus.radioSearchHint')}
        </p>
      )}
      {showResults && (
      <>
      {searching && (
        <div role="status" aria-label={t('board.focus.radioSearching') as string} style={{ margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2].map((k) => (
            <div key={k} aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 48, height: 36, borderRadius: 6, background: 'var(--bg-inset)', flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', height: 12, borderRadius: 4, background: 'var(--bg-inset)', width: '70%' }} />
                <span style={{ display: 'block', height: 10, borderRadius: 4, background: 'var(--bg-inset)', width: '40%', marginTop: 6 }} />
              </span>
            </div>
          ))}
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('board.focus.radioSearching')}</span>
        </div>
      )}
      {searched && !searching && results.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 0' }}>
          {t('board.focus.radioNoResults')}
        </p>
      )}
      {results.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 216, overflowY: 'auto' }}>
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
                    color: current?.videoId === r.videoId ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: current?.videoId === r.videoId ? 600 : 400,
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
              <Tooltip title={t('board.focus.radioQueueAdd', { title: r.title, defaultValue: r.title }) as string}>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon"
                onClick={() => onEnqueue(i)}
                aria-label={t('board.focus.radioQueueAdd', { title: r.title, defaultValue: r.title }) as string}
              >
                <Plus size={12} aria-hidden="true" />
              </button>
              </Tooltip>
              <Tooltip title={t('board.focus.radioPlayTitle', { title: r.title, defaultValue: r.title }) as string}>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon"
                onClick={() => void onPlayResult(i)}
                aria-label={t('board.focus.radioPlayTitle', { title: r.title, defaultValue: r.title }) as string}
              >
                <Play size={12} aria-hidden="true" />
              </button>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
      </>)}
      {!showResults && (
      <>
      <hr className="sheet-divider" aria-hidden="true" />
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
        {t('board.focus.radioQueueTitle')}
      </p>
      {queue.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px' }}>
          {t('board.focus.radioQueueEmpty')}
        </p>
      ) : (
        <ul aria-label={t('board.focus.radioQueueTitle') as string} style={{ listStyle: 'none', margin: '0 0 8px', padding: 0, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 224, overflowY: 'auto' }}>
          {queue.map((v, i) => (
            <li
              key={v.videoId}
              data-queue-index={i}
              draggable
              onDragStart={(e) => {
                dragFromRef.current = i;
                if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                const from = dragFromRef.current;
                dragFromRef.current = null;
                if (from != null) onMove(from, i);
              }}
              onDragEnd={() => {
                dragFromRef.current = null;
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span aria-hidden="true" style={{ display: 'inline-flex', color: 'var(--text-muted)', cursor: 'grab', flexShrink: 0 }}>
                <DotsSixVertical size={14} />
              </span>
              {v.thumbnailUrl ? (
                <img
                  src={v.thumbnailUrl}
                  alt=""
                  width={36}
                  height={28}
                  loading="lazy"
                  style={{ borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
                />
              ) : null}
              <button
                type="button"
                onClick={() => void onPlayAt(i)}
                aria-label={t('board.focus.radioPlayTitle', { title: v.title, defaultValue: v.title }) as string}
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                  font: 'inherit',
                  color: i === index ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: i === index ? 600 : 400,
                  fontSize: 13,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={v.title}
              >
                {v.title}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon"
                onClick={() => onRemove(i)}
                aria-label={t('board.focus.radioRemove', { title: v.title, defaultValue: v.title }) as string}
              >
                <X size={12} aria-hidden="true" />
              </button>
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
        aria-hidden="true"
        style={{ height: 0, overflow: 'hidden' }}
      />
      {current ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {current.thumbnailUrl ? (
              <img
                src={current.thumbnailUrl}
                alt={current.title}
                width={56}
                height={56}
                loading="lazy"
                style={{ borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
              />
            ) : null}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={current.title}>
                {current.title}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>{current.channelTitle}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
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
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 0' }}>
          {t('board.focus.radioPickHint')}
        </p>
      )}
      {error && (
        <div style={{ marginTop: 8 }}>
          <InlineError>{t(errorMessageKey(error))}</InlineError>
        </div>
      )}
      {notice === 'adblock' && (
        <div style={{ marginTop: 8 }}>
          <InlineError>{t('board.focus.radioAdblock')}</InlineError>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
            {t('board.focus.radioAdblockHint')}
          </p>
        </div>
      )}
      </>)}
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
            position: 'fixed',
            top: panelPos.top,
            left: panelPos.left,
            width: panelPos.width,
            maxHeight: 'min(680px, calc(100vh - 140px))',
            overflowY: 'auto',
            zIndex: 'var(--z-overlay)',
            padding: 12,
          }}
        >
          {panelBody}
        </div>
      ) : null}
    </div>
  );
}
