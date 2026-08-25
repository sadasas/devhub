interface WelcomeHeroMicroProps {
  total: number;
  needsAttention: number;
  done: number;
  totalTasks: number;
}

export function WelcomeHeroMicro({ total, needsAttention, done, totalTasks }: WelcomeHeroMicroProps) {
  const pct = totalTasks > 0 ? Math.round((done / totalTasks) * 100) : 0;
  const hasTasks = totalTasks > 0;

  return (
    <div className="welcome-hero-micro" aria-label="Workspace summary">
      <div className="welcome-hero-left">
        <span className="welcome-hero-number" aria-label={`${total} projects`}>
          {String(total).padStart(2, '0')}
        </span>
        <div className="welcome-hero-labels">
          <span className="welcome-hero-label">PROJECTS</span>
          <span className="welcome-hero-sub">
            {needsAttention > 0 ? (
              <span className="welcome-hero-attention">{needsAttention} need attention</span>
            ) : (
              <span className="welcome-hero-ok">all clear</span>
            )}
            <span className="welcome-hero-dot" aria-hidden="true">
              ·
            </span>
            <span>{total === 0 ? 'create your first' : `${total} total`}</span>
          </span>
        </div>
      </div>

      <div className="welcome-hero-right" aria-hidden={!hasTasks}>
        {hasTasks ? (
          <>
            <div className="welcome-hero-track" role="img" aria-label={`${done} of ${totalTasks} tasks done`}>
              <div className="welcome-hero-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="welcome-hero-meta tabular">
              {done}/{totalTasks} done · {pct}%
            </span>
          </>
        ) : (
          <span className="welcome-hero-meta welcome-hero-meta-muted">no tasks yet</span>
        )}
      </div>
    </div>
  );
}
