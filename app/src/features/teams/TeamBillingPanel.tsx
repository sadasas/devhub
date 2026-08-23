import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Wallet } from '@phosphor-icons/react';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { BillingPayment, BillingStatus } from '../../lib/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Skeleton } from '../../components/Skeleton';
import { InlineError } from '../../components/InlineError';
import { EmptyState } from '../../components/EmptyState';
import { UsageMeter } from '../../components/UsageMeter';

function formatIdr(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

interface TeamBillingPanelProps {
  teamId: string;
  isAdmin: boolean;
}

export function TeamBillingPanel({ teamId, isAdmin }: TeamBillingPanelProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const status = await api.billingStatus(teamId);
      setData(status);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load billing.'));
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <section className="tab-panel billing-panel" aria-busy="true">
        <Skeleton style={{ width: '100%', height: 96 }} />
        <Skeleton style={{ width: '100%', height: 64 }} />
        <Skeleton style={{ width: '100%', height: 48 }} />
      </section>
    );
  }

  if (error) {
    return (
      <section className="tab-panel billing-panel">
        <InlineError>
          {error}{' '}
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </InlineError>
      </section>
    );
  }

  const plan = data?.team.plan ?? 'free';
  const expires = data?.team.planExpiresAt ?? null;

  let expiryMeta: string;
  if (plan === 'pro') {
    expiryMeta = expires
      ? `Active until ${new Date(expires).toLocaleDateString()}`
      : 'Active — no expiration (operator grant)';
  } else {
    expiryMeta = 'Free plan';
  }

  const daysLeft =
    expires !== null && plan === 'pro'
      ? Math.ceil((Date.parse(expires) - Date.now()) / 86_400_000)
      : null;



  function PaymentRow({ p }: { p: BillingPayment }) {
    return (
      <div className="data-row">
        <div className="data-row-main">
          <span className="data-row-title">
            <span className="row-title-text">{formatIdr(p.amount)}</span>
            <Badge tone={p.status === 'completed' ? 'success' : 'neutral'}>
              {p.status === 'completed' ? 'Paid' : 'Pending'}
            </Badge>
          </span>
          <span className="data-row-meta">
            {p.packageName}
            {p.durationDays ? ` · ${p.durationDays} days` : ''} ·{' '}
            {new Date(p.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    );
  }

  return (
    <section className="tab-panel billing-panel" aria-label="Billing">
      {plan === 'pro' && daysLeft !== null && daysLeft <= 7 && (
        <InlineError>
          Pro ends in {daysLeft <= 0 ? 'less than a day' : `${daysLeft} day${daysLeft === 1 ? '' : 's'}`} —
          renew to keep unlimited capacity.
        </InlineError>
      )}
      <div className="billing-card">
        <h3 className="billing-card-title">Current plan</h3>
        <div className="billing-plan-row">
          <span className="billing-plan-name">{plan === 'pro' ? 'Pro' : 'Free'}</span>
          <Badge tone={plan === 'pro' ? 'info' : 'neutral'}>
            {plan === 'pro' ? 'Active' : 'Free'}
          </Badge>
          <span className="billing-meta">{expiryMeta}</span>
        </div>

        <div className="usage-meter-list">
          <UsageMeter
            label="Members"
            used={data!.usage.members.used}
            limit={data!.usage.members.limit}
          />
          <UsageMeter
            label="Projects"
            used={data!.usage.projects.used}
            limit={data!.usage.projects.limit}
          />
        </div>
        {plan === 'free' &&
          (isAdmin ? (
            <div style={{ marginTop: 16 }}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(`/pricing?teamId=${teamId}`)}
              >
                View Pricing
              </Button>
            </div>
          ) : (
            <p className="billing-meta" style={{ marginTop: 12 }}>
              Contact a team admin to upgrade this workspace.
            </p>
          ))}
      </div>

      <div className="billing-card">
        <h3 className="billing-card-title">Payment history</h3>
        {(data?.payments.length ?? 0) === 0 ? (
          <EmptyState
            icon={<Wallet size={20} />}
            title="No payments yet"
            description="Completed payments for this workspace will appear here."
          />
        ) : (
          data!.payments.map((p) => <PaymentRow key={p.orderId} p={p} />)
        )}
      </div>
    </section>
  );
}


