import type { CSSProperties, ReactNode } from 'react';
import { SKELETON_SIZES } from '../lib/skeleton-presets';
import { Skeleton } from './Skeleton';

interface PageShellProps {
  label: string;
  children: ReactNode;
}

function PageShell({ label, children }: PageShellProps) {
  return (
    <div className="page" role="status" aria-label={`Loading ${label}`} aria-busy="true">
      {children}
    </div>
  );
}

function HeaderBlock({ back, action }: { back?: boolean; action?: boolean }) {
  return (
    <header className="page-header" aria-hidden="true">
      <div>
        {back && (
          <div className="back-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Skeleton style={{ width: 14, height: 14 }} />
            <Skeleton style={{ width: 64, height: 13 }} />
          </div>
        )}
        <Skeleton style={{ width: 220, height: 24, marginTop: back ? 10 : 0 }} />
        <Skeleton className="skeleton-row" style={{ marginTop: 8, width: 300, maxWidth: '100%' }} />
      </div>
      {action && <Skeleton className="skeleton-btn" style={{ width: SKELETON_SIZES.btn.w, height: SKELETON_SIZES.btn.h }} />}
    </header>
  );
}

function TaskCardSkeleton() {
  return (
    <div
      className="task-card"
      aria-hidden="true"
      style={{
        padding: 10,
        gap: 6,
        display: 'flex',
        flexDirection: 'column',
        minHeight: SKELETON_SIZES.taskCard.minHeight,
        maxHeight: SKELETON_SIZES.taskCard.maxHeight,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton style={{ width: SKELETON_SIZES.avatar.sm, height: SKELETON_SIZES.avatar.sm, borderRadius: '50%' }} />
        <Skeleton style={{ width: SKELETON_SIZES.badge.smallW, height: SKELETON_SIZES.badge.smallH, borderRadius: 999 }} />
      </div>
      <Skeleton style={{ width: '85%', height: 14 }} />
      <Skeleton style={{ width: '60%', height: 14, opacity: 0.9 }} />
      <div style={{ display: 'flex', gap: 6 }}>
        <Skeleton style={{ width: 48, height: 16, borderRadius: 6 }} />
        <Skeleton style={{ width: 52, height: 16, borderRadius: 6 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, alignItems: 'center' }}>
        <Skeleton style={{ width: 64, height: 11 }} />
        <Skeleton style={{ width: 44, height: 11, borderRadius: 999 }} />
      </div>
    </div>
  );
}

function KanbanSkeleton() {
  return (
    <div className="kanban" aria-hidden="true">
      {['Todo', 'In Progress', 'Review', 'Done'].map((label) => (
        <div key={label} className="kanban-col">
          <div className="kanban-col-header">
            <span>{label}</span>
            <Skeleton style={{ width: 24, height: 11, borderRadius: 999, marginLeft: 6 }} />
          </div>
          <div className="kanban-col-body">
            <TaskCardSkeleton />
            <div style={{ height: 8 }} />
            <TaskCardSkeleton />
          </div>
        </div>
      ))}
    </div>
  );
}

function DocsBodySkeleton() {
  return (
    <div className="docs-body" aria-hidden="true">
      <div className="docs-section">
        <Skeleton style={{ width: 180, height: 18 }} />
        <Skeleton style={{ width: '100%', height: 14, marginTop: 10 }} />
        <Skeleton style={{ width: '92%', height: 14, marginTop: 6 }} />
      </div>
      <div className="docs-hub" aria-hidden="true">
        <Skeleton style={{ width: 120, height: 16, marginBottom: 12 }} />
        <div className="docs-hub-grid">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} style={{ height: 74, width: '100%' }} />
          ))}
        </div>
        <Skeleton style={{ width: '100%', height: 132, marginTop: 14 }} />
      </div>
      <div className="docs-section">
        <Skeleton style={{ width: 160, height: 18 }} />
        <Skeleton style={{ width: '100%', height: 14, marginTop: 10 }} />
        <Skeleton style={{ width: '88%', height: 14, marginTop: 6 }} />
        <Skeleton style={{ width: '100%', height: 56, marginTop: 12 }} />
      </div>
      <div className="docs-section">
        <Skeleton style={{ width: 180, height: 18 }} />
        <Skeleton style={{ width: '100%', height: 42, marginTop: 10 }} />
        <Skeleton style={{ width: '100%', height: 42, marginTop: 8 }} />
      </div>
    </div>
  );
}

