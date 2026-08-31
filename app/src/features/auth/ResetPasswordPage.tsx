import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, Eye, EyeSlash } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { InlineError } from '../../components/InlineError';
import { Logo } from '../../components/Logo';

export function ResetPasswordPage() {
  const { t } = useTranslation('account');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t('auth.error.passwordMismatch'));
      return;
    }
    if (password.length < 8) {
      setError(t('auth.error.generic'));
      return;
    }
    setSubmitting(true);
    try {
      await api.resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => navigate('/', { replace: true }), 2000);
    } catch (err) {
      setError(getErrorMessage(err, t('auth.error.generic')));
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="auth">
        <main className="auth-form-wrap" style={{ maxWidth: 480, margin: '0 auto', paddingTop: 80 }}>
          <InlineError>Invalid reset link — missing token.</InlineError>
          <Button onClick={() => navigate('/')}>Back to login</Button>
        </main>
      </div>
    );
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
          <p>{t('auth.brand.subtitle')}</p>
        </div>
      </aside>
      <main className="auth-form-wrap">
        <form className="auth-form" onSubmit={onSubmit} noValidate>
          <div>
            <h2 className="auth-form-title">{t('auth.forgot.resetTitle', 'Set new password')}</h2>
            <p className="auth-form-sub">{t('auth.forgot.resetSub', 'Choose a new password for your account.')}</p>
          </div>

          <div style={{ position: 'relative' }}>
            <Input
              label={t('auth.field.password')}
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              helper={t('auth.field.passwordRegisterHelper')}
            />
            <button
              type="button"
              aria-label={show ? 'Hide' : 'Show'}
              onClick={() => setShow((v) => !v)}
              style={{
                position: 'absolute',
                right: 12,
                top: 34,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--muted)',
                display: 'flex',
              }}
            >
              {show ? <EyeSlash size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <Input
            label={t('auth.field.confirmPassword')}
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />

          {error && <InlineError>{error}</InlineError>}
          {success && (
            <div role="status" style={{ padding: 10, borderRadius: 8, background: '#dcfce7', color: '#14532d', fontSize: 13 }}>
              {t('auth.forgot.resetSuccess', 'Password updated — redirecting to login...')}
            </div>
          )}

          <Button type="submit" loading={submitting} disabled={submitting || !password || !confirm || success}>
            {t('auth.forgot.resetSubmit', 'Update password')}
            {!submitting && <ArrowRight size={14} weight="bold" aria-hidden="true" />}
          </Button>
        </form>
      </main>
    </div>
  );
}
