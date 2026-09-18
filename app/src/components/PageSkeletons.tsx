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

function CardShell({ children, compact = false, narrow = false }: { children: ReactNode; compact?: boolean; narrow?: boolean }) {
  const body = narrow ? <div className="narrow-center">{children}</div> : children;
  return (
    <article className={compact ? 'pcard pcard--compact' : 'pcard'}>
      <div className="pcard-body">{body}</div>
    </article>
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
    <div className="task-card-wrap" aria-hidden="true">
      <div
        className="task-card"
        style={{
          minHeight: SKELETON_SIZES.taskCard.minHeight,
          maxHeight: SKELETON_SIZES.taskCard.maxHeight,
        }}
      >
        <div className="task-card-top">
          <Skeleton style={{ width: SKELETON_SIZES.avatar.sm, height: SKELETON_SIZES.avatar.sm, borderRadius: '50%' }} />
          <Skeleton style={{ width: '34%', height: 11 }} />
          <Skeleton style={{ width: 30, height: 18, borderRadius: 6, marginLeft: 'auto' }} />
        </div>
        <Skeleton style={{ width: '85%', height: 14 }} />
        <div className="task-card-labels">
          <Skeleton style={{ width: 48, height: 16, borderRadius: 999 }} />
          <Skeleton style={{ width: 52, height: 16, borderRadius: 999 }} />
        </div>
        <div className="task-card-meta">
          <span className="task-meta-left">
            <Skeleton style={{ width: 64, height: 11 }} />
          </span>
          <span className="task-meta-right">
            <Skeleton style={{ width: 44, height: 11 }} />
          </span>
        </div>
      </div>
    </div>
  );
}

function KanbanSkeleton() {
  return (
    <div className="kanban" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="kanban-col">
          <div className="kanban-col-header">
            <Skeleton style={{ width: 72, height: 13 }} />
            <Skeleton style={{ width: 20, height: 11, marginLeft: 6 }} />
          </div>
          <div className="kanban-col-body">
            <TaskCardSkeleton />
            <div style={{ height: 8 }} />
            <TaskCardSkeleton />
          </div>
          <div className="kanban-col-add">
            <Skeleton style={{ width: '100%', height: 28, borderRadius: 8 }} />
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
      <CardShell>
      <HeaderBlock />
      <div className="docs-grid">
        <div className="docs-main">
          <div className="docs-nav" aria-hidden="true" style={{ display: "flex", gap: 2 }}>
            <Skeleton style={{ width: 110, height: 30, borderRadius: 8 }} />
            <Skeleton style={{ width: 130, height: 30, borderRadius: 8 }} />
          </div>
          <DocsBodySkeleton />
        </div>
        <aside className="docs-toc" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="skeleton-row-sm" style={{ marginBottom: 8 }} />
          ))}
        </aside>
      </div>
      </CardShell>
    </PageShell>
  );
}

export function DashboardSkeleton() {
  return (
    <PageShell label="Projects">
      <CardShell>
      <HeaderBlock action />
      <div aria-hidden="true">
        <Skeleton style={{ width: 160, height: 20, marginBottom: 12 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 16 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} style={{ height: SKELETON_SIZES.taskCard.height, borderRadius: 16 }} />
          ))}
        </div>
        <div className="task-activity" style={{ marginBottom: 16 }}>
          <Skeleton style={{ width: 140, height: 14, marginBottom: 8 }} />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 72 }}>
            {[18, 34, 26, 52, 44, 64, 30].map((h, i) => (
              <Skeleton key={i} style={{ width: '100%', height: h, borderRadius: 4 }} />
            ))}
          </div>
        </div>
        <div className="welcome-command-bar" style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <Skeleton style={{ flex: 1, height: 36, borderRadius: 8 }} />
          <Skeleton style={{ width: 120, height: 36, borderRadius: 8 }} />
          <Skeleton style={{ width: 48, height: 18, borderRadius: 999, alignSelf: 'center' }} />
        </div>
        <div className="welcome-list">
          {Array.from({ length: SKELETON_SIZES.welcomeRow.count }).map((_, i) => (
            <div key={i} className="welcome-row-wrap">
              <div className="welcome-row">
                <span className="welcome-row-main">
                  <span className="welcome-row-dot" style={{ background: 'var(--text-muted)', opacity: 0.35 }} />
                  <Skeleton style={{ flex: '1 1 auto', maxWidth: 220, minWidth: 80, height: 13 }} />
                  <Skeleton style={{ width: 84, height: 18, borderRadius: 999, flexShrink: 0 }} />
                </span>
                <span className="welcome-row-meta">
                  <span className="welcome-row-progress">
                    <Skeleton style={{ width: 56, height: 4, borderRadius: 6, flexShrink: 0 }} />
                    <Skeleton style={{ width: 30, height: 11, flexShrink: 0 }} />
                  </span>
                  <Skeleton style={{ width: 24, height: 16, borderRadius: 999, flexShrink: 0, opacity: 0.7 }} />
                  <Skeleton style={{ width: 56, height: 11, flexShrink: 0, opacity: 0.7 }} />
                  <span className="welcome-spark">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <Skeleton key={j} style={{ width: 3, height: 6 + (j % 3) * 2, borderRadius: 2 }} />
                    ))}
                  </span>
                  <span className="welcome-row-chevron" style={{ width: 12, opacity: 0 }} />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      </CardShell>
    </PageShell>
  );
}

