import type { CSSProperties, ReactNode } from 'react';
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
      {action && <Skeleton className="skeleton-btn" />}
    </header>
  );
}

function KanbanSkeleton() {
  return (
    <div className="kanban" aria-hidden="true">
      {['Todo', 'In Progress', 'Review', 'Done'].map((label) => (
        <div key={label} className="kanban-col">
          <div className="kanban-col-header">
            <span>{label}</span>
          </div>
          <div className="kanban-col-body">
            <Skeleton style={{ height: 84, width: '100%' }} />
            <Skeleton style={{ height: 84, width: '100%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DocsBodySkeleton() {
  return (
    <div className="docs-body" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="docs-section">
          <Skeleton style={{ width: 180, height: 18 }} />
          <Skeleton style={{ width: '100%', height: 14, marginTop: 10 }} />
          <Skeleton style={{ width: '92%', height: 14, marginTop: 6 }} />
          <Skeleton style={{ width: '60%', height: 14, marginTop: 6 }} />
        </div>
      ))}
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
      <div className="project-grid" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="project-card">
            <Skeleton style={{ width: 140, height: 16 }} />
            <Skeleton style={{ width: '100%', height: 14 }} />
            <Skeleton style={{ width: '70%', height: 14 }} />
            <Skeleton style={{ width: 120, height: 12 }} />
          </div>
        ))}
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
            <Skeleton className="skeleton-row-sm" style={{ width: 48, height: 18 }} />
            <Skeleton className="skeleton-row-sm" style={{ width: 56, height: 18 }} />
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
          <div key={i} className="data-row" style={i ? { marginTop: 8 } : undefined}>
            <div className="data-row-main">
              <span className="data-row-title">
                <Skeleton className="skeleton-row" style={{ width: '40%' }} />
                <Skeleton className="skeleton-row-xs" />
              </span>
              <span className="data-row-meta">
                <Skeleton className="skeleton-row-sm" />
              </span>
            </div>
            <div className="data-row-side">
              <Skeleton className="skeleton-row-sm" style={{ width: 88 }} />
            </div>
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
        <Skeleton style={{ width: '100%', height: 48 }} />
        <Skeleton style={{ width: '100%', height: 48, marginTop: 8 }} />
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
          <div key={i} className="data-row">
            <div className="data-row-main">
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
              <Skeleton className="skeleton-row-sm" style={{ width: 56 }} />
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
          <div key={i} className="data-row">
            <div className="data-row-main">
              <Skeleton className="skeleton-row" />
              <Skeleton className="skeleton-row skeleton-row-sm" />
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
            <Skeleton className="skeleton-avatar" />
            <Skeleton className="skeleton-row" style={{ width: 140, height: 18, marginTop: 12 }} />
            <Skeleton className="skeleton-row-sm" style={{ marginTop: 6 }} />
            <Skeleton className="skeleton-row-sm" style={{ width: '70%', marginTop: 14 }} />
            <div className="profile-chips" style={{ marginTop: 12 }}>
              <Skeleton className="skeleton-row-xs" style={{ width: 88 }} />
              <Skeleton className="skeleton-row-xs" style={{ width: 64 }} />
            </div>
            <Skeleton className="skeleton-btn" style={{ marginTop: 16 }} />
          </section>
        </aside>
        <main className="profile-main" aria-hidden="true">
          <div className="sub-tabs" role="tablist" aria-label="Profile sections">
            {[0, 1, 2].map((i) => (
              <span key={i} className="skeleton-tab" />
            ))}
          </div>
          <div className="data-list" style={{ marginTop: 20 }}>
            {[0, 1].map((i) => (
              <div key={i} className="data-row">
                <div className="data-row-main">
                  <Skeleton className="skeleton-row" style={{ width: '50%' }} />
                  <Skeleton className="skeleton-row-sm" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </PageShell>
  );
}

export function AdminSkeleton() {
  return (
    <PageShell label="Admin">
      <HeaderBlock />
      <div className="stats-grid" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="stat-card">
            <Skeleton className="skeleton-row-sm" style={{ width: 80 }} />
            <Skeleton style={{ width: 64, height: 26, marginTop: 8 }} />
          </div>
        ))}
      </div>
      <nav className="tabs" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className="skeleton-tab" />
        ))}
      </nav>
      <section className="tab-panel" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="data-row" style={i ? { marginTop: 8 } : undefined}>
            <div className="data-row-main">
              <span className="data-row-title">
                <Skeleton className="skeleton-row" style={{ width: '40%' }} />
                <Skeleton className="skeleton-row-xs" />
              </span>
              <span className="data-row-meta">
                <Skeleton className="skeleton-row-sm" />
              </span>
            </div>
            <div className="data-row-side">
              <Skeleton className="skeleton-row-sm" style={{ width: 88 }} />
            </div>
          </div>
        ))}
      </section>
    </PageShell>
  );
}

export function DocsSkeleton() {
  return <DocsSkeletonBase label="Docs" />;
}

export function McpDocsSkeleton() {
  return <DocsSkeletonBase label="MCP docs" />;
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
          <Skeleton style={{ width: '100%', height: 220 }} />
        </section>
      </main>
    </div>
  );
}