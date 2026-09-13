import { Component, type ErrorInfo, type ReactNode } from 'react';
import { i18n } from '../i18n';
import { Button } from './Button';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Nama area untuk konteks per-area (mis. Pricing, Proyek Publik). */
  area?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
  errorId: string | null;
  copied: boolean;
}

function shortErrorId(): string {
  try {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 8)
      .toUpperCase();
  } catch {
    return Math.random().toString(16).slice(2, 10).toUpperCase().padEnd(8, '0');
  }
}

const SUPPORT_EMAIL = 'support@devhub.nrawangbatin.my.id';

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, errorId: null, copied: false };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error, errorId: shortErrorId(), copied: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled render error:', error, info.componentStack);
  }

  private handleCopy = async () => {
    const { error, errorId } = this.state;
    const text = `DevHub error ${errorId ?? '-'}${this.props.area ? ` [${this.props.area}]` : ''}\n${error?.name ?? 'Error'}: ${error?.message ?? 'unknown'}\n${window.location.href}`;
    try {
      await navigator.clipboard.writeText(text);
      this.setState({ copied: true });
      window.setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    const isId = (i18n.resolvedLanguage ?? 'en') === 'id';
    const title = isId ? 'Terjadi kesalahan' : (i18n.t('errorBoundary.title') as string);
    const subtitle = isId
      ? 'Terjadi kesalahan tak terduga saat menampilkan bagian ini. Data Anda aman — coba lagi, atau muat ulang bila berlanjut.'
      : (i18n.t('errorBoundary.subtitle') as string);
    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`DevHub error ${this.state.errorId ?? ''}${this.props.area ? ` [${this.props.area}]` : ''}`)}&body=${encodeURIComponent(`${this.state.error?.name ?? 'Error'}: ${this.state.error?.message ?? ''}\nURL: ${typeof window !== 'undefined' ? window.location.href : ''}`)}`;
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
          className="form-stack error-boundary-card"
          style={{ maxWidth: 460, textAlign: 'center' }}
          role="alert"
          data-testid="error-boundary"
        >
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
          {this.props.area && (
            <p className="error-boundary-area">
              {isId ? 'Area' : 'Area'}: <code>{this.props.area}</code>
            </p>
          )}
          {this.state.errorId && (
            <p className="error-boundary-id">
              ID: <code className="font-mono" title={this.state.error?.message ?? ''}>{this.state.errorId}</code>
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={() => this.setState({ error: null, errorId: null, copied: false })}>
              {i18n.t('action.tryAgain')}
            </Button>
            <Button variant="ghost" onClick={() => window.location.reload()}>
              {i18n.t('action.reload')}
            </Button>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
            <Button variant="secondary" size="sm" onClick={() => void this.handleCopy()}>
              {this.state.copied
                ? (isId ? 'Tersalin' : 'Copied')
                : (isId ? 'Salin info' : 'Copy info')}
            </Button>
            <a className="btn btn-ghost btn-sm" href={mailto}>
              {isId ? 'Lapor via email' : 'Report via email'}
            </a>
          </div>
        </div>
      </div>
    );
  }
}
