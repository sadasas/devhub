import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, Eye, EyeSlash, TerminalWindow, GithubLogo, GoogleLogo } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../lib/errors';
import { API_BASE } from '../../lib/api';
import { useAuth } from '../../state/auth-context';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Logo } from '../../components/Logo';
import { InlineError } from '../../components/InlineError';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';
import { FE_LIMITS } from '../../lib/limits';

function getReturnTo(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const rt = params.get('returnTo');
    // Only allow OAuth authorize URLs on our backend
    if (rt && rt.startsWith('http://localhost:3000/oauth/authorize')) return rt;
    if (rt && rt.startsWith('https://')) return rt;
    return null;
  } catch {
    return null;
  }
}

function getOAuthError(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('oauth_error');
    const provider = params.get('provider');
    if (err) return provider ? `${provider}: ${err}` : err;
    return null;
  } catch {
    return null;
  }
}

export function AuthPage() {
  const { t } = useTranslation('account');
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<{ google: boolean; github: boolean }>({ google: false, github: false });
  const [oauthError] = useState<string | null>(() => getOAuthError());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { api } = await import('../../lib/api');
        const data = await api.getProviders().catch(() => null);
        if (!cancelled && data) setOauthProviders({ google: Boolean(data.google), github: Boolean(data.github) });
      } catch {
        // ignore, public endpoint may be unreachable
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isRegister = mode === 'register';
  const isForgot = mode === 'forgot';
  const returnTo = getReturnTo();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (isForgot) {
      if (!email) {
        setError(t('auth.error.generic'));
        return;
      }
      setSubmitting(true);
      try {
        const { api } = await import('../../lib/api');
        const res = await api.forgotPassword(email.trim());
        // In dev, token is returned for testing
        const hint = (res as { token?: string }).token
          ? ` (dev token: ${(res as { token: string }).token.slice(0, 20)}...)`
          : '';
        setSuccess(t('auth.forgot.success', 'If that email exists, a reset link has been sent.') + hint);
        setSubmitting(false);
      } catch (err) {
        setError(getErrorMessage(err, t('auth.error.generic')));
        setSubmitting(false);
      }
      return;
    }
    if (isRegister && password !== confirm) {
      setError(t('auth.error.passwordMismatch'));
      return;
    }
    setSubmitting(true);
    try {
      if (isRegister) {
        await register(email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      // Unified auth: if OAuth flow, redirect back to authorize endpoint
      if (returnTo) {
        window.location.href = returnTo;
        return;
      }
    } catch (err) {
      setError(getErrorMessage(err, t('auth.error.generic')));
      setSubmitting(false);
    }
  }

  return (
    <div className="auth">
      <aside className="auth-brand">
        <div className="auth-brand-mark">
          <Logo size={20} />
          <span>DevHub</span>
        </div>
<div className="auth-brand-copy">
          <h1>{t('auth.brand.title')}</h1>
          <p>
            {t('auth.brand.subtitle')}
          </p>
        </div>
        <p className="auth-brand-foot">
          <TerminalWindow size={12} weight="duotone" /> {t('auth.brand.footer')}
        </p>
      </aside>

      <main className="auth-form-wrap">
        <div className="auth-prefs">
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
        <form className="auth-form" onSubmit={onSubmit} noValidate>
          <div>
            <h2 className="auth-form-title">
              {isForgot
                ? t('auth.forgot.title', 'Reset your password')
                : isRegister
                  ? t('auth.form.registerTitle')
                  : t('auth.form.loginTitle')}
            </h2>
            <p className="auth-form-sub">
              {isForgot
                ? t('auth.forgot.subtitle', 'Enter your email and we will send a reset link.')
                : isRegister
                  ? t('auth.form.registerSub')
                  : t('auth.form.loginSub')}
            </p>
          </div>

          {(oauthProviders.google || oauthProviders.github) && !isForgot && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {oauthProviders.google && (
                  <a
                    href={`${API_BASE}/auth/google?intent=login${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}`}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontWeight: 600 }}
                  >
                    <GoogleLogo size={18} weight="bold" /> Continue with Google
                  </a>
                )}
                {oauthProviders.github && (
                  <a
                    href={`${API_BASE}/auth/github?intent=login${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}`}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontWeight: 600 }}
                  >
                    <GithubLogo size={18} weight="fill" /> Continue with GitHub
                  </a>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '2px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>or</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
            </>
          )}
          {oauthError && !error && <InlineError>{oauthError}</InlineError>}

          <Input
            label={t('auth.field.email')}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth.field.emailPlaceholder')}
            maxLength={FE_LIMITS.EMAIL}
          />
          {!isForgot && (
            <div style={{ position: 'relative' }}>
              <Input
                label={t('auth.field.password')}
                type={showPassword ? 'text' : 'password'}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
                minLength={8}
                maxLength={FE_LIMITS.PASSWORD}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                helper={isRegister ? t('auth.field.passwordRegisterHelper') : undefined}
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: 34,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>
          )}
          {isRegister && (
            <div style={{ position: 'relative' }}>
              <Input
                label={t('auth.field.confirmPassword')}
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                maxLength={FE_LIMITS.PASSWORD}
              />
              <button
                type="button"
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
                onClick={() => setShowConfirm((v) => !v)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: 34,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showConfirm ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>
          )}
          {!isForgot && !isRegister && (
            <div style={{ textAlign: 'right', marginTop: -8 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setMode('forgot');
                  setError(null);
                  setSuccess(null);
                }}
                style={{ fontSize: 13, padding: '4px 8px' }}
              >
                {t('auth.forgot.link', 'Forgot password?')}
              </button>
            </div>
          )}
          {returnTo && !isForgot && (
            <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', margin: 0 }}>
              {t('auth.oauth.returnToHint', 'You will be redirected to authorize the external app after sign in.')}
            </p>
          )}

          {error && <InlineError>{error}</InlineError>}
          {success && (
            <div
              role="status"
              aria-live="polite"
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: 'var(--success-bg, #dcfce7)',
                color: 'var(--success-fg, #14532d)',
                fontSize: 13,
                lineHeight: 1.5,
                wordBreak: 'break-all',
              }}
            >
              {success}
            </div>
          )}

          <Button
            type="submit"
            loading={submitting}
            disabled={submitting || !email || (!isForgot && !password)}
          >
            {isForgot
              ? t('auth.forgot.submit', 'Send reset link')
              : isRegister
                ? t('auth.action.createAccount')
                : t('auth.action.signIn')}
            {!submitting && <ArrowRight size={14} weight="bold" aria-hidden="true" />}
          </Button>

          <p className="auth-switch">
            {isForgot ? (
              <>
                {t('auth.forgot.back', 'Remembered?')}{' '}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                    setSuccess(null);
                  }}
                >
                  {t('auth.action.signIn')}
                </button>
              </>
            ) : isRegister ? (
              <>
                {t('auth.switchPrompt.hasAccount')}{' '}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                >
                  {t('auth.action.signIn')}
                </button>
              </>
            ) : (
              <>
                {t('auth.switchPrompt.noAccountYet')}{' '}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                >
                  {t('auth.action.createOne')}
                </button>
              </>
            )}
          </p>
        </form>
      </main>
    </div>
  );
}

