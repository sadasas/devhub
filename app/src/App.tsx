import { useEffect, useState } from 'react';
import { SignOut, TerminalWindow } from '@phosphor-icons/react';
import { ApiError, api } from './lib/api';
import type { Project } from './lib/types';
import { AuthProvider, useAuth } from './state/auth-context';
import { AuthPage } from './features/auth/AuthPage';
import { Badge } from './components/Badge';
import { Button } from './components/Button';
import { EmptyState } from './components/EmptyState';
import { Logo } from './components/Logo';
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

function Shell() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listProjects()
      .then((list) => {
        if (!cancelled) setProjects(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load projects');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="shell">
      <header className="shell-header">
        <div className="shell-brand">
          <Logo size={18} />
          <span>DevHub</span>
        </div>
        <div className="shell-user">
          <span className="font-mono text-secondary">{user?.email}</span>
          <Button variant="ghost" size="sm" leftIcon={<SignOut size={14} />} onClick={() => void logout()}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="shell-main">
        <h1>Projects</h1>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        {projects === null ? (
          <div className="shell-list">
            {[0, 1, 2].map((i) => (
              <div key={i} className="shell-row">
                <Skeleton style={{ width: 220, height: 16 }} />
                <Skeleton style={{ width: 60, height: 16 }} />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div style={{ marginTop: 16 }}>
            <EmptyState
              icon={<TerminalWindow size={22} />}
              title="No projects yet"
              description="Create your first project to start tracking tasks, issues and your tech stack."
            />
          </div>
        ) : (
          <ul className="shell-list">
            {projects.map((p) => (
              <li key={p.id} className="shell-row">
                <span>{p.name}</span>
                <Badge tone={p.status === 'active' ? 'success' : 'neutral'}>{p.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function Root() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <AuthPage />;
  return <Shell />;
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}

