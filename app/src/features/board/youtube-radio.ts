/**
 * Minimal lazy wrapper around the YouTube IFrame Player API.
 *
 * Loaded only when the radio is first used — zero cost otherwise. Playback
 * always goes through the official embed (visible player, user-gesture
 * initiated, ads untouched): the browser streams directly from Google, our
 * backend never sees media bytes.
 */

export type RadioPlayerState = 'playing' | 'paused' | 'ended' | 'cued' | 'buffering' | 'unstarted';

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  loadVideoById(videoId: string): void;
  setVolume(volume: number): void;
  destroy(): void;
}

interface YTPlayerEvents {
  onReady?: (e: { target: YTPlayer }) => void;
  onStateChange?: (e: { data: number; target: YTPlayer }) => void;
  onError?: (e: { data: number }) => void;
}

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: { playerVars?: Record<string, unknown>; events?: YTPlayerEvents },
  ) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

/** Resolve the IFrame API, injecting the script tag once. Never hangs. */
export function loadYouTubeIframeAPI(): Promise<YTNamespace> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    let settled = false;
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try {
        prev?.();
      } catch {
        /* ignore host callback errors */
      }
      if (!settled && window.YT?.Player) {
        settled = true;
        resolve(window.YT);
      }
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    tag.onerror = () => {
      if (!settled) {
        settled = true;
        apiPromise = null;
        reject(new Error('YT API script failed to load'));
      }
    };
    document.head.appendChild(tag);
    setTimeout(() => {
      if (!settled && !window.YT?.Player) {
        settled = true;
        apiPromise = null;
        reject(new Error('YT API load timed out'));
      }
    }, 15000);
  });
  return apiPromise;
}

const STATE_MAP: Record<number, RadioPlayerState> = {
  [-1]: 'unstarted',
  0: 'ended',
  1: 'playing',
  2: 'paused',
  3: 'buffering',
  5: 'cued',
};

export interface RadioPlayerHandle {
  playTrack(videoId: string): void;
  play(): void;
  pause(): void;
  /** Volume 0..1. */
  setVolume(v: number): void;
  destroy(): void;
  onState(cb: (s: RadioPlayerState) => void): void;
  onError(cb: (code: number) => void): void;
}

/** Create the visible player inside `el`. Resolves once the player is ready. */
export async function createRadioPlayer(
  el: HTMLElement,
  opts: { volume: number },
): Promise<RadioPlayerHandle> {
  const YT = await loadYouTubeIframeAPI();
  let player: YTPlayer | null = null;
  let destroyed = false;
  const stateCbs = new Set<(s: RadioPlayerState) => void>();
  const errorCbs = new Set<(code: number) => void>();

  await new Promise<void>((resolve, reject) => {
    try {
      player = new YT.Player(el, {
        playerVars: { rel: 0, playsinline: 1 },
        events: {
          onReady: () => {
            if (destroyed) return;
            try {
              player?.setVolume(Math.round(opts.volume * 100));
            } catch {
              /* ignore */
            }
            resolve();
          },
          onStateChange: (e) => {
            const s = STATE_MAP[e.data] ?? 'unstarted';
            for (const cb of stateCbs) {
              try {
                cb(s);
              } catch {
                /* isolate host callbacks */
              }
            }
          },
          onError: (e) => {
            for (const cb of errorCbs) {
              try {
                cb(e.data);
              } catch {
                /* isolate host callbacks */
              }
            }
          },
        },
      });
    } catch (e) {
      reject(e);
    }
  });

  const handle: RadioPlayerHandle = {
    playTrack: (videoId: string) => {
      if (!destroyed) player?.loadVideoById(videoId);
    },
    play: () => {
      if (!destroyed) player?.playVideo();
    },
    pause: () => {
      if (!destroyed) player?.pauseVideo();
    },
    setVolume: (v: number) => {
      if (!destroyed) player?.setVolume(Math.round(Math.min(1, Math.max(0, v)) * 100));
    },
    destroy: () => {
      destroyed = true;
      stateCbs.clear();
      errorCbs.clear();
      try {
        player?.destroy();
      } catch {
        /* ignore */
      }
      player = null;
    },
    onState: (cb) => {
      stateCbs.add(cb);
    },
    onError: (cb) => {
      errorCbs.add(cb);
    },
  };
  return handle;
}
