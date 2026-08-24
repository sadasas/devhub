import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, TerminalWindow } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import {} from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { useAuth } from '../../state/auth-context';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Logo } from '../../components/Logo';
import { InlineError } from '../../components/InlineError';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';

export function AuthPage() {
  const { t } = useTranslation('account');
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === 'register';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
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
        <div className="auth-lang">
          <LanguageSwitcher />
        </div>
        <form className="auth-form" onSubmit={onSubmit} noValidate>
          <div>
            <h2 className="auth-form-title">
              {isRegister ? t('auth.form.registerTitle') : t('auth.form.loginTitle')}
            </h2>
            <p className="auth-form-sub">
              {isRegister ? t('auth.form.registerSub') : t('auth.form.loginSub')}
            </p>
          </div>

          <Input
            label={t('auth.field.email')}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth.field.emailPlaceholder')}
          />
          <Input
            label={t('auth.field.password')}
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            helper={isRegister ? t('auth.field.passwordRegisterHelper') : undefined}
          />
          {isRegister && (
            <Input
              label={t('auth.field.confirmPassword')}
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          )}

          {error && <InlineError>{error}</InlineError>}

          <Button type="submit" loading={submitting} disabled={submitting || !email || !password}>
            {isRegister ? t('auth.action.createAccount') : t('auth.action.signIn')}
            {!submitting && <ArrowRight size={14} weight="bold" aria-hidden="true" />}
          </Button>

          <p className="auth-switch">
            {isRegister ? t('auth.switchPrompt.hasAccount') : t('auth.switchPrompt.noAccountYet')}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setMode(isRegister ? 'login' : 'register');
                setError(null);
              }}
            >
              {isRegister ? t('auth.action.signIn') : t('auth.action.createOne')}
            </button>
          </p>
        </form>
      </main>
    </div>
  );
}

