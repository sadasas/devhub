import type { ReactNode } from 'react';
import { Skeleton } from '../../components/Skeleton';

export function formatIdr(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

export function compactId(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(',0', '')}jt`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(',0', '')}rb`;
  return String(n);
}

export const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function Donut({
  segments,
  total,
  label,
}: {
  segments: { value: number; color: string; name: string }[];
  total: number;
  label: string;
}) {
  const r = 40;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="admin-chart">
      <svg viewBox="0 0 100 100" className="admin-chart-donut" role="img" aria-label={label}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--bg-inset)" strokeWidth="14" />
        {total > 0 &&
          segments.map((s, i) => {
            const len = (s.value / total) * c;
            const el = (
              <circle
                key={i}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="14"
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-acc}
                transform="rotate(-90 50 50)"
              />
            );
            acc += len;
            return el;
          })}
        <text x="50" y="47" textAnchor="middle" className="donut-total">
          {total}
        </text>
        <text x="50" y="61" textAnchor="middle" className="donut-label">
          {label}
        </text>
      </svg>
      <div className="admin-chart-legend">
        {segments.map((s, i) => (
          <span key={i} className="admin-chart-legend-item">
            <span className="admin-chart-legend-dot" style={{ background: s.color }} />
            {s.name}: {formatIdr(s.value)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BarChart({
  rows,
  label,
  formatValue,
}: {
  rows: { label: string; value: number }[];
  label: string;
  formatValue?: (n: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="admin-chart">
      <h4 className="admin-chart-title">{label}</h4>
      <div className="admin-bars">
        {rows.map((r) => (
          <div key={r.label} className="admin-bar-row">
            <span className="admin-bar-label">{r.label}</span>
            <div className="admin-bar-track">
              <div
                className="admin-bar-fill"
                style={{ width: `${(r.value / max) * 100}%` }}
              />
            </div>
            <span className="admin-bar-value">{formatValue ? formatValue(r.value) : formatIdr(r.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VerticalBarChart({
  rows,
  label,
  formatValue,
}: {
  rows: { id?: string; label: string; value: number }[];
  label: string;
  formatValue?: (n: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const barHeight = 140;
  const n = rows.length;
  const showLabel = (i: number) => n <= 14 ? true : i % (n <= 35 ? 5 : 10) === 0 || i === n - 1;
  return (
    <div className="admin-chart">
      <h4 className="admin-chart-title">{label}</h4>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: n > 30 ? 2 : 4, height: barHeight + 24 }}>
        {rows.map((r, i) => {
          const h = max > 0 ? (r.value / max) * barHeight : 0;
          return (
            <div
              key={r.id ?? r.label}
              title={`${r.label}: ${formatValue ? formatValue(r.value) : r.value}`}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
            >
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}
                className="admin-vbar-value"
              >
                {formatValue ? formatValue(r.value) : r.value}
              </span>
              <div
                style={{
                  width: '100%',
                  maxWidth: 40,
                  height: Math.max(h, 2),
                  background: 'var(--accent)',
                  borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                  transition: 'height var(--duration-fast) var(--ease-out)',
                }}
              />
              {showLabel(i) ? (
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {r.label}
                </span>
              ) : (
                <span style={{ fontSize: 10 }}>&nbsp;</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: number | null;
  accent?: boolean;
}) {
  return (
    <div className={accent ? 'stat-card-revenue' : 'stat-card'}>
      <h3 className="stat-card-title">
        {icon}
        {label}
      </h3>
      <span className="stat-card-value">
        {value === null ? <Skeleton style={{ width: 48, height: 22 }} /> : value}
      </span>
    </div>
  );
}
