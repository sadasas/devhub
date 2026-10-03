import { Pause, Play } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/Button';
import { SearchableSelect } from '../../components/SearchableSelect';
import { track } from '../../lib/analytics';
import { AMBIENT_TRACKS, type AmbientAudio, type AmbientTrackId } from './useAmbientAudio';

const TRACK_LABEL_KEY: Record<AmbientTrackId, string> = {
  rain: 'musicRain',
  'night-wind': 'musicNightWind',
  waves: 'musicWaves',
};

/**
 * Ambient music section inside the timer panel (desktop + bottom sheet).
 * Synthesized WebAudio (no files): rain / night wind / waves. Playback is
 * user-gesture initiated, volume persists to localStorage.
 *
 * The audio state is lifted to the caller (FocusTimer topbar level) so music
 * keeps playing after the panel closes; stop via the panel, teardown happens
 * when leaving the focus page.
 */
export function FocusMusic({ music }: { music: AmbientAudio }) {
  const { t } = useTranslation('tracker');
  const { trackId, setTrackId, playing, toggle, volume, setVolume } = music;

  const onToggle = () => {
    const next = toggle();
    track(next ? 'music_start' : 'music_stop', { track: trackId });
  };

  return (
    <div>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
        {t('board.focus.musicLabel')}
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <SearchableSelect
            id="focus-music-track"
            label=""
            ariaLabel={t('board.focus.musicTrackLabel') as string}
            value={trackId}
            searchable={false}
            options={AMBIENT_TRACKS.map((id) => ({
              value: id,
              label: t(`board.focus.${TRACK_LABEL_KEY[id]}`, { defaultValue: id }) as string,
            }))}
            onChange={(v) => {
              if (v) setTrackId(v as AmbientTrackId);
            }}
            triggerEmptyLabel={t(`board.focus.${TRACK_LABEL_KEY[trackId]}`, { defaultValue: trackId }) as string}
          />
        </span>
        <Button
          variant="primary"
          size="sm"
          className="btn-icon"
          onClick={onToggle}
          aria-label={(playing ? t('board.focus.timerPause') : t('board.focus.timerPlay')) as string}
        >
          {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
        </Button>
      </div>
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
    </div>
  );
}