function DocsSkeletonBase({ label }: { label: string }) {
  return (
    <PageShell label={label}>
      <HeaderBlock />
      <div className="docs-grid">
        <div className="docs-main">
          <div className="docs-nav" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="skeleton-row" style={{ marginBottom: 10 }} />
            ))}
          </div>
          <DocsBodySkeleton />
        </div>
        <aside className="docs-toc" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="skeleton-row-sm" style={{ marginBottom: 8 }} />
          ))}
        </aside>
      </div>
    </PageShell>
  );
}

export function DashboardSkeleton() {
  return (
    <PageShell label="Projects">
      <HeaderBlock action />
      <div aria-hidden="true">
        <Skeleton style={{ width: 160, height: 20, marginBottom: 12 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 16 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} style={{ height: SKELETON_SIZES.taskCard.height, borderRadius: 16 }} />
          ))}
        </div>
        <div style={{ marginBottom: 16 }}>
          <Skeleton style={{ height: 72, width: '100%', borderRadius: 12 }} />
        </div>
        <Skeleton style={{ height: 44, marginBottom: 8, borderRadius: 8 }} />
        <div className="welcome-skeleton" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="welcome-row-skeleton"
              style={{ height: SKELETON_SIZES.welcomeRow.height, display: 'flex', alignItems: 'center', gap: 10, padding: '0 10px', borderBottom: '1px solid var(--border-hairline)' }}
            >
              <Skeleton style={{ width: 6, height: 6, borderRadius: 999, flexShrink: 0 }} />
              <Skeleton style={{ width: 140, height: 14, flexShrink: 0 }} />
              <Skeleton style={{ width: 80, height: 11, flexShrink: 0, opacity: 0.85 }} />
              <Skeleton style={{ width: 40, height: 4, borderRadius: 999, flexShrink: 0 }} />
              <Skeleton style={{ width: 24, height: 16, borderRadius: 999, flexShrink: 0, opacity: 0.7 }} />
              <Skeleton style={{ width: 56, height: 11, flexShrink: 0, opacity: 0.7 }} />
              <span style={{ display: 'flex', gap: 3, marginLeft: 'auto', flexShrink: 0 }}>
                {Array.from({ length: 7 }).map((_, j) => (
                  <Skeleton key={j} style={{ width: SKELETON_SIZES.heatCell.size, height: 6 + (j % 3) * 2, borderRadius: 2 }} />
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}

export function ProjectSkeleton() {
  const actions: CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' };
  return (
    <PageShell label="Project">
      <header className="project-header" aria-hidden="true">
        <div className="project-heading">
          <div className="back-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Skeleton style={{ width: 14, height: 14 }} />
            <Skeleton style={{ width: 64, height: 13 }} />
          </div>
          <div className="project-title-row" style={{ marginTop: 10 }}>
            <Skeleton style={{ width: 260, height: 26 }} />
            <Skeleton className="skeleton-row-sm" style={{ width: 48, height: 18, borderRadius: 6 }} />
            <Skeleton className="skeleton-row-sm" style={{ width: 56, height: 18, borderRadius: 6 }} />
          </div>
          <Skeleton className="skeleton-row" style={{ marginTop: 8, width: '60%' }} />
          <div className="project-id-row" style={{ marginTop: 10 }}>
            <Skeleton style={{ width: 180, height: 14 }} />
          </div>
        </div>
        <div className="project-actions" style={actions}>
          <Skeleton className="skeleton-btn" />
          <Skeleton className="skeleton-btn" />
          <Skeleton className="skeleton-btn" />
        </div>
      </header>
      <nav className="tabs" aria-hidden="true">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className="skeleton-tab" />
        ))}
      </nav>
      <section className="tab-panel">
        <KanbanSkeleton />
      </section>
    </PageShell>
  );
}