export function ProjectSkeleton() {
  const actions: CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' };
  return (
    <PageShell label="Project">
      <CardShell compact>
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
      </CardShell>
    </PageShell>
  );
}

export function ProjectSettingsSkeleton() {
  return (
    <div className="project-settings" role="status" aria-label="Loading project settings" aria-busy="true">
      <nav className="settings-nav" aria-hidden="true">
        <Skeleton style={{ width: 120, height: 14 }} />
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 2px' }}>
            <Skeleton style={{ width: 15, height: 15, borderRadius: 4 }} />
            <Skeleton style={{ width: 90, height: 13 }} />
          </span>
        ))}
      </nav>
      <div className="project-settings-panel" aria-hidden="true">
        <div className="profile-panel">
          <div className="narrow-center">
            <Skeleton style={{ width: 120, height: 14 }} />
            <Skeleton style={{ width: '70%', height: 12, marginTop: 8 }} />
            <Skeleton style={{ width: '100%', height: 34, borderRadius: 8, marginTop: 16 }} />
            <Skeleton style={{ width: '100%', height: 76, borderRadius: 8, marginTop: 12 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <Skeleton style={{ width: 90, height: 13 }} />
              <Skeleton style={{ width: 120, height: 13 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <Skeleton style={{ width: 130, height: 34, borderRadius: 8 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TeamSkeleton() {
  return (
    <PageShell label="Team">
      <CardShell narrow>
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
      </CardShell>
    </PageShell>
  );
}

export function BillingRedirectSkeleton() {
  return (
    <div className="page" role="status" aria-label="Loading billing status" aria-busy="true">
      <div className="billing-redirect-card" aria-hidden="true">
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <Skeleton style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Skeleton style={{ width: 110, height: 18, borderRadius: 6 }} />
              <Skeleton style={{ width: 64, height: 18, borderRadius: 999 }} />
              <Skeleton style={{ width: 32, height: 18, borderRadius: 999 }} />
            </div>
            <Skeleton style={{ width: "88%", height: 13, borderRadius: 6 }} />
          </div>
        </div>
        <dl className="billing-facts">
          {["Paket", "Durasi", "Jumlah", "Order ID", "Dibuat"].map((label) => (
            <div key={label} style={{ display: "contents" }}>
              <dt><Skeleton style={{ width: 60, height: 11, borderRadius: 4 }} /></dt>
              <dd><Skeleton style={{ width: 120, height: 13, borderRadius: 4 }} /></dd>
            </div>
          ))}
        </dl>
        <div className="billing-redirect-actions">
          <Skeleton style={{ width: 100, height: 28, borderRadius: 8 }} />
          <Skeleton style={{ width: 170, height: 28, borderRadius: 8 }} />
        </div>
      </div>
    </div>
  );
}

export function InvitesSkeleton() {
  return (
    <PageShell label="Invitations">
      <CardShell narrow>
      <HeaderBlock />
      <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[0, 1].map((i) => (
          <div key={i} className="data-row">
            <div className="data-row-main" style={{ gap: 6 }}>
              <div className="data-row-title" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Skeleton style={{ width: '45%', height: 14 }} />
                <Skeleton style={{ width: 56, height: 18, borderRadius: 6 }} />
              </div>
              <Skeleton style={{ width: '60%', height: 11 }} />
            </div>
            <div className="data-row-side" style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
              <Skeleton style={{ width: 72, height: 28, borderRadius: 8 }} />
              <Skeleton style={{ width: 88, height: 28, borderRadius: 8 }} />
            </div>
          </div>
        ))}
      </div>
      </CardShell>
    </PageShell>
  );
}

export function KeysSkeleton() {
  return (
    <PageShell label="API keys">
      <CardShell narrow>
      <HeaderBlock action />
      <div className="data-list" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="data-row" style={{ height: SKELETON_SIZES.dataRow.height }}>
            <div className="data-row-main" style={{ gap: 4 }}>
              <div className="data-row-title" style={{ alignItems: 'center' }}>
                <Skeleton className="skeleton-row" style={{ width: '45%' }} />
                <Skeleton style={{ width: 7, height: 7, borderRadius: 999, marginLeft: 8, flexShrink: 0 }} />
              </div>
              <div className="data-row-meta">
                <Skeleton className="skeleton-row-xs" />
              </div>
              <div className="data-row-meta">
                <Skeleton className="skeleton-row-sm" />
              </div>
            </div>
            <div className="data-row-side">
              <Skeleton style={{ width: SKELETON_SIZES.btn.w, height: SKELETON_SIZES.btn.h, borderRadius: 8 }} />
            </div>
          </div>
        ))}
      </div>
      </CardShell>
    </PageShell>
  );
}

export function TemplatesSkeleton() {
  return (
    <PageShell label="Templates">
      <CardShell narrow>
      <HeaderBlock />
      <div className="data-list" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="data-row" style={{ height: SKELETON_SIZES.dataRow.height }}>
            <div className="data-row-main" style={{ gap: 6 }}>
              <Skeleton style={{ width: '55%', height: 14 }} />
              <Skeleton style={{ width: '38%', height: 11 }} />
              <Skeleton style={{ width: '30%', height: 11, opacity: 0.85 }} />
            </div>
            <div className="data-row-side" style={{ gap: 8 }}>
              <Skeleton style={{ width: 64, height: 28, borderRadius: 8 }} />
              <Skeleton style={{ width: 110, height: 28, borderRadius: 8 }} />
            </div>
          </div>
        ))}
      </div>
      </CardShell>
    </PageShell>
  );
}

