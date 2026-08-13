import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider, useAuth } from './state/auth-context';
import { ProjectsProvider } from './state/projects-context';
import { TeamsProvider } from './state/teams-context';
import { AuthPage } from './features/auth/AuthPage';
import { Layout } from './features/layout/Layout';
import { CommandPalette } from './components/CommandPalette';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { KeysPage } from './features/keys/KeysPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { DocsPage } from './features/docs/DocsPage';
import { McpDocsPage } from './features/docs/McpDocsPage';
import { TeamPage } from './features/teams/TeamPage';
import { InvitesPage } from './features/teams/InvitesPage';
import { TemplatesPage } from './features/templates/TemplatesPage';
import { ProjectPage } from './features/project/ProjectPage';
import { PublicProjectPage } from './features/public/PublicProjectPage';
import { Skeleton } from './components/Skeleton';

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
            <Route path="/" element={<DashboardPage />} />
            <Route path="/project/:projectId" element={<ProjectPage />} />
            <Route path="/team/:teamId" element={<TeamPage />} />
            <Route path="/invites" element={<InvitesPage />} />
            <Route path="/keys" element={<KeysPage />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/docs/mcp" element={<McpDocsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <CommandPalette />
      </ProjectsProvider>
    </TeamsProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/p/:projectId" element={<PublicProjectPage />} />
          <Route path="/*" element={<Root />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
