import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider, useAuth } from './state/auth-context';
import { ProjectsProvider } from './state/projects-context';
import { TeamsProvider } from './state/teams-context';
import { AuthPage } from './features/auth/AuthPage';
import { Layout } from './features/layout/Layout';
import {
  DashboardSkeleton,
  DocsSkeleton,
  InvitesSkeleton,
  KeysSkeleton,
  McpDocsSkeleton,
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

const DashboardPageLazy = lazy(() => import('./features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const KeysPageLazy = lazy(() => import('./features/keys/KeysPage').then((m) => ({ default: m.KeysPage })));
const ProfilePageLazy = lazy(() => import('./features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const DocsPageLazy = lazy(() => import('./features/docs/DocsPage').then((m) => ({ default: m.DocsPage })));
const McpDocsPageLazy = lazy(() => import('./features/docs/McpDocsPage').then((m) => ({ default: m.McpDocsPage })));
const TeamPageLazy = lazy(() => import('./features/teams/TeamPage').then((m) => ({ default: m.TeamPage })));
const InvitesPageLazy = lazy(() => import('./features/teams/InvitesPage').then((m) => ({ default: m.InvitesPage })));
const TemplatesPageLazy = lazy(() => import('./features/templates/TemplatesPage').then((m) => ({ default: m.TemplatesPage })));
const ProjectPageLazy = lazy(() => import('./features/project/ProjectPage').then((m) => ({ default: m.ProjectPage })));
const PublicProjectPageLazy = lazy(() => import('./features/public/PublicProjectPage').then((m) => ({ default: m.PublicProjectPage })));
const PricingPageLazy = lazy(() => import('./features/pricing/PricingPage').then((m) => ({ default: m.PricingPage })));
const PaymentHistoryPageLazy = lazy(() => import('./features/billing/PaymentHistoryPage').then((m) => ({ default: m.PaymentHistoryPage })));
const BillingRedirectPageLazy = lazy(() => import('./features/teams/BillingRedirectPage').then((m) => ({ default: m.BillingRedirectPage })));
const ResetPasswordPageLazy = lazy(() => import('./features/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const CommandPaletteLazy = lazy(() => import('./components/CommandPalette').then((m) => ({ default: m.CommandPalette })));



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
        <Routes>
          <Route element={<Layout />}>
            <Route
              path="/"
              element={
                <RouteBoundary fallback={<DashboardSkeleton />}>
                  <DashboardPageLazy />
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
            <Route
              path="/team/:teamId"
              element={
                <RouteBoundary fallback={<TeamSkeleton />}>
                  <TeamPageLazy />
                </RouteBoundary>
              }
            />
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
              path="/docs"
              element={
                <RouteBoundary fallback={<DocsSkeleton />}>
                  <DocsPageLazy />
                </RouteBoundary>
              }
            />
            <Route
              path="/docs/mcp"
              element={
                <RouteBoundary fallback={<McpDocsSkeleton />}>
                  <McpDocsPageLazy />
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <CommandPaletteLazy />
          </Suspense>
        </ErrorBoundary>
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
                <RouteBoundary fallback={<TeamSkeleton />}>
                  <BillingRedirectPageLazy />
                </RouteBoundary>
              }
            />
            <Route
              path="/reset-password"
              element={
                <RouteBoundary fallback={<div role="status" aria-label="Loading reset password" aria-busy="true" style={{ padding: 24 }}><span className="sr-only">Loading reset password…</span><div aria-hidden="true"><Skeleton style={{ width: '100%', height: 200, borderRadius: 12 }} /></div></div>}>
                  <ResetPasswordPageLazy />
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