export function ProfileSkeleton() {
  return (
    <PageShell label="Profile">
      <article className="pcard">
        <div className="pcard-body">
          <HeaderBlock />
          <div className="profile-layout">
            <aside className="profile-side" aria-hidden="true">
              <section className="profile-card">
                <Skeleton style={{ width: 72, height: 72, borderRadius: 16 }} />
                <Skeleton className="skeleton-row" style={{ width: 140, height: 18, marginTop: 12 }} />
                <Skeleton className="skeleton-row-sm" style={{ marginTop: 6 }} />
                <Skeleton className="skeleton-row-sm" style={{ width: '70%', marginTop: 14 }} />
                <div className="profile-chips" style={{ marginTop: 12 }}>
                  <Skeleton className="skeleton-row-xs" style={{ width: 88, height: 18, borderRadius: 999 }} />
                  <Skeleton className="skeleton-row-xs" style={{ width: 64, height: 18, borderRadius: 999 }} />
                </div>
                <Skeleton style={{ width: '100%', height: 36, borderRadius: 8, marginTop: 16 }} />
              </section>
            </aside>
            <main className="profile-main" aria-hidden="true">
              <div className="sub-tabs">
                {[110, 100, 110].map((w, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px' }}>
                    <Skeleton style={{ width: 13, height: 13, borderRadius: 4 }} />
                    <Skeleton style={{ width: w, height: 12 }} />
                  </span>
                ))}
              </div>
              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Skeleton style={{ width: 140, height: 14 }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(26, 10px)', gap: 3 }}>
                  {Array.from({ length: 182 }).map((_, i) => (
                    <Skeleton key={i} style={{ width: 10, height: 10, borderRadius: 2 }} />
                  ))}
                </div>
                <Skeleton style={{ width: 180, height: 11 }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} style={{ height: 64, borderRadius: 12 }} />
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12, border: '1px solid var(--border-hairline)', borderRadius: 12 }}>
                      <Skeleton style={{ width: 44, height: 24 }} />
                      <Skeleton style={{ width: '70%', height: 12 }} />
                    </div>
                  ))}
                </div>
                <div className="profile-collections">
                  {[0, 1].map((i) => (
                    <section key={i} className="profile-panel">
                      <Skeleton style={{ width: 120, height: 12, marginBottom: 10 }} />
                      {[0, 1, 2].map((j) => (
                        <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 2px' }}>
                          <Skeleton style={{ width: '40%', height: 13 }} />
                          <Skeleton style={{ width: 64, height: 11, marginLeft: 'auto' }} />
                          <Skeleton style={{ width: 12, height: 12, borderRadius: 4, flexShrink: 0 }} />
                        </div>
                      ))}
                    </section>
                  ))}
                </div>
              </div>
            </main>
          </div>
        </div>
      </article>
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
      <CardShell narrow>
      <HeaderBlock />
      <div aria-hidden="true">
        <div style={{ display: "flex", gap: 12, alignItems: "center", border: "1px solid var(--border-hairline)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <Skeleton style={{ width: 140, height: 13 }} />
          <Skeleton style={{ flex: 1, height: 36, borderRadius: 8 }} />
        </div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 16 }}>
          <Skeleton style={{ width: 110, height: 32, borderRadius: 999 }} />
          <Skeleton style={{ width: 150, height: 32, borderRadius: 999 }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="pricing-card" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <Skeleton style={{ width: 90, height: 16 }} />
              <Skeleton style={{ width: "70%", height: 12, marginTop: 8 }} />
              <Skeleton style={{ width: 160, height: 30, marginTop: 12 }} />
              <Skeleton style={{ width: 110, height: 16, marginTop: 6, borderRadius: 999 }} />
              {[0, 1, 2, 3, 4].map((j) => (
                <div key={j} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: j === 0 ? 14 : 8 }}>
                  <Skeleton style={{ width: 14, height: 14, borderRadius: 999, flexShrink: 0 }} />
                  <Skeleton style={{ width: `${70 - j * 6}%`, height: 12 }} />
                </div>
              ))}
              <Skeleton style={{ width: "100%", height: 34, marginTop: 16, borderRadius: 8 }} />
            </div>
          ))}
        </div>
        <Skeleton style={{ width: "100%", height: 220, marginTop: 24, borderRadius: 12 }} />
      </div>
      </CardShell>
    </div>
  );
}

