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
 * queue with auto-advance, and a visible IFrame player. Search metadata flows
 * through the backend; media streams directly browser↔Google.
 *
 * Volume shares the `devhub.focus.musicVolume` key with the synth ambience.
 * The player is destroyed on unmount so no audio leaks past the panel.
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

  const destroyPlayer = useCallback(() => {
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
    if (playerRef.current) return true;
    if (creatingRef.current) {
      try {
        playerRef.current = await creatingRef.current;
        return true;
      } catch {
        return false;
      }
    }
    const el = containerRef.current;
    if (!el) return false;
    const creating = createRadioPlayer(el, { volume: volumeRef.current });
    creatingRef.current = creating;
    try {
      const handle = await creating;
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
    } catch {
      return false;
    } finally {
      creatingRef.current = null;
    }
  }, []);

  const playAt = useCallback(
    async (i: number): Promise<YoutubeVideo | null> => {
      const track = queueRef.current[i] ?? null;
      if (!track) return null;
      setError(null);
      const ok = await ensureReady();
      if (!ok || !playerRef.current) {
        setError('player');
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

  const search = useCallback(async (q: string): Promise<YoutubeVideo[]> => {
    const query = q.trim();
    if (!query) return [];
    setSearching(true);
    setError(null);
    try {
      const res = await api.youtubeSearch(query);
      setResults(res.results);
      setSearched(true);
      // Search results become the queue (auto-advance through them).
      setQueue(res.results);
      indexRef.current = 0;
      setIndex(0);
      lastVideoRef.current = null;
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
    release,
  };
}
