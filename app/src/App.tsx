import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider, useAuth } from './state/auth-context';
import { ProjectsProvider } from './state/projects-context';
import { TeamsProvider } from './state/teams-context';
import { AuthPage } from './features/auth/AuthPage';
import { Layout } from './features/layout/Layout';
import { CommandPalette } from './components/CommandPalette';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { KeysPage } from './features/keys/KeysPage';
import { McpDocsPage } from './features/docs/McpDocsPage';
import { TeamPage } from './features/teams/TeamPage';
import { InvitesPage } from './features/teams/InvitesPage';
import { ProjectPage } from './features/project/ProjectPage';
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
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/project/:projectId" element={<ProjectPage />} />
              <Route path="/team/:teamId" element={<TeamPage />} />
              <Route path="/invites" element={<InvitesPage />} />
              <Route path="/keys" element={<KeysPage />} />
              <Route path="/docs/mcp" element={<McpDocsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
          <CommandPalette />
        </BrowserRouter>
      </ProjectsProvider>
    </TeamsProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
