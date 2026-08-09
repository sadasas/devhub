import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, TerminalWindow } from '@phosphor-icons/react';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../state/auth-context';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Logo } from '../../components/Logo';

export function AuthPage() {
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
      setError('Passwords do not match.');
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
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
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
          <h1>The memory of your projects.</h1>
          <p>
            Tasks, bugs, tech stack, database schema, ADRs and releases — one local-first hub for
            solo developers.
          </p>
        </div>
        <p className="auth-brand-foot">
          <TerminalWindow size={12} weight="duotone" /> Built for solo devs. Self-hosted. Your data,
          your rules.
        </p>
      </aside>

      <main className="auth-form-wrap">
        <form className="auth-form" onSubmit={onSubmit} noValidate>
          <div>
            <h2 className="auth-form-title">
              {isRegister ? 'Create your account' : 'Sign in to DevHub'}
            </h2>
            <p className="auth-form-sub">
              {isRegister ? 'Takes less than a minute. No credit card.' : 'Welcome back, developer.'}
            </p>
          </div>

          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <Input
            label="Password"
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            helper={isRegister ? 'At least 8 characters.' : undefined}
          />
          {isRegister && (
            <Input
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          )}

          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" loading={submitting} disabled={submitting || !email || !password}>
            {isRegister ? 'Create account' : 'Sign in'}
            {!submitting && <ArrowRight size={14} weight="bold" aria-hidden="true" />}
          </Button>

          <p className="auth-switch">
            {isRegister ? 'Already have an account? ' : 'No account yet? '}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setMode(isRegister ? 'login' : 'register');
                setError(null);
              }}
            >
              {isRegister ? 'Sign in' : 'Create one'}
            </button>
          </p>
        </form>
      </main>
    </div>
  );
}

