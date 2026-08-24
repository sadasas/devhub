import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle, Warning } from '@phosphor-icons/react';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { BillingStatus } from '../../lib/types';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { Skeleton } from '../../components/Skeleton';

const POLL_MS = 5_000;

export function BillingRedirectPage() {
  const { t } = useTranslation('account');
  const { teamId = '' } = useParams<{ teamId: string }>();
  const [data, setData] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const status = await api.billingStatus(teamId);
      setData(status);
      setError(null);
      return status;
    } catch (err) {
      setError(getErrorMessage(err, t('teams.payment.loadError')));
      return null;
    }
  }, [teamId, t]);

  useEffect(() => {
    void load();
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, [load]);

  // Poll selama masih ada pembayaran pending; berhenti saat pro aktif.
  useEffect(() => {
    if (!data) return;
    const hasPending = data.payments.some((p) => p.status === 'pending');
    if (!hasPending || data.team.plan === 'pro') {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    if (timerRef.current === null) {
      timerRef.current = window.setInterval(() => void load(), POLL_MS);
    }
  }, [data, load]);

  const paid = data?.payments.find((p) => p.status === 'completed');

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{t('teams.payment.title')}</h1>
          <p className="page-subtitle">{data?.team.name ?? t('teams.payment.checking')}</p>
        </div>
      </header>

      {error && <InlineError>{error}</InlineError>}

      {!data && !error && (
        <>
          <Skeleton style={{ width: '100%', height: 72 }} />
          <Skeleton style={{ width: '100%', height: 48, marginTop: 8 }} />
        </>
      )}

      {data && data.team.plan === 'pro' && (
        <section className="billing-card" role="status">
          <div className="billing-plan-row">
            <CheckCircle size={22} weight="duotone" aria-hidden="true" />
            <span className="billing-plan-name">{t('teams.payment.proActive')}</span>
          </div>
          <p className="billing-meta">
            {data.team.planExpiresAt
              ? t('teams.payment.unlimitedUntil', { date: new Date(data.team.planExpiresAt).toLocaleDateString() })
              : t('teams.payment.unlimited')}
          </p>
          {paid && (
            <p className="billing-meta">
              {t('teams.payment.lastPayment', {
                amount: paid.amount.toLocaleString('id-ID'),
                date: paid.completedAt ? new Date(paid.completedAt).toLocaleDateString() : '',
              })}
            </p>
          )}
          <Button
            variant="primary"
            onClick={() => (window.location.href = `/team/${teamId}?tab=usage`)}
          >
            {t('teams.payment.back')}
          </Button>
        </section>
      )}

      {data && data.team.plan !== 'pro' && (
        <section className="billing-card" role="status" aria-busy="true">
          <div className="billing-plan-row">
            <Warning size={20} weight="duotone" aria-hidden="true" />
            <span className="billing-plan-name">{t('teams.payment.waiting')}</span>
          </div>
          <p className="billing-meta">
            {t('teams.payment.instructions')}
          </p>
          {data.payments.some((p) => p.status === 'pending') && (
            <p className="billing-meta">{t('teams.payment.orderCreated', { time: new Date().toLocaleTimeString() })}</p>
          )}
            <Link className="back-btn" to={`/team/${teamId}?tab=usage`}>
            {t('teams.payment.back')}
          </Link>
        </section>
      )}
    </div>
  );
}