export function TeamSkeleton() {
  return (
    <PageShell label="Team">
      <HeaderBlock back action />
      <section className="tab-panel" aria-hidden="true">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="data-row"
            style={{
              gridTemplateColumns: 'auto 1fr auto',
              alignItems: 'center',
              gap: 12,
              height: SKELETON_SIZES.dataRow.height,
              marginTop: i ? 8 : undefined,
            }}
          >
            <Skeleton style={{ width: SKELETON_SIZES.avatar.team, height: SKELETON_SIZES.avatar.team, borderRadius: '50%', flexShrink: 0 }} />
            <div className="data-row-main" style={{ gap: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Skeleton style={{ width: 120, height: 14 }} />
                <Skeleton style={{ width: SKELETON_SIZES.badge.w, height: SKELETON_SIZES.badge.h, borderRadius: 6 }} />
              </div>
              <Skeleton style={{ width: '60%', height: 11 }} />
            </div>
            <Skeleton style={{ width: 72, height: 28, borderRadius: 8, flexShrink: 0 }} />
          </div>
        ))}
      </section>
    </PageShell>
  );
}

export function InvitesSkeleton() {
  return (
    <PageShell label="Invitations">
      <HeaderBlock back />
      <div aria-hidden="true">
        <Skeleton style={{ width: '100%', height: 48, borderRadius: 12 }} />
        <Skeleton style={{ width: '100%', height: 48, marginTop: 8, borderRadius: 12 }} />
      </div>
    </PageShell>
  );
}

