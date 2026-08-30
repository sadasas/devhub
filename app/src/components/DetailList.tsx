import type { ReactNode } from 'react';

export function DetailList({ children }: { children: ReactNode }) {
  return <div className="detail-list">{children}</div>;
}

export function DetailRow({ label, children, icon }: { label: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="detail-row">
      <span className="detail-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {icon}
        {label}
      </span>
      <div className="detail-value">{children}</div>
    </div>
  );
}

export function DetailSection({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h4 className="detail-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {icon}
        {title}
      </h4>
      <DetailList>{children}</DetailList>
    </div>
  );
}

export function DetailEmpty({ children = '—' }: { children?: ReactNode }) {
  return <span className="detail-empty">{children}</span>;
}