export function PaymentHistorySkeleton() {
  return (
    <div className="page" role="status" aria-label="Loading payments" aria-busy="true">
      <CardShell narrow>
      <HeaderBlock />
      <div aria-hidden="true" className="billing-ledger" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="billing-row" style={{ display: "flex", gap: 12, padding: "14px 0", alignItems: "center" }}>
            <div className="billing-main" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="billing-row-head" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Skeleton style={{ width: 110, height: 15 }} />
                <Skeleton style={{ width: 64, height: 18, borderRadius: 999 }} />
              </div>
              <div className="billing-meta">
                <Skeleton style={{ width: "62%", height: 11 }} />
              </div>
            </div>
            <div className="billing-actions" style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <Skeleton style={{ width: 86, height: 28, borderRadius: 8 }} />
            </div>
          </div>
        ))}
      </div>
      </CardShell>
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
        <div className="project-actions" style={{ display: "flex", gap: 8, marginTop: 12 }} aria-hidden="true">
          <Skeleton style={{ width: 90, height: 22, borderRadius: 999 }} />
          <Skeleton style={{ width: 70, height: 22, borderRadius: 999 }} />
        </div>
        <nav className="tabs" aria-hidden="true" style={{ marginTop: 24 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className="skeleton-tab" />
          ))}
        </nav>
        <section className="tab-panel" aria-hidden="true">
          <KanbanSkeleton />
        </section>
      </main>
    </div>
  );
}

