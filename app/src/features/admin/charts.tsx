import type { ReactNode } from 'react';
import { Skeleton } from '../../components/Skeleton';
import { formatIdr } from '../../lib/format';

export { formatIdr };

// Tokenized palette — turunan --chart-* (ADR-048 Wave1.1), bukan hex random
export const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
];

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
  const summary = total > 0 ? segments.map((s) => `${s.name} ${formatIdr(s.value)}`).join(', ') : label;
  return (
    <div className="admin-chart">
      <svg viewBox="0 0 100 100" className="admin-chart-donut" role="img" aria-label={`${label}: ${summary}`}>
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
        <text x="50" y="47" textAnchor="middle" className="donut-total tabular">
          {formatIdr(total)}
        </text>
        <text x="50" y="61" textAnchor="middle" className="donut-label">
          {label}
        </text>
      </svg>
      <div className="admin-chart-legend">
        {segments.map((s, i) => (
          <span key={i} className="admin-chart-legend-item">
            <span className="admin-chart-legend-dot" style={{ color: s.color, background: 'currentColor' }} />
            {s.name}: {formatIdr(s.value)}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {segments.map((s) => (
            <tr key={s.name}>
              <th scope="row">{s.name}</th>
              <td>{formatIdr(s.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
  const summary = rows.map((r) => `${r.label} ${formatValue ? formatValue(r.value) : formatIdr(r.value)}`).join(', ');
  return (
    <div className="admin-chart">
      <h3 className="admin-chart-title">{label}</h3>
      <div className="admin-bars" role="img" aria-label={`${label}: ${summary}`}>
        {rows.map((r) => (
          <div key={r.label} className="admin-bar-row">
            <span className="admin-bar-label">{r.label}</span>
            <div className="admin-bar-track">
              <div
                className="admin-bar-fill"
                role="meter"
                aria-label={`${r.label} ${formatValue ? formatValue(r.value) : formatIdr(r.value)}`}
                aria-valuenow={r.value}
                aria-valuemin={0}
                aria-valuemax={max}
                style={{ width: `${(r.value / max) * 100}%` }}
              />
            </div>
            <span className="admin-bar-value tabular">{formatValue ? formatValue(r.value) : formatIdr(r.value)}</span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td>{formatValue ? formatValue(r.value) : formatIdr(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
  const tilted = n > 14;
  const summary = rows.map((r) => `${r.label} ${formatValue ? formatValue(r.value) : r.value}`).join(', ');
  return (
    <div className="admin-chart">
      <h3 className="admin-chart-title">{label}</h3>
      <div
        className={`admin-vbar-track ${tilted ? 'admin-vbar-track--tilted' : ''}`}
        role="img"
        aria-label={`${label}: ${summary}`}
        style={{ height: tilted ? barHeight + 56 : barHeight + 24, gap: n > 30 ? 2 : 4 }}
      >
        {rows.map((r) => {
          const h = max > 0 ? (r.value / max) * barHeight : 0;
          return (
            <div
              key={r.id ?? r.label}
              className="admin-vbar-col"
              aria-label={`${r.label}: ${formatValue ? formatValue(r.value) : r.value}`}
            >
              <span className="admin-vbar-value">{formatValue ? formatValue(r.value) : r.value}</span>
              <div
                className="admin-vbar-bar"
                role="meter"
                aria-label={`${r.label} ${formatValue ? formatValue(r.value) : r.value}`}
                aria-valuenow={r.value}
                aria-valuemin={0}
                aria-valuemax={max}
                style={{ height: Math.max(h, 2) }}
              />
              <span className={`admin-vbar-label ${tilted ? 'admin-vbar-label--tilted' : ''}`}>{r.label}</span>
            </div>
          );
        })}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id ?? r.label}>
              <th scope="row">{r.label}</th>
              <td>{formatValue ? formatValue(r.value) : r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
