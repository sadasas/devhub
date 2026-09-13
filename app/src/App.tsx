import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams, useSearchParams } from 'react-router';
import { AuthProvider, useAuth } from './state/auth-context';
import { ProjectsProvider } from './state/projects-context';
import { TeamsProvider, useTeams } from './state/teams-context';
import { ActivityUnreadProvider } from './state/ActivityUnreadContext';
import { AuthPage } from './features/auth/AuthPage';
import { Layout } from './features/layout/Layout';
import {
  BillingRedirectSkeleton,
  DashboardMembersSkeleton,
  DashboardSettingsSkeleton,
  DashboardSkeleton,
  InvitesSkeleton,
  KeysSkeleton,
  PaymentHistorySkeleton,
  PricingSkeleton,
  ProfileSkeleton,
  ProjectSkeleton,
  PublicProjectSkeleton,
  TeamSkeleton,
  TemplatesSkeleton,
} from './components/PageSkeletons';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RouteBoundary } from './components/RouteBoundary';
import { Skeleton } from './components/Skeleton';
import { Splash } from './components/Splash';
import { ExternalRedirect } from './components/ExternalRedirect';
import { DOCS_HOME_URL, DOCS_MCP_URL, DOCS_PRIVACY_URL, DOCS_TERMS_URL } from './lib/docs-urls';

