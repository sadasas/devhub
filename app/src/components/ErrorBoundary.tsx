import { Component, type ErrorInfo, type ReactNode } from 'react';
import { i18n } from '../i18n';
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
          <h1 className="page-title">{i18n.t('errorBoundary.title')}</h1>
          <p className="page-subtitle">
            {i18n.t('errorBoundary.subtitle')}
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <Button variant="primary" onClick={() => this.setState({ error: null })}>
              {i18n.t('action.tryAgain')}
            </Button>
            <Button variant="ghost" onClick={() => window.location.reload()}>
              {i18n.t('action.reload')}
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
