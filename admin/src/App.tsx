import { Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AuthProvider, useAuth } from './state/auth-context';
import { AuthPage } from './features/auth/AuthPage';
import { AdminPage } from './features/admin/AdminPage';
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

function AdminGuard() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <AuthPage />;
  if (user.role !== 'admin') {
    return (
      <div className="page" style={{ padding: 32 }}>
        <h1 className="page-title">Forbidden</h1>
        <p className="page-subtitle">Admin access required. Your account ({user.email}) is not an admin.</p>
      </div>
    );
  }
  return <AdminPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AdminGuard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Suspense fallback={null}>
          <div style={{ display: 'none' }} />
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
