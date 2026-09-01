import { Logo } from './Logo';
import { Skeleton } from './Skeleton';

type SplashMode = 'brand' | 'shell';

interface SplashProps {
  mode?: SplashMode;
  label?: string;
}

const WORD = 'DevHub';

export function Splash({ mode = 'brand', label = 'Loading DevHub' }: SplashProps) {
  if (mode === 'shell') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={label}
        style={{ minHeight: '100dvh', display: 'grid', gridTemplateColumns: '180px 240px 1fr' }}
      >
        <span className="sr-only">{label}…</span>
        <div aria-hidden="true" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, borderRight: '1px solid var(--border-hairline)' }}>
          <Skeleton style={{ width: 36, height: 36, borderRadius: 8 }} />
          <Skeleton style={{ width: '80%', height: 12 }} />
          <Skeleton style={{ width: '100%', height: 28, borderRadius: 8 }} />
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0' }}>
              <Skeleton style={{ width: 14, height: 14, borderRadius: 4 }} />
              <Skeleton style={{ width: `${70 - i * 10}%`, height: 12 }} />
            </div>
          ))}
        </div>
        <div aria-hidden="true" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, borderRight: '1px solid var(--border-hairline)' }}>
          <Skeleton style={{ width: '70%', height: 14 }} />
          <Skeleton style={{ width: '100%', height: 36, borderRadius: 8 }} />
          <Skeleton style={{ width: '100%', height: 28, borderRadius: 8, marginTop: 8 }} />
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 6px' }}>
              <Skeleton style={{ width: 14, height: 14, borderRadius: 4 }} />
              <Skeleton style={{ width: `${60 + i * 5}%`, height: 12 }} />
            </div>
          ))}
        </div>
        <div aria-hidden="true" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Skeleton style={{ width: 180, height: 28 }} />
          <Skeleton style={{ width: '100%', height: 220, borderRadius: 12 }} />
          <Skeleton style={{ width: '100%', height: 220, borderRadius: 12 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="splash" role="status" aria-live="polite" aria-busy="true" aria-label={label}>
      <span className="sr-only">{label}…</span>
      <div className="splash-bg" aria-hidden="true" />
      <div className="splash-card" aria-hidden="true">
        <div className="splash-logo-wrap">
          <span className="splash-ring" />
          <span className="splash-logo">
            <Logo size={44} />
          </span>
        </div>
        <h1 className="splash-wordmark" aria-hidden="true">
          {WORD.split('').map((ch, i) => (
            <span key={i} className="splash-char" style={{ animationDelay: `${i * 40}ms` }}>
              {ch}
            </span>
          ))}
        </h1>
        <p className="splash-tagline">Project memory for teams + agents</p>
        <div className="splash-bar" aria-hidden="true">
          <span className="splash-bar-fill" />
        </div>
        <span className="splash-hint">Checking session…</span>
      </div>
    </div>
  );
}
