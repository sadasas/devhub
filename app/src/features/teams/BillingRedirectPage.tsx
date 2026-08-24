import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle, Warning } from '@phosphor-icons/react';
import { Link, useParams } from 'react-router';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { BillingStatus } from '../../lib/types';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { Skeleton } from '../../components/Skeleton';

const POLL_MS = 5_000;

export function BillingRedirectPage() {
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
      setError(getErrorMessage(err, 'Failed to load payment status.'));
      return null;
    }
  }, [teamId]);

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
          <h1 className="page-title">Payment status</h1>
          <p className="page-subtitle">{data?.team.name ?? 'Checking your payment…'}</p>
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
            <span className="billing-plan-name">Pro is active</span>
          </div>
          <p className="billing-meta">
            {data.team.planExpiresAt
              ? `Unlimited members & projects until ${new Date(data.team.planExpiresAt).toLocaleDateString()}.`
              : 'Unlimited members & projects.'}
          </p>
          {paid && (
            <p className="billing-meta">
              Last payment: Rp {paid.amount.toLocaleString('id-ID')} ·{' '}
              {paid.completedAt ? new Date(paid.completedAt).toLocaleDateString() : ''}
            </p>
          )}
          <Button
            variant="primary"
            onClick={() => (window.location.href = `/team/${teamId}?tab=usage`)}
          >
            Back to workspace
          </Button>
        </section>
      )}

      {data && data.team.plan !== 'pro' && (
        <section className="billing-card" role="status" aria-busy="true">
          <div className="billing-plan-row">
            <Warning size={20} weight="duotone" aria-hidden="true" />
            <span className="billing-plan-name">Waiting for payment confirmation</span>
          </div>
          <p className="billing-meta">
            Complete the payment via QRIS / Virtual Account. This page checks automatically — you
            can also come back later from the workspace Billing tab.
          </p>
          {data.payments.some((p) => p.status === 'pending') && (
            <p className="billing-meta">Order created {new Date().toLocaleTimeString()}</p>
          )}
            <Link className="back-btn" to={`/team/${teamId}?tab=usage`}>
            Back to workspace
          </Link>
        </section>
      )}
    </div>
  );
}
