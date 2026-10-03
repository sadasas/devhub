import { useCallback, useEffect, useRef, useState } from 'react';

export type AmbientTrackId = 'rain' | 'night-wind' | 'waves';

export const AMBIENT_TRACKS: readonly AmbientTrackId[] = ['rain', 'night-wind', 'waves'];

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

type Ctor = typeof AudioContext | undefined;

function audioCtor(): Ctor {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  return w.AudioContext ?? w.webkitAudioContext;
}

/** 2s looping noise buffer. Brown-ish (leaky integrator) for low rumble, white otherwise. */
function makeNoiseBuffer(ctx: AudioContext, brown: boolean): AudioBuffer {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  return buf;
}

interface Voice {
  ctx: AudioContext;
  teardown: () => void;
  setVolume: (v: number) => void;
}

/**
 * Build the per-track graph. All tracks: looping noise → filter(s) → master
 * gain → destination. Wind/waves add a slow LFO on a depth gain for gusts.
 */
function buildVoice(ctx: AudioContext, track: AmbientTrackId, volume: number): Voice {
  const master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);

  const src = ctx.createBufferSource();
  const nodes: AudioNode[] = [src];

  if (track === 'rain') {
    src.buffer = makeNoiseBuffer(ctx, false);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1400;
    const presence = ctx.createGain();
    presence.gain.value = 0.5;
    src.connect(hp);
    hp.connect(presence);
    presence.connect(master);
    nodes.push(hp, presence);
  } else if (track === 'night-wind') {
    src.buffer = makeNoiseBuffer(ctx, true);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const depth = ctx.createGain();
    depth.gain.value = 0.55;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.3;
    lfo.connect(lfoGain);
    lfoGain.connect(depth.gain);
    src.connect(lp);
    lp.connect(depth);
    depth.connect(master);
    lfo.start();
    nodes.push(lp, depth, lfo, lfoGain);
  } else {
    src.buffer = makeNoiseBuffer(ctx, true);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 620;
    const depth = ctx.createGain();
    depth.gain.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.14;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.38;
    lfo.connect(lfoGain);
    lfoGain.connect(depth.gain);
    src.connect(lp);
    lp.connect(depth);
    depth.connect(master);
    lfo.start();
    nodes.push(lp, depth, lfo, lfoGain);
  }

  src.loop = true;
  src.start();

  let closed = false;
  return {
    ctx,
    setVolume: (v: number) => {
      if (!closed) master.gain.value = v;
    },
    teardown: () => {
      if (closed) return;
      closed = true;
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
      for (const n of nodes) {
        try {
          n.disconnect();
        } catch {
          /* ignore */
        }
      }
      master.disconnect();
    },
  };
}

/**
 * Synthesized ambient audio (no files, no licensing): rain / night-wind /
 * waves from filtered looping noise. No-op when WebAudio is unavailable
 * (SSR, jsdom) — playback calls are safe and `playing` stays false.
 * Voice is torn down on unmount so no audio leaks past the panel.
 */
export function useAmbientAudio() {
  const [trackId, setTrackIdState] = useState<AmbientTrackId>('rain');
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState<number>(() =>
    typeof window === 'undefined' ? DEFAULT_VOLUME : readStoredVolume(),
  );
  const voiceRef = useRef<Voice | null>(null);
  const trackRef = useRef(trackId);
  trackRef.current = trackId;
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const stopInternal = useCallback(() => {
    voiceRef.current?.teardown();
    voiceRef.current = null;
  }, []);

  const play = useCallback((): boolean => {
    const AC = audioCtor();
    if (!AC) return false;
    try {
      stopInternal();
      const ctx = new AC();
      const start = () => {
        voiceRef.current = buildVoice(ctx, trackRef.current, volumeRef.current);
        setPlaying(true);
      };
      // Autoplay policy: resume inside the user gesture when suspended.
      if (ctx.state === 'suspended') {
        void ctx.resume().then(start, () => undefined);
      } else {
        start();
      }
      return true;
    } catch {
      return false;
    }
  }, [stopInternal]);

  const pause = useCallback(() => {
    stopInternal();
    setPlaying(false);
  }, [stopInternal]);

  /** Toggle playback. Returns the next `playing` state (false when unsupported). */
  const toggle = useCallback((): boolean => {
    if (voiceRef.current) {
      pause();
      return false;
    }
    const ok = play();
    if (!ok) setPlaying(false);
    return ok;
  }, [pause, play]);

  const setTrackId = useCallback(
    (next: AmbientTrackId) => {
      setTrackIdState(next);
      // Live-switch the graph when already playing.
      if (voiceRef.current) {
        const AC = audioCtor();
        if (!AC) return;
        try {
          stopInternal();
          const ctx = new AC();
          voiceRef.current = buildVoice(ctx, next, volumeRef.current);
          setPlaying(true);
        } catch {
          setPlaying(false);
        }
      }
    },
    [stopInternal],
  );

  const setVolume = useCallback((next: number) => {
    const v = Math.min(1, Math.max(0, next));
    setVolumeState(v);
    try {
      window.localStorage.setItem(VOLUME_KEY, String(v));
    } catch {
      /* private mode etc. */
    }
    voiceRef.current?.setVolume(v);
  }, []);

  // Never leak audio past unmount.
  useEffect(() => stopInternal, [stopInternal]);

  return { trackId, setTrackId, playing, play, pause, toggle, volume, setVolume };
}

/** Prop-bag type for components rendered under the lifted hook. */
export type AmbientAudio = ReturnType<typeof useAmbientAudio>;
