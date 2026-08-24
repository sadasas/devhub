import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider, useAuth } from './state/auth-context';
import { ProjectsProvider } from './state/projects-context';
import { TeamsProvider } from './state/teams-context';
import { AuthPage } from './features/auth/AuthPage';
import { Layout } from './features/layout/Layout';
import {
  AdminSkeleton,
  DashboardSkeleton,
  DocsSkeleton,
  InvitesSkeleton,
  KeysSkeleton,
  McpDocsSkeleton,
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

const DashboardPageLazy = lazy(() => import('./features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const KeysPageLazy = lazy(() => import('./features/keys/KeysPage').then((m) => ({ default: m.KeysPage })));
const ProfilePageLazy = lazy(() => import('./features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const DocsPageLazy = lazy(() => import('./features/docs/DocsPage').then((m) => ({ default: m.DocsPage })));
const McpDocsPageLazy = lazy(() => import('./features/docs/McpDocsPage').then((m) => ({ default: m.McpDocsPage })));
const TeamPageLazy = lazy(() => import('./features/teams/TeamPage').then((m) => ({ default: m.TeamPage })));
const InvitesPageLazy = lazy(() => import('./features/teams/InvitesPage').then((m) => ({ default: m.InvitesPage })));
const TemplatesPageLazy = lazy(() => import('./features/templates/TemplatesPage').then((m) => ({ default: m.TemplatesPage })));
const AdminPageLazy = lazy(() => import('./features/admin/AdminPage').then((m) => ({ default: m.AdminPage })));
const ProjectPageLazy = lazy(() => import('./features/project/ProjectPage').then((m) => ({ default: m.ProjectPage })));
const PublicProjectPageLazy = lazy(() => import('./features/public/PublicProjectPage').then((m) => ({ default: m.PublicProjectPage })));
const PricingPageLazy = lazy(() => import('./features/pricing/PricingPage').then((m) => ({ default: m.PricingPage })));
const PaymentHistoryPageLazy = lazy(() => import('./features/billing/PaymentHistoryPage').then((m) => ({ default: m.PaymentHistoryPage })));
const BillingRedirectPageLazy = lazy(() => import('./features/teams/BillingRedirectPage').then((m) => ({ default: m.BillingRedirectPage })));
const CommandPaletteLazy = lazy(() => import('./components/CommandPalette').then((m) => ({ default: m.CommandPalette })));

function Splash() {
  return (
    <div style={{ minHeight: '100dvh', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton style={{ width: 180, height: 28 }} />
      <Skeleton style={{ width: '100%', height: 220 }} />
      <Skeleton style={{ width: '100%', height: 220 }} />
    </div>
  );
}

function Root() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <AuthPage />;
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
              path="/keys"
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
              path="/admin"
              element={
                <RouteBoundary fallback={<AdminSkeleton />}>
                  <AdminPageLazy />
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
                <RouteBoundary fallback={<PricingSkeleton />}>
                  <PaymentHistoryPageLazy />
                </RouteBoundary>
              }
            />
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
            <Route path="/*" element={<Root />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </AuthProvider>
  );
}