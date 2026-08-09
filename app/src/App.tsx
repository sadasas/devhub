import { AuthProvider, useAuth } from './state/auth-context';
import { NavigationProvider } from './state/navigation-context';
import { ProjectsProvider } from './state/projects-context';
import { AuthPage } from './features/auth/AuthPage';
import { Layout } from './features/layout/Layout';
import { CommandPalette } from './components/CommandPalette';
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
    <NavigationProvider>
      <ProjectsProvider>
        <Layout />
        <CommandPalette />
      </ProjectsProvider>
    </NavigationProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