const DashboardPageLazy = lazy(() => import('./features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const HomeRedirectLazy = lazy(() => import('./features/dashboard/HomeRedirect').then((m) => ({ default: m.HomeRedirect })));
const KeysPageLazy = lazy(() => import('./features/keys/KeysPage').then((m) => ({ default: m.KeysPage })));
const ProfilePageLazy = lazy(() => import('./features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const InvitesPageLazy = lazy(() => import('./features/teams/InvitesPage').then((m) => ({ default: m.InvitesPage })));
const TemplatesPageLazy = lazy(() => import('./features/templates/TemplatesPage').then((m) => ({ default: m.TemplatesPage })));
const ProjectPageLazy = lazy(() => import('./features/project/ProjectPage').then((m) => ({ default: m.ProjectPage })));
const PublicProjectPageLazy = lazy(() => import('./features/public/PublicProjectPage').then((m) => ({ default: m.PublicProjectPage })));
const PricingPageLazy = lazy(() => import('./features/pricing/PricingPage').then((m) => ({ default: m.PricingPage })));
const PaymentHistoryPageLazy = lazy(() => import('./features/billing/PaymentHistoryPage').then((m) => ({ default: m.PaymentHistoryPage })));
const BillingRedirectPageLazy = lazy(() => import('./features/teams/BillingRedirectPage').then((m) => ({ default: m.BillingRedirectPage })));
const ResetPasswordPageLazy = lazy(() => import('./features/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const NotFoundLazy = lazy(() => import('./components/NotFound').then((m) => ({ default: m.NotFoundPage })));
const CommandPaletteLazy = lazy(() => import('./components/CommandPalette').then((m) => ({ default: m.CommandPalette })));



// Legacy /team/:teamId now redirects to the canonical workspace route
// (/:slug/projects|members|settings), resolving the id to its current slug.
// History rewrites are handled by the workspace page itself.
function TeamLegacyRedirect() {
  const { teamId } = useParams<{ teamId: string }>();
  const [searchParams] = useSearchParams();
  const { teams } = useTeams();
  if (!teamId) return <Navigate to="/" replace />;
  if (teams === null) return <TeamSkeleton />;
  const team = teams.find((tm) => tm.id === teamId);
  if (!team) return <Navigate to="/" replace />;
  const slug = encodeURIComponent(team.slug || team.id);
  const tab = searchParams.get('tab');
  if (tab === 'usage') return <Navigate to={`/${slug}/settings?section=billing`} replace />;
  if (tab === 'members') return <Navigate to={`/${slug}/members`} replace />;
  if (tab === 'settings') return <Navigate to={`/${slug}/settings`} replace />;
  return <Navigate to={`/${slug}/projects`} replace />;
}

// Bare /:teamSlug canonicalizes to the projects tab (preserves query).
function TeamSlugRedirect() {
  const { teamSlug } = useParams<{ teamSlug?: string }>();
  const [searchParams] = useSearchParams();
  if (!teamSlug) return <Navigate to="/" replace />;
  const qs = searchParams.toString();
  return <Navigate to={`/${encodeURIComponent(teamSlug)}/projects${qs ? `?${qs}` : ''}`} replace />;
}

function getReturnTo(): string | null {
  try {
    const rt = new URLSearchParams(window.location.search).get('returnTo');
    if (rt && (rt.startsWith('http://localhost:3000/oauth/authorize') || rt.startsWith('https://'))) return rt;
    return null;
  } catch {
    return null;
  }
}

function Root() {
  const { user, loading } = useAuth();
  if (loading) return <Splash mode="brand" />;
  if (!user) return <AuthPage />;
  // Unified auth: if already logged in and OAuth authorize was requested, redirect back
  const returnTo = getReturnTo();
  if (returnTo) {
    window.location.href = returnTo;
    return <Splash mode="shell" />;
  }
  return (
    <TeamsProvider>
      <ProjectsProvider>
        <ActivityUnreadProvider>
          <Routes>
            <Route element={<Layout />}>
            <Route
              path="/"
              element={
                <RouteBoundary fallback={<DashboardSkeleton />}>
                  <HomeRedirectLazy />
                </RouteBoundary>
              }
            />
            <Route
              path="/project/:projectId"
              element={
                <RouteBoundary fallback={<ProjectSkeleton />}>
                  <ProjectPageLazy />
                </RouteBoundary>
              }
            />
            <Route path="/team/:teamId" element={<TeamLegacyRedirect />} />
            <Route
              path="/invites"
              element={
                <RouteBoundary fallback={<InvitesSkeleton />}>
                  <InvitesPageLazy />
                </RouteBoundary>
              }
            />
            <Route
              path="/connected"
              element={
                <RouteBoundary fallback={<KeysSkeleton />}>
                  <KeysPageLazy />
                </RouteBoundary>
              }
            />
            <Route
              path="/templates"
              element={
                <RouteBoundary fallback={<TemplatesSkeleton />}>
                  <TemplatesPageLazy />
                </RouteBoundary>
              }
            />
            <Route
              path="/profile"
              element={
                <RouteBoundary fallback={<ProfileSkeleton />}>
                  <ProfilePageLazy />
                </RouteBoundary>
              }
            />
            <Route
              path="/pricing"
              element={
                <RouteBoundary fallback={<PricingSkeleton />}>
                  <PricingPageLazy />
                </RouteBoundary>
              }
            />
            <Route
              path="/payments"
              element={
                <RouteBoundary fallback={<PaymentHistorySkeleton />}>
                  <PaymentHistoryPageLazy />
                </RouteBoundary>
              }
            />
            <Route path="/keys" element={<Navigate to="/connected" replace />} />
            {/* Workspace routes (/:slug/...) AFTER statics so /docs etc. never match as a slug. */}
            <Route
              path="/:teamSlug/projects"
              element={
                <RouteBoundary fallback={<DashboardSkeleton />}>
                  <DashboardPageLazy />
                </RouteBoundary>
              }
            />
            <Route
              path="/:teamSlug/members"
              element={
                <RouteBoundary fallback={<DashboardMembersSkeleton />}>
                  <DashboardPageLazy />
                </RouteBoundary>
              }
            />
            <Route
              path="/:teamSlug/settings"
              element={
                <RouteBoundary fallback={<DashboardSettingsSkeleton />}>
                  <DashboardPageLazy />
                </RouteBoundary>
              }
            />
            <Route path="/:teamSlug" element={<TeamSlugRedirect />} />
            <Route
              path="*"
              element={
                <RouteBoundary fallback={<DashboardSkeleton />}>
                  <NotFoundLazy />
                </RouteBoundary>
              }
            />
          </Route>
          </Routes>
          <ErrorBoundary>
            <Suspense fallback={null}>
              <CommandPaletteLazy />
            </Suspense>
          </ErrorBoundary>
        </ActivityUnreadProvider>
      </ProjectsProvider>
    </TeamsProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route
              path="/p/:projectId"
              element={
                <RouteBoundary fallback={<PublicProjectSkeleton />}>
                  <PublicProjectPageLazy />
                </RouteBoundary>
              }
            />
            <Route
              path="/billing/:teamId"
              element={
                <RouteBoundary fallback={<BillingRedirectSkeleton />}>
                  <BillingRedirectPageLazy />
                </RouteBoundary>
              }
            />
            <Route
              path="/reset-password"
              element={
                <RouteBoundary fallback={<div role="status" aria-label="Loading reset password" aria-busy="true" style={{ padding: 24 }}><span className="sr-only">Loading reset password…</span><div aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 400 }}><Skeleton style={{ width: 140, height: 20 }} /><Skeleton style={{ width: "100%", height: 44, borderRadius: 8 }} /><Skeleton style={{ width: "100%", height: 44, borderRadius: 8 }} /><Skeleton style={{ width: "100%", height: 44, borderRadius: 8 }} /></div></div>}>
                  <ResetPasswordPageLazy />
                </RouteBoundary>
              }
            />
            {/* Single source of truth = docs site. Tanpa ringkasan legal di app. */}
            <Route path="/privacy" element={<ExternalRedirect to={DOCS_PRIVACY_URL} />} />
            <Route path="/terms" element={<ExternalRedirect to={DOCS_TERMS_URL} />} />
            <Route path="/docs" element={<ExternalRedirect to={DOCS_HOME_URL} />} />
            <Route path="/docs/mcp" element={<ExternalRedirect to={DOCS_MCP_URL} />} />
            <Route
              path="/404"
              element={
                <RouteBoundary fallback={<DashboardSkeleton />}>
                  <NotFoundLazy />
                </RouteBoundary>
              }
            />
            <Route path="/*" element={<Root />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </AuthProvider>
  );
}

