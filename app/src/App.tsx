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
  ProfileSkeleton,
  ProjectSkeleton,
  PublicProjectSkeleton,
  TeamSkeleton,
  TemplatesSkeleton,
} from './components/PageSkeletons';
import { Skeleton } from './components/Skeleton';

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
                <Suspense fallback={<DashboardSkeleton />}>
                  <DashboardPageLazy />
                </Suspense>
              }
            />
            <Route
              path="/project/:projectId"
              element={
                <Suspense fallback={<ProjectSkeleton />}>
                  <ProjectPageLazy />
                </Suspense>
              }
            />
            <Route
              path="/team/:teamId"
              element={
                <Suspense fallback={<TeamSkeleton />}>
                  <TeamPageLazy />
                </Suspense>
              }
            />
            <Route
              path="/invites"
              element={
                <Suspense fallback={<InvitesSkeleton />}>
                  <InvitesPageLazy />
                </Suspense>
              }
            />
            <Route
              path="/keys"
              element={
                <Suspense fallback={<KeysSkeleton />}>
                  <KeysPageLazy />
                </Suspense>
              }
            />
            <Route
              path="/templates"
              element={
                <Suspense fallback={<TemplatesSkeleton />}>
                  <TemplatesPageLazy />
                </Suspense>
              }
            />
            <Route
              path="/profile"
              element={
                <Suspense fallback={<ProfileSkeleton />}>
                  <ProfilePageLazy />
                </Suspense>
              }
            />
            <Route
              path="/docs"
              element={
                <Suspense fallback={<DocsSkeleton />}>
                  <DocsPageLazy />
                </Suspense>
              }
            />
            <Route
              path="/docs/mcp"
              element={
                <Suspense fallback={<McpDocsSkeleton />}>
                  <McpDocsPageLazy />
                </Suspense>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <Suspense fallback={null}>
          <CommandPaletteLazy />
        </Suspense>
      </ProjectsProvider>
    </TeamsProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/p/:projectId"
            element={
              <Suspense fallback={<PublicProjectSkeleton />}>
                <PublicProjectPageLazy />
              </Suspense>
            }
          />
          <Route path="/*" element={<Root />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}