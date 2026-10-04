import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import type { YoutubeVideo } from '../../lib/types';
import { createRadioPlayer, type RadioPlayerHandle } from './youtube-radio';

const VOLUME_KEY = 'devhub.focus.musicVolume';
const DEFAULT_VOLUME = 0.7;

function readStoredVolume(): number {
  try {
    const raw = window.localStorage.getItem(VOLUME_KEY);
    if (raw == null) return DEFAULT_VOLUME;
    const v = Number(raw);
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

export type RadioErrorKind = 'quota' | 'not-configured' | 'upstream' | 'player' | 'network';

function errorKindOf(err: unknown): RadioErrorKind {
  const code = (err as { code?: unknown })?.code;
  if (code === 'YOUTUBE_QUOTA_EXHAUSTED') return 'quota';
  if (code === 'YOUTUBE_NOT_CONFIGURED') return 'not-configured';
  return 'upstream';
}

/**
 * Song radio over official YouTube embeds: search (via our backend proxy),
 * an explicit user-managed queue with auto-advance, and an audio-only player.
 * Search metadata flows through the backend; media streams directly
 * browser↔Google.
 *
 * Volume shares the `devhub.focus.musicVolume` key. The player is destroyed
 * on unmount so no audio leaks past the panel.
 */
export function useRadioAudio() {
  const [results, setResults] = useState<YoutubeVideo[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [queue, setQueue] = useState<YoutubeVideo[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState<number>(() =>
    typeof window === 'undefined' ? DEFAULT_VOLUME : readStoredVolume(),
  );
  const [error, setError] = useState<RadioErrorKind | null>(null);

  const playerRef = useRef<RadioPlayerHandle | null>(null);
  const creatingRef = useRef<Promise<RadioPlayerHandle> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const queueRef = useRef<YoutubeVideo[]>([]);
  queueRef.current = queue;
  const indexRef = useRef(0);
  indexRef.current = index;
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const lastVideoRef = useRef<string | null>(null);
  // Generation counter: bumped on every release/unmount so late async
  // continuations (player ready arriving after close) stay silent instead of
  // calling a detached player ("not attached to the DOM").
  const epochRef = useRef(0);

  const destroyPlayer = useCallback(() => {
    epochRef.current += 1;
    creatingRef.current = null;
    try {
      playerRef.current?.destroy();
    } catch {
      /* ignore */
    }
    playerRef.current = null;
    lastVideoRef.current = null;
  }, []);

  /** Create the player if needed (safe to call on panel open). */
  const ensureReady = useCallback(async (): Promise<boolean> => {
    const epoch = epochRef.current;
    if (playerRef.current) return true;
    let handle: RadioPlayerHandle | null = null;
    try {
      if (creatingRef.current) {
        handle = await creatingRef.current;
      } else {
        const el = containerRef.current;
        if (!el) return false;
        // Audio-only (owner-accepted risk, see youtube-radio.ts): the player is
        // 2px and visually collapsed; the UI shows artwork + own controls.
        const creating = createRadioPlayer(el, { volume: volumeRef.current, hidden: true });
        creatingRef.current = creating;
        try {
          handle = await creating;
        } finally {
          if (creatingRef.current === creating) creatingRef.current = null;
        }
      }
    } catch {
      return false;
    }
    // Stale (released/closed while creating) or detached: tear down, stay silent.
    if (!handle || epoch !== epochRef.current) {
      try {
        handle?.destroy();
      } catch {
        /* ignore */
      }
      return false;
    }
    const el = containerRef.current;
    if (!el || (typeof document !== 'undefined' && !document.contains(el))) {
      try {
        handle.destroy();
      } catch {
        /* ignore */
      }
      return false;
    }
    handle.onState((s) => {
      if (s === 'playing') setPlaying(true);
      else if (s === 'paused') setPlaying(false);
      else if (s === 'ended') {
        const next = indexRef.current + 1;
        if (next < queueRef.current.length) {
          const track = queueRef.current[next];
          if (track) {
            indexRef.current = next;
            setIndex(next);
            lastVideoRef.current = track.videoId;
            try {
              handle.playTrack(track.videoId);
            } catch {
              /* ignore */
            }
            setPlaying(true);
          }
        } else {
          setPlaying(false);
        }
      }
    });
    handle.onError(() => {
      setError('player');
      setPlaying(false);
    });
    playerRef.current = handle;
    return true;
  }, []);

  const playAt = useCallback(
    async (i: number): Promise<YoutubeVideo | null> => {
      const epoch = epochRef.current;
      const track = queueRef.current[i] ?? null;
      if (!track) return null;
      setError(null);
      const ok = await ensureReady();
      if (!ok || epoch !== epochRef.current || !playerRef.current) {
        // Released while loading → silent (panel closed); real failure → error.
        if (epoch === epochRef.current) setError('player');
        return null;
      }
      indexRef.current = i;
      setIndex(i);
      lastVideoRef.current = track.videoId;
      try {
        playerRef.current.playTrack(track.videoId);
      } catch {
        setError('player');
        return null;
      }
      setPlaying(true);
      return track;
    },
    [ensureReady],
  );

  const pause = useCallback(() => {
    try {
      playerRef.current?.pause();
    } catch {
      /* ignore */
    }
    setPlaying(false);
  }, []);

  const toggle = useCallback(async (): Promise<{ playing: boolean; track: YoutubeVideo | null }> => {
    const current = queueRef.current[indexRef.current] ?? null;
    if (playing && playerRef.current && lastVideoRef.current === current?.videoId) {
      pause();
      return { playing: false, track: current };
    }
    if (playerRef.current && lastVideoRef.current === current?.videoId && current) {
      try {
        playerRef.current.play();
        setPlaying(true);
        return { playing: true, track: current };
      } catch {
        /* fall through to reload */
      }
    }
    if (current) {
      const track = await playAt(indexRef.current);
      return { playing: track != null, track };
    }
    if (queueRef.current.length > 0) {
      const track = await playAt(0);
      return { playing: track != null, track };
    }
    return { playing: false, track: null };
  }, [playing, pause, playAt]);

  const next = useCallback(async (): Promise<YoutubeVideo | null> => {
    if (indexRef.current + 1 >= queueRef.current.length) return null;
    return playAt(indexRef.current + 1);
  }, [playAt]);

  const prev = useCallback(async (): Promise<YoutubeVideo | null> => {
    if (indexRef.current <= 0) return null;
    return playAt(indexRef.current - 1);
  }, [playAt]);

  /**
   * Append a video to the queue (no duplicates). Returns its queue position.
   * Search results never touch the queue by themselves.
   */
  const enqueue = useCallback((video: YoutubeVideo): number => {
    const existing = queueRef.current.findIndex((v) => v.videoId === video.videoId);
    if (existing >= 0) return existing;
    const nextQueue = [...queueRef.current, video];
    queueRef.current = nextQueue;
    setQueue(nextQueue);
    return nextQueue.length - 1;
  }, []);

  /**
   * Remove a queue entry. Removing the currently-playing track stops
   * playback (predictable over auto-jumping to a neighbour).
   */
  const removeAt = useCallback(
    (i: number): YoutubeVideo | null => {
      const q = queueRef.current;
      const removed = q[i] ?? null;
      if (!removed) return null;
      const wasCurrent = i === indexRef.current;
      const wasPlaying = wasCurrent && playerRef.current != null;
      const nextQueue = q.filter((_, j) => j !== i);
      let idx = indexRef.current;
      if (i < idx) idx -= 1;
      if (idx >= nextQueue.length) idx = Math.max(0, nextQueue.length - 1);
      indexRef.current = idx;
      setIndex(idx);
      queueRef.current = nextQueue;
      setQueue(nextQueue);
      if (wasCurrent) {
        lastVideoRef.current = null;
        if (wasPlaying) pause();
      }
      return removed;
    },
    [pause],
  );

  /**
   * Reorder the queue (drag or up/down buttons). The playing position tracks
   * the moved entry so audio never jumps.
   */
  const move = useCallback((from: number, to: number): boolean => {
    const q = queueRef.current;
    if (from === to || from < 0 || to < 0 || from >= q.length || to >= q.length) return false;
    const nextQueue = [...q];
    const [item] = nextQueue.splice(from, 1);
    if (!item) return false;
    nextQueue.splice(to, 0, item);
    let idx = indexRef.current;
    if (from === idx) idx = to;
    else if (from < idx && idx <= to) idx -= 1;
    else if (to <= idx && idx < from) idx += 1;
    indexRef.current = idx;
    setIndex(idx);
    queueRef.current = nextQueue;
    setQueue(nextQueue);
    return true;
  }, []);

  const search = useCallback(async (q: string): Promise<YoutubeVideo[]> => {
    const query = q.trim();
    if (!query) return [];
    setSearching(true);
    setError(null);
    try {
      const res = await api.youtubeSearch(query);
      setResults(res.results);
      setSearched(true);
      return res.results;
    } catch (err) {
      const status = (err as { status?: unknown })?.status;
      if (status === 401) throw err;
      setError(errorKindOf(err));
      return [];
    } finally {
      setSearching(false);
    }
  }, []);

  const setVolume = useCallback((next: number) => {
    const v = Math.min(1, Math.max(0, next));
    setVolumeState(v);
    try {
      window.localStorage.setItem(VOLUME_KEY, String(v));
    } catch {
      /* private mode etc. */
    }
    try {
      playerRef.current?.setVolume(v);
    } catch {
      /* ignore */
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  /** Pause + tear down the player (panel closed). Idempotent. */
  const release = useCallback(() => {
    pause();
    destroyPlayer();
  }, [pause, destroyPlayer]);

  // Never leak audio past unmount.
  useEffect(() => destroyPlayer, [destroyPlayer]);

  return {
    results,
    searching,
    searched,
    queue,
    index,
    current: queue[index] ?? null,
    playing,
    volume,
    setVolume,
    error,
    clearError,
    containerRef,
    ensureReady,
    search,
    playAt,
    toggle,
    pause,
    next,
    prev,
    enqueue,
    removeAt,
    move,
    release,
  };
}
