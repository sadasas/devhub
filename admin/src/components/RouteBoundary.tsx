import { Suspense, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { ErrorBoundary } from './ErrorBoundary';

interface RouteBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

export function RouteBoundary({ fallback, children }: RouteBoundaryProps) {
  const location = useLocation();
  return (
    <ErrorBoundary key={location.pathname}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </ErrorBoundary>
  );
}
