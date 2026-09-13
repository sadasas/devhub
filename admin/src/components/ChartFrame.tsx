import type { ReactNode } from 'react';
import { Skeleton } from './Skeleton';

interface ChartFrameProps {
  title: string;
  legend?: ReactNode;
  children: ReactNode;
  /** Chart null → skeleton, bukan hilang diam (Fase 1). */
  loading?: boolean;
  actions?: ReactNode;
}

/** ChartFrame (Fase 1): title + legend + sr-table wrapper untuk BarChart/Donut/VerticalBarChart. */
export function ChartFrame({ title, legend, children, loading = false, actions }: ChartFrameProps) {
  return (
    <section className="chart-frame" aria-label={title}>
      <div className="chart-frame-head">
        <h3 className="admin-chart-title" style={{ margin: 0 }}>
          {title}
        </h3>
        {actions}
      </div>
      {legend && <div className="chart-frame-legend">{legend}</div>}
      {loading ? (
        <div role="status" aria-busy="true" aria-label={`Loading ${title}`}>
          <span className="sr-only">Loading {title}…</span>
          <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton style={{ width: '100%', height: 120 }} />
            <Skeleton style={{ width: 160, height: 12 }} />
          </div>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
