import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Eye, EyeSlash, TerminalWindow, GithubLogo, GoogleLogo } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { useAuth } from '../../state/auth-context';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Logo } from '../../components/Logo';
import { Skeleton } from '../../components/Skeleton';
import { InlineError } from '../../components/InlineError';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';
import { LegalFooter } from '../../components/LegalFooter';
import { FE_LIMITS } from '../../lib/limits';
import { DOCS_PRIVACY_URL, DOCS_TERMS_URL } from '../../lib/docs-urls';

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

function getPrefilledEmail(): string | null {
  // T9: dari redirect verify sukses (?email=). Validasi format sederhana —
  // URL sampah diabaikan, form tetap normal.
  try {
    const raw = new URLSearchParams(window.location.search).get('email') ?? '';
    const email = raw.trim().toLowerCase();
    if (email.length >= 3 && email.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return email;
    return null;
  } catch {
    return null;
  }
}

export function AuthPage() {
  const { t, i18n } = useTranslation('account');
  const { login, register } = useAuth();
  const navigate = useNavigate();
  // T10: mode awal boleh dari ?mode= (link "salah alamat" dari /check-email).
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(() => {
    try {
      const m = new URLSearchParams(window.location.search).get('mode');
      if (m === 'register' || m === 'forgot') return m;
      return 'login';
    } catch {
      return 'login';
    }
  });
  const [email, setEmail] = useState<string>(() => getPrefilledEmail() ?? '');
  // Banner panduan hanya bila datang dari verify (prefill valid).
  const [justVerified, setJustVerified] = useState<boolean>(() => getPrefilledEmail() !== null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noPassword, setNoPassword] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [resending, setResending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<{ google: boolean; github: boolean }>({ google: false, github: false });
  const [providersKnown, setProvidersKnown] = useState(false);
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
      if (!cancelled) setProvidersKnown(true);
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
    setNoPassword(false);
    setUnverified(false);
    setSuccess(null);
    if (isForgot) {
      if (!email) {
        setError(t('auth.error.generic'));
        return;
      }
      setSubmitting(true);
      try {
        const { api } = await import('../../lib/api');
        await api.forgotPassword(email.trim());
        // T10: sukses → layar cek-email dedicated (bukan banner inline).
        navigate(`/check-email?case=forgot&email=${encodeURIComponent(email.trim())}`);
        return;
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
    // T12: guard min-8 di klien (form noValidate mematikan minLength browser;
    // backend tetap penegak final). Berlaku register saja, bukan login.
    if (isRegister && password.length < 8) {
      setError(
        i18n.resolvedLanguage === 'id'
          ? 'Kata sandi minimal 8 karakter.'
          : 'Password must be at least 8 characters.',
      );
      return;
    }
    if (isRegister && !termsAccepted) {
      setError(
        i18n.resolvedLanguage === 'id'
          ? 'Centang persetujuan Syarat & Privasi untuk lanjut.'
          : 'Please accept the Terms & Privacy to continue.',
      );
      return;
    }
    setSubmitting(true);
    try {
      if (isRegister) {
        // T10 hard gate: tidak auto-login — ke layar cek-email dedicated.
        await register(email.trim(), password);
        navigate(`/check-email?case=register&email=${encodeURIComponent(email.trim())}`);
        return;
      }
      await login(email.trim(), password);
      // Unified auth: if OAuth flow, redirect back to authorize endpoint
      if (returnTo) {
        window.location.href = returnTo;
        return;
      }
    } catch (err) {
      // Pesan NO_PASSWORD BI actionable: akun OAuth tanpa kata sandi.
      if (err instanceof ApiError && err.code === 'NO_PASSWORD') {
        setNoPassword(true);
        setError(
          i18n.resolvedLanguage === 'id'
            ? 'Akun ini memakai login Google/GitHub (belum ada kata sandi). Lanjutkan dengan Google/GitHub di atas, atau atur kata sandi via Profil → Keamanan setelah masuk dengan OAuth.'
            : 'This account uses Google/GitHub login (no password yet). Continue with Google/GitHub above, or set a password via Profile → Security after signing in with OAuth.',
        );
        setSubmitting(false);
        return;
      }
      // T6 hard gate: email belum diverifikasi — pesan jelas + kirim ulang.
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        setUnverified(true);
        setError(
          i18n.resolvedLanguage === 'id'
            ? 'Email belum diverifikasi. Cek inbox (dan spam) untuk link verifikasi, atau kirim ulang di bawah.'
            : 'Email not verified yet. Check your inbox (and spam) for the verification link, or resend it below.',
        );
        setSubmitting(false);
        return;
      }
      setError(getErrorMessage(err, t('auth.error.generic')));
      setSubmitting(false);
    }
  }

  async function onResend() {
    if (!email || resending) return;
    setResending(true);
    try {
      const { api } = await import('../../lib/api');
      await api.resendVerification(email.trim());
      setSuccess(
        t('auth.verify.resent', 'If that email exists and is unverified, a verification link has been sent.'),
      );
    } catch (err) {
      setError(getErrorMessage(err, t('auth.error.generic')));
    } finally {
      setResending(false);
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
          <div className="auth-form-main">
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

          {justVerified && mode === 'login' && (
            <div
              role="status"
              aria-live="polite"
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: 'var(--status-info-soft)',
                color: 'var(--status-info)',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {t(
                'auth.verify.prefillHint',
                'Email verified. Sign in below to get started — your email is already filled in.',
              )}
            </div>
          )}

          {!providersKnown && !isForgot && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }} aria-hidden="true">
              <Skeleton style={{ width: "100%", height: 44, borderRadius: 8 }} />
              <Skeleton style={{ width: "100%", height: 44, borderRadius: 8 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "2px 0" }}>
                <div style={{ flex: 1, height: 1, background: "var(--border-hairline)" }} />
                <Skeleton style={{ width: 24, height: 12 }} />
                <div style={{ flex: 1, height: 1, background: "var(--border-hairline)" }} />
              </div>
            </div>
          )}
          {(oauthProviders.google || oauthProviders.github) && !isForgot && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {oauthProviders.google && (
                  <a
                    href={`/api/v1/auth/google?intent=login${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}`}
                    rel="external"
                    data-external="true"
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-input)', padding: '10px 14px', fontWeight: 600 }}
                  >
                    <GoogleLogo size={18} weight="bold" /> Continue with Google
                  </a>
                )}
                {oauthProviders.github && (
                  <a
                    href={`/api/v1/auth/github?intent=login${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}`}
                    rel="external"
                    data-external="true"
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-input)', padding: '10px 14px', fontWeight: 600 }}
                  >
                    <GithubLogo size={18} weight="fill" /> Continue with GitHub
                  </a>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '2px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>or</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
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
                autoFocus={justVerified && mode === 'login'}
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
                  right: 4,
                  top: 26,
                  width: 44,
                  height: 44,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'grid',
                  placeItems: 'center',
                  padding: 0,
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
                  right: 4,
                  top: 26,
                  width: 44,
                  height: 44,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'grid',
                  placeItems: 'center',
                  padding: 0,
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
            <p style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
              {t('auth.oauth.returnToHint', 'You will be redirected to authorize the external app after sign in.')}
            </p>
          )}

          {error && <InlineError>{error}</InlineError>}
          {noPassword && oauthProviders.google && (
            <p style={{ fontSize: 14, margin: 0 }}>
              {i18n.resolvedLanguage === 'id'
                ? 'Tip: pakai tombol Google/GitHub di atas untuk masuk, lalu buka Profil → Keamanan → Atur kata sandi.'
                : 'Tip: use the Google/GitHub buttons above to sign in, then open Profile → Security → Set password.'}
            </p>
          )}
          {unverified && (
            <p style={{ fontSize: 14, margin: 0 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onResend}
                disabled={resending || !email}
              >
                {resending
                  ? t('auth.verify.resending', 'Sending...')
                  : t('auth.verify.resend', 'Resend verification link')}
              </button>
            </p>
          )}
          {success && (
            <div
              role="status"
              aria-live="polite"
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: 'var(--status-success-soft)',
                color: 'var(--status-success)',
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
            disabled={submitting || !email || (!isForgot && !password) || (isRegister && !termsAccepted) || (isRegister && password.length < 8)}
          >
            {isForgot
              ? t('auth.forgot.submit', 'Send reset link')
              : isRegister
                ? t('auth.action.createAccount')
                : t('auth.action.signIn')}
            {!submitting && <ArrowRight size={14} weight="bold" aria-hidden="true" />}
          </Button>

          {isRegister && !isForgot && (
            <div className="auth-terms">
              <label className="auth-terms-check">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  required
                  aria-required="true"
                />
                <span>
                  {i18n.resolvedLanguage === 'id' ? (
                    <>
                      Saya setuju pada <a href={DOCS_TERMS_URL} target="_blank" rel="noopener">Syarat Layanan</a> dan{' '}
                      <a href={DOCS_PRIVACY_URL} target="_blank" rel="noopener">Kebijakan Privasi</a> DevHub.
                    </>
                  ) : (
                    <>
                      I agree to the DevHub <a href={DOCS_TERMS_URL} target="_blank" rel="noopener">Terms</a> and{' '}
                      <a href={DOCS_PRIVACY_URL} target="_blank" rel="noopener">Privacy Policy</a>.
                    </>
                  )}
                </span>
              </label>
              <p className="auth-terms-disclosure">
                {i18n.resolvedLanguage === 'id' ? (
                  <>
                    Dengan mendaftar, data akun (email) dan konten proyek Anda disimpan untuk menjalankan layanan. Detail di{' '}
                    <a href={DOCS_PRIVACY_URL} target="_blank" rel="noopener">Kebijakan Privasi</a>.
                  </>
                ) : (
                  <>
                    By signing up, your account data (email) and project content are stored to run the service. See the{' '}
                    <a href={DOCS_PRIVACY_URL} target="_blank" rel="noopener">Privacy Policy</a> for details.
                  </>
                )}
              </p>
            </div>
          )}

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
                    setNoPassword(false);
                    setUnverified(false);
                    setJustVerified(false);
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
                    setNoPassword(false);
                    setUnverified(false);
                    setJustVerified(false);
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
                    setNoPassword(false);
                    setUnverified(false);
                    setJustVerified(false);
                  }}
                >
                  {t('auth.action.createOne')}
                </button>
              </>
            )}
          </p>
          </div>
          <LegalFooter compact />
        </form>
      </main>
    </div>
  );
}

