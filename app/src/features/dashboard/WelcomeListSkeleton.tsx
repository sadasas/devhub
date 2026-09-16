import { Skeleton } from '../../components/Skeleton';
import { SKELETON_SIZES } from '../../lib/skeleton-presets';

/**
 * Loading placeholder that mirrors WelcomeProjectRow 1:1 — same wrappers
 * (.welcome-list > .welcome-row-wrap > .welcome-row) and same inner
 * geometry (8px dot, fluid title, team pill, 56x4 progress track, meta
 * gap, 7x3px spark, chevron spacer). No inline gap/padding overrides so
 * the skeleton occupies exactly the space of the real rows (no layout shift).
 */
export function WelcomeListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="welcome-list" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="welcome-row-wrap">
          <div className="welcome-row">
            <span className="welcome-row-main">
              <span className="welcome-row-dot" style={{ background: 'var(--text-muted)', opacity: 0.35 }} />
              <Skeleton style={{ flex: '1 1 auto', maxWidth: 220, minWidth: 80, height: 13 }} />
              <Skeleton style={{ width: 84, height: 18, borderRadius: 'var(--radius-pill)', flexShrink: 0 }} />
            </span>
            <span className="welcome-row-meta">
              <span className="welcome-row-progress">
                <Skeleton style={{ width: 56, height: 4, borderRadius: 'var(--radius-sm)', flexShrink: 0 }} />
                <Skeleton style={{ width: 30, height: 11, flexShrink: 0 }} />
              </span>
              <Skeleton style={{ width: 24, height: 16, borderRadius: 'var(--radius-pill)', flexShrink: 0, opacity: 0.7 }} />
              <Skeleton style={{ width: 56, height: 11, flexShrink: 0, opacity: 0.7 }} />
              <span className="welcome-spark">
                {Array.from({ length: 7 }).map((_, j) => (
                  <Skeleton key={j} style={{ width: 3, height: 6 + (j % 3) * 2, borderRadius: 'var(--radius-xs)' }} />
                ))}
              </span>
              <span className="welcome-row-chevron" style={{ width: 12, opacity: 0 }} />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export const WELCOME_SKELETON_ROWS = SKELETON_SIZES.welcomeRow.count;