export function KeysSkeleton() {
  return (
    <PageShell label="API keys">
      <HeaderBlock action />
      <div className="data-list" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="data-row" style={{ height: SKELETON_SIZES.dataRow.height }}>
            <div className="data-row-main" style={{ gap: 4 }}>
              <div className="data-row-title">
                <Skeleton className="skeleton-row" style={{ width: '45%' }} />
              </div>
              <div className="data-row-meta">
                <Skeleton className="skeleton-row-xs" />
              </div>
              <div className="data-row-meta">
                <Skeleton className="skeleton-row-sm" />
              </div>
            </div>
            <div className="data-row-side">
              <Skeleton className="skeleton-row-sm" style={{ width: 56, height: 28, borderRadius: 8 }} />
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

export function TemplatesSkeleton() {
  return (
    <PageShell label="Templates">
      <HeaderBlock />
      <div className="data-list" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="data-row" style={{ height: SKELETON_SIZES.dataRow.height }}>
            <div className="data-row-main" style={{ gap: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Skeleton style={{ width: '55%', height: 14 }} />
                <Skeleton style={{ width: SKELETON_SIZES.badge.w, height: SKELETON_SIZES.badge.h, borderRadius: 999, opacity: 0.7 }} />
              </div>
              <Skeleton style={{ width: '38%', height: 11 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <Skeleton style={{ width: 64, height: 11, borderRadius: 999 }} />
                <Skeleton style={{ width: 44, height: 11 }} />
              </div>
            </div>
            <div className="data-row-side" style={{ gap: 8 }}>
              <Skeleton style={{ width: 64, height: 28, borderRadius: 8 }} />
              <Skeleton style={{ width: 48, height: 28, borderRadius: 8, opacity: 0.6 }} />
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

export function ProfileSkeleton() {
  return (
    <PageShell label="Profile">
      <HeaderBlock />
      <div className="profile-layout">
        <aside className="profile-side" aria-hidden="true">
          <section className="profile-card">
            <Skeleton className="skeleton-avatar-lg" />
            <Skeleton className="skeleton-row" style={{ width: 140, height: 18, marginTop: 12 }} />
            <Skeleton className="skeleton-row-sm" style={{ marginTop: 6 }} />
            <Skeleton className="skeleton-row-sm" style={{ width: '70%', marginTop: 14 }} />
            <div className="profile-chips" style={{ marginTop: 12 }}>
              <Skeleton className="skeleton-row-xs" style={{ width: 88, height: 18, borderRadius: 999 }} />
              <Skeleton className="skeleton-row-xs" style={{ width: 64, height: 18, borderRadius: 999 }} />
            </div>
            <Skeleton className="skeleton-btn" style={{ marginTop: 16 }} />
          </section>
        </aside>
        <main className="profile-main" aria-hidden="true">
          <div className="sub-tabs">
            {[0, 1, 2].map((i) => (
              <span key={i} className="skeleton-tab" />
            ))}
          </div>
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton style={{ width: 220, height: 18 }} />
            <Skeleton style={{ width: '100%', height: 84, borderRadius: 12 }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} style={{ height: 64, borderRadius: 12 }} />
              ))}
            </div>
          </div>
        </main>
      </div>
    </PageShell>
  );
}

export function DocsSkeleton() {
  return <DocsSkeletonBase label="Docs" />;
}

export function McpDocsSkeleton() {
  return <DocsSkeletonBase label="MCP docs" />;
}

export function PricingSkeleton() {
  return (
    <div className="page" role="status" aria-label="Loading pricing" aria-busy="true">
      <HeaderBlock />
      <div aria-hidden="true">
        <Skeleton style={{ width: '100%', height: 44, borderRadius: 8, marginBottom: 12 }} />
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
          <Skeleton style={{ width: 180, height: 32, borderRadius: 999 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {[0, 1].map((i) => (
            <div key={i} className="pricing-card" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <Skeleton style={{ width: 90, height: 16 }} />
              <Skeleton style={{ width: 160, height: 30, marginTop: 12 }} />
              <Skeleton className="skeleton-row" style={{ marginTop: 14 }} />
              <Skeleton className="skeleton-row" style={{ marginTop: 8 }} />
              <Skeleton className="skeleton-row" style={{ width: '70%', marginTop: 8 }} />
              <Skeleton style={{ width: '100%', height: SKELETON_SIZES.pricingCard.height, marginTop: 16, borderRadius: 8 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PaymentHistorySkeleton() {
  return (
    <div className="page" role="status" aria-label="Loading payments" aria-busy="true">
      <HeaderBlock back />
      <div aria-hidden="true" className="billing-list" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="billing-row" style={{ display: 'flex', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--border-hairline)', alignItems: 'center' }}>
            <div className="billing-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Skeleton style={{ width: 96, height: 15, borderRadius: 4 }} />
                <Skeleton style={{ width: 56, height: 18, borderRadius: 999 }} />
              </div>
              <Skeleton style={{ width: '62%', height: 11, borderRadius: 4 }} />
              <Skeleton style={{ width: '42%', height: 11, borderRadius: 4 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <Skeleton style={{ width: 96, height: 32, borderRadius: 8 }} />
              <Skeleton style={{ width: 96, height: 32, borderRadius: 8 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PublicProjectSkeleton() {
  return (
    <div className="public-root">
      <header className="public-bar" aria-hidden="true">
        <span className="public-brand">DevHub</span>
        <Skeleton className="skeleton-btn" />
      </header>
      <main className="page" role="status" aria-label="Loading public project" aria-busy="true">
        <Skeleton style={{ width: 280, height: 28, marginTop: 8 }} />
        <Skeleton style={{ width: 200, height: 16, marginTop: 12 }} />
        <nav className="tabs" aria-hidden="true" style={{ marginTop: 24 }}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="skeleton-tab" />
          ))}
        </nav>
        <section className="tab-panel" aria-hidden="true">
          <Skeleton style={{ width: '100%', height: 220, borderRadius: 12 }} />
        </section>
      </main>
    </div>
  );
}

export { KanbanSkeleton };
