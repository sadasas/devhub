import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './Button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
        }}
      >
        <div
          className="form-stack"
          style={{ maxWidth: 420, textAlign: 'center' }}
          role="alert"
          data-testid="error-boundary"
        >
          <h1 className="page-title">Something went wrong</h1>
          <p className="page-subtitle">
            An unexpected error occurred while rendering this page. Your data is safe — try again,
            or reload the app if the problem persists.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <Button variant="primary" onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
            <Button variant="ghost" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
