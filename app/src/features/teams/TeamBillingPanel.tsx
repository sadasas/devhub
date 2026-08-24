import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { BillingStatus } from '../../lib/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Skeleton } from '../../components/Skeleton';
import { InlineError } from '../../components/InlineError';
import { UsageMeter } from '../../components/UsageMeter';

interface TeamBillingPanelProps {
  teamId: string;
  isAdmin: boolean;
}

export function TeamBillingPanel({ teamId, isAdmin }: TeamBillingPanelProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bannerBusy, setBannerBusy] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const status = await api.billingStatus(teamId);
      setData(status);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load usage.'));
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
  const pendingPayment = data?.payments.find((p) => p.status === 'pending') ?? null;

  async function onResumePending() {
    if (!pendingPayment) return;
    setBannerError(null);
    setBannerBusy(true);
    try {
      const res = await api.resumePayment(pendingPayment.orderId);
      window.location.assign(res.url);
    } catch (err) {
      setBannerError(getErrorMessage(err, 'Gagal melanjutkan pembayaran.'));
      setBannerBusy(false);
    }
  }

  async function onCancelPending() {
    if (!pendingPayment) return;
    setBannerError(null);
    setBannerBusy(true);
    try {
      await api.cancelPayment(pendingPayment.orderId);
      setData((prev) =>
        prev
          ? {
              ...prev,
              payments: prev.payments.map((p) =>
                p.orderId === pendingPayment.orderId ? { ...p, status: 'cancelled' } : p,
              ),
            }
          : prev,
      );
    } catch (err) {
      setBannerError(getErrorMessage(err, 'Gagal membatalkan pembayaran.'));
    } finally {
      setBannerBusy(false);
    }
  }

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

  return (
    <section className="tab-panel billing-panel" aria-label="Usage">
      {plan === 'pro' && daysLeft !== null && daysLeft <= 7 && (
        <InlineError>
          Pro ends in {daysLeft <= 0 ? 'less than a day' : `${daysLeft} day${daysLeft === 1 ? '' : 's'}`} —
          renew to keep unlimited capacity.
        </InlineError>
      )}
      {pendingPayment && (
        <div className="billing-card">
          <h3 className="billing-card-title">Pembayaran tertunda</h3>
          <div className="billing-plan-row">
            <span className="billing-plan-name">
              {pendingPayment.packageName} — Rp {pendingPayment.amount.toLocaleString('id-ID')}
            </span>
            <Badge tone="neutral">Pending</Badge>
            <span className="billing-meta">
              {new Date(pendingPayment.createdAt).toLocaleDateString()} · selesaikan atau batalkan
            </span>
          </div>
          {bannerError && <InlineError>{bannerError}</InlineError>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Button
              variant="primary"
              size="sm"
              loading={bannerBusy}
              onClick={() => void onResumePending()}
            >
              Lanjutkan pembayaran
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={bannerBusy}
              onClick={() => void onCancelPending()}
            >
              Batalkan
            </Button>
          </div>
        </div>
      )}
      <div className="billing-card">
        <h3 className="billing-card-title">Current plan</h3>
        <div className="billing-plan-row">
          <span className="billing-plan-name">{data?.team.planPackageName ?? (plan === 'pro' ? 'Pro' : 'Free')}</span>
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
    </section>
  );
}
