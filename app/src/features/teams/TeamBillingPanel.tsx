import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { BillingStatus } from '../../lib/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Skeleton } from '../../components/Skeleton';
import { InlineError } from '../../components/InlineError';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { UsageMeter } from '../../components/UsageMeter';

interface TeamBillingPanelProps {
  teamId: string;
  isAdmin: boolean;
}

export function TeamBillingPanel({ teamId, isAdmin }: TeamBillingPanelProps) {
  const { t } = useTranslation('account');
  const navigate = useNavigate();
  const [data, setData] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bannerBusy, setBannerBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerBusyScheduled, setBannerBusyScheduled] = useState(false);
  const [confirmCancelScheduled, setConfirmCancelScheduled] = useState(false);
  const [bannerErrorScheduled, setBannerErrorScheduled] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const status = await api.billingStatus(teamId);
      setData(status);
    } catch (err) {
      setError(getErrorMessage(err, t('teams.billing.loadError')));
    } finally {
      setLoading(false);
    }
  }, [teamId, t]);

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
            {t('common:action.retry')}
          </Button>
        </InlineError>
      </section>
    );
  }

  const plan = data?.team.plan ?? 'free';
  const expires = data?.team.planExpiresAt ?? null;
  const pendingPayment = data?.payments.find((p) => p.status === 'pending') ?? null;
  const pendingPkg = data?.team.pendingPackage ?? null;

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
      setBannerError(getErrorMessage(err, t('teams.billing.cancelError')));
    } finally {
      setBannerBusy(false);
    }
  }

  async function onCancelScheduled() {
    if (!pendingPkg) return;
    setBannerErrorScheduled(null);
    setBannerBusyScheduled(true);
    try {
      await api.cancelScheduled(teamId);
      setData((prev) =>
        prev
          ? {
              ...prev,
              team: { ...prev.team, pendingPackage: null },
            }
          : prev,
      );
    } catch (err) {
      setBannerErrorScheduled(getErrorMessage(err, t('teams.billing.cancelScheduledError', { defaultValue: 'Gagal membatalkan jadwal.' })));
    } finally {
      setBannerBusyScheduled(false);
    }
  }

  let expiryMeta: string;
  if (plan === 'pro') {
    expiryMeta = expires
      ? t('teams.billing.activeUntil', { date: new Date(expires).toLocaleDateString() })
      : t('teams.billing.activeNoExpiry');
  } else {
    expiryMeta = t('teams.billing.freePlan');
  }

  const daysLeft =
    expires !== null && plan === 'pro'
      ? Math.ceil((Date.parse(expires) - Date.now()) / 86_400_000)
      : null;

  return (
    <section className="tab-panel billing-panel" aria-label={t('teams.billing.panelAria')}>
      {plan === 'pro' && daysLeft !== null && daysLeft <= 7 && (
        <InlineError className="billing-warn">
          {t('teams.billing.proEndingSoon', {
            duration:
              daysLeft <= 0
                ? t('teams.billing.lessThanADay')
                : t('teams.billing.days', { count: daysLeft }),
          })}
        </InlineError>
      )}
      {pendingPayment && (
        <>
          <div className="billing-card">
          <h3 className="billing-card-title">{t('teams.billing.pendingTitle')}</h3>
          <div className="billing-plan-row">
            <span className="billing-plan-name">
              {pendingPayment.packageName} — Rp {pendingPayment.amount.toLocaleString('id-ID')}
            </span>
            <Badge tone="neutral">{t('teams.billing.pendingBadge')}</Badge>
            <span className="billing-meta">
              {t('teams.billing.pendingMeta', { date: new Date(pendingPayment.createdAt).toLocaleDateString() })}
            </span>
          </div>
          {bannerError && <InlineError>{bannerError}</InlineError>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/billing/${teamId}?orderId=${pendingPayment.orderId}`)}
            >
              Detail
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={bannerBusy}
              onClick={() => setConfirmCancel(true)}
            >
              {t('teams.billing.cancelPayment')}
            </Button>
          </div>
        </div>
        <ConfirmDeleteDialog
            open={confirmCancel}
            title={t('billing.cancelTitle', { defaultValue: 'Batalkan pembayaran?' })}
            description={pendingPayment ? t('billing.cancelDesc', { defaultValue: '"' + pendingPayment.packageName + '" untuk "' + (data?.team.name ?? '') + '" \u00b7 Rp ' + pendingPayment.amount.toLocaleString('id-ID') + ' akan dibatalkan. Link Pakasir akan kadaluarsa.', packageName: pendingPayment.packageName, teamName: data?.team.name ?? '', amount: pendingPayment.amount.toLocaleString('id-ID') }) : t('billing.cancelDescFallback', { defaultValue: 'Pembayaran ini akan dibatalkan. Link Pakasir akan kadaluarsa.' })}
            confirmLabel={t('billing.confirmCancel', { defaultValue: 'Ya, batalkan' })}
            busy={bannerBusy}
            onConfirm={() => { setConfirmCancel(false); void onCancelPending(); }}
            onClose={() => { if (!bannerBusy) setConfirmCancel(false); }}
          />
        </>
      )}
      {pendingPkg && (
        <>
          <div className="billing-card billing-card--pending" role="status" aria-live="polite">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 className="billing-card-title">{t('teams.billing.scheduledTitle', { defaultValue: 'Downgrade terjadwal' })}</h3>
              <Badge tone="warn" dot>{t('teams.billing.scheduledBadge', { defaultValue: 'Terjadwal' })}</Badge>
              <Badge tone="neutral">{t('teams.billing.scheduledActivate', { defaultValue: 'Aktif {{date}}', date: new Date(pendingPkg.activateAt).toLocaleDateString() })}</Badge>
            </div>
            <div className="billing-plan-row">
              <span className="billing-plan-name">{pendingPkg.name}</span>
              <span className="billing-meta">
                {t('teams.billing.scheduledDesc', { defaultValue: 'Downgrade ke {{name}} terjadwal — akan aktif saat paket saat ini berakhir.', name: pendingPkg.name })} · {pendingPkg.durationDays} {t('teams.billing.scheduledDuration', { defaultValue: '{{count}} hari', count: pendingPkg.durationDays })}
              </span>
            </div>
            <div className="billing-pending-grid">
              <UsageMeter
                label={t('teams.billing.members')}
                used={data!.usage.members.used}
                limit={pendingPkg.maxMembers}
              />
              <UsageMeter
                label={t('teams.billing.projects')}
                used={data!.usage.projects.used}
                limit={pendingPkg.maxProjects}
              />
            </div>
            {bannerErrorScheduled && <InlineError>{bannerErrorScheduled}</InlineError>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <Button
                variant="ghost"
                size="sm"
                disabled={bannerBusyScheduled}
                onClick={() => setConfirmCancelScheduled(true)}
              >
                {t('teams.billing.cancelScheduled', { defaultValue: 'Batalkan jadwal' })}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(`/pricing?teamId=${teamId}`)}
              >
                {t('teams.billing.viewDetail', { defaultValue: 'Lihat detail' })}
              </Button>
            </div>
          </div>
          <ConfirmDeleteDialog
            open={confirmCancelScheduled}
            title={t('teams.billing.cancelScheduledTitle', { defaultValue: 'Batalkan downgrade terjadwal?' })}
            description={t('teams.billing.cancelScheduledDesc', { defaultValue: 'Downgrade ke "{{name}}" tidak akan diaktifkan. Paket saat ini tetap sampai kedaluwarsa.', name: pendingPkg.name })}
            confirmLabel={t('teams.billing.cancelScheduledConfirm', { defaultValue: 'Ya, batalkan' })}
            busy={bannerBusyScheduled}
            onConfirm={() => { setConfirmCancelScheduled(false); void onCancelScheduled(); }}
            onClose={() => { if (!bannerBusyScheduled) setConfirmCancelScheduled(false); }}
          />
        </>
      )}
      <div className="billing-card">
        <h3 className="billing-card-title">{t('teams.billing.currentPlan')}</h3>
        <div className="billing-plan-row">
          <span className="billing-plan-name">{data?.team.planPackageName ?? (plan === 'pro' ? 'Pro' : t('teams.billing.free'))}</span>
          <Badge tone={plan === 'pro' ? 'info' : 'neutral'}>
            {plan === 'pro' ? t('teams.billing.activeBadge') : t('teams.billing.free')}
          </Badge>
          <span className="billing-meta">{expiryMeta}</span>
        </div>

        <div className="usage-meter-list">
          <UsageMeter
            label={t('teams.billing.members')}
            used={data!.usage.members.used}
            limit={data!.usage.members.limit}
          />
          <UsageMeter
            label={t('teams.billing.projects')}
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
                {t('teams.billing.viewPricing')}
              </Button>
            </div>
          ) : (
            <p className="billing-meta" style={{ marginTop: 12 }}>
              {t('teams.billing.contactAdmin')}
            </p>
          ))}
      </div>
    </section>
  );
}