export function MembersTabSkeleton() {
  return (
    <section
      className="tab-panel dashboard__members"
      id="dashboard-tabpanel-members"
      tabIndex={0}
    >
      <article className="pcard">
        <div className="pcard-body">
          <div className="narrow-center">
            <header className="page-header" aria-hidden="true">
              <div>
                <Skeleton style={{ width: 160, height: 22 }} />
                <Skeleton style={{ width: 96, height: 11, marginTop: 8 }} />
              </div>
              <Skeleton style={{ width: 96, height: 32, borderRadius: 8 }} />
            </header>
            <div aria-hidden="true" className="dashboard__members-list">
              {[0, 1, 2].map((i) => (
                <div key={i} className="data-row dashboard__members-row">
                  <Skeleton style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
                  <div className="data-row-main" style={{ gap: 6 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Skeleton style={{ width: 120, height: 14 }} />
                      <Skeleton style={{ width: 48, height: 16, borderRadius: 6 }} />
                    </div>
                    <Skeleton style={{ width: '60%', height: 11 }} />
                  </div>
                  <div className="data-row-side">
                    <Skeleton style={{ width: 72, height: 28, borderRadius: 8 }} />
                    <Skeleton style={{ width: 88, height: 28, borderRadius: 8 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}

export function SettingsTabSkeleton() {
  return (
    <section
      className="tab-panel dashboard__settings"
      id="dashboard-tabpanel-settings"
      tabIndex={0}
    >
      <article className="pcard">
        <div className="pcard-body">
          <div className="narrow-center">
            <header className="page-header" aria-hidden="true">
              <div>
                <Skeleton style={{ width: 160, height: 22 }} />
                <Skeleton style={{ width: 240, height: 12, marginTop: 8 }} />
              </div>
            </header>
            <section className="dashboard__settings-section" aria-hidden="true">
              <Skeleton style={{ width: 120, height: 14 }} />
              <Skeleton style={{ width: '70%', height: 12, marginTop: 6 }} />
              <div className="dashboard__settings-row" style={{ marginTop: 12 }}>
                <Skeleton style={{ width: 72, height: 36, borderRadius: 8 }} />
                <Skeleton style={{ flex: 1, height: 36, borderRadius: 8 }} />
              </div>
              <Skeleton style={{ width: '100%', height: 36, borderRadius: 8, marginTop: 12 }} />
              <div className="dashboard__settings-id-row" style={{ marginTop: 12 }}>
                <Skeleton style={{ flex: 1, height: 36, borderRadius: 8 }} />
                <Skeleton style={{ width: 110, height: 36, borderRadius: 8 }} />
              </div>
              <Skeleton style={{ width: 120, height: 36, borderRadius: 8, marginTop: 12 }} />
            </section>
            <section className="dashboard__settings-section" aria-hidden="true">
              <Skeleton style={{ width: 100, height: 14 }} />
              <Skeleton style={{ width: '60%', height: 12, marginTop: 6 }} />
              <div className="dashboard__settings-plan-row" style={{ marginTop: 12 }}>
                <Skeleton style={{ width: 140, height: 16 }} />
                <Skeleton style={{ width: 110, height: 36, borderRadius: 8 }} />
              </div>
              <Skeleton style={{ width: 220, height: 12, marginTop: 8 }} />
            </section>
            <section className="dashboard__settings-section" aria-hidden="true">
              <Skeleton style={{ width: 110, height: 14 }} />
              <Skeleton style={{ width: '65%', height: 12, marginTop: 6 }} />
              <div className="dashboard__settings-stats" style={{ marginTop: 12 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="dashboard__settings-stat" style={{ gap: 6 }}>
                    <Skeleton style={{ width: '60%', height: 15 }} />
                    <Skeleton style={{ width: '45%', height: 12 }} />
                  </div>
                ))}
              </div>
              <div className="dashboard__settings-meters" style={{ marginTop: 8 }}>
                {[0, 1].map((i) => (
                  <div key={i} className="usage-meter" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Skeleton style={{ width: 64, height: 12 }} />
                    <Skeleton style={{ flex: 1, height: 8, borderRadius: 999 }} />
                    <Skeleton style={{ width: 56, height: 12 }} />
                  </div>
                ))}
              </div>
            </section>
            <section className="dashboard__settings-section dashboard__settings-section--danger" aria-hidden="true">
              <Skeleton style={{ width: 130, height: 14 }} />
              <Skeleton style={{ width: '75%', height: 12, marginTop: 6 }} />
              <div className="dashboard__settings-danger-row" style={{ marginTop: 12 }}>
                <Skeleton style={{ width: '50%', height: 12 }} />
                <Skeleton style={{ width: 110, height: 36, borderRadius: 8 }} />
              </div>
            </section>
          </div>
        </div>
      </article>
    </section>
  );
}

export function DashboardMembersSkeleton() {
  return (
    <div className="page welcome-page dashboard" role="status" aria-label="Loading members" aria-busy="true">
      <div aria-hidden="true">
        <MembersTabSkeleton />
      </div>
    </div>
  );
}

export function DashboardSettingsSkeleton() {
  return (
    <div className="page welcome-page dashboard" role="status" aria-label="Loading settings" aria-busy="true">
      <div aria-hidden="true">
        <SettingsTabSkeleton />
      </div>
    </div>
  );
}

export { KanbanSkeleton };
