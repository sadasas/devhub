import type { ReactNode } from 'react';

export function DetailList({ children }: { children: ReactNode }) {
  return <div className="detail-list">{children}</div>;
}

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <div className="detail-value">{children}</div>
    </div>
  );
}

export function DetailEmpty({ children = '—' }: { children?: ReactNode }) {
  return <span className="detail-empty">{children}</span>;
}