import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowSquareOut, Receipt, Trash } from '@phosphor-icons/react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { PaymentHistoryItem } from '../../lib/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { InlineError } from '../../components/InlineError';
import { Skeleton } from '../../components/Skeleton';
import { formatDateAdmin } from '../../lib/format';
import { BillingLedger } from './BillingLedger';

const STATUS_BADGE_KEYS: Record<
  string,
  { tone: 'success' | 'warn' | 'danger' | 'neutral'; key: string; dot: boolean }
> = {
  completed: { tone: 'success', key: 'billing.status.paid', dot: true },
  pending: { tone: 'warn', key: 'billing.status.pending', dot: true },
  cancelled: { tone: 'danger', key: 'billing.status.cancelled', dot: false },
};

export function PaymentHistoryPage() {
  const { t } = useTranslation('extras');
  const navigate = useNavigate();
  const [payments, setPayments] = useState<PaymentHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const latestRequest = useRef(0);
  const rowRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  const load = useCallback(async () => {
    const id = ++latestRequest.current;
    try {
      const res = await api.paymentHistory();
      if (latestRequest.current !== id) return;
      setPayments(res.payments);
      setError(null);
    } catch (err) {
      if (latestRequest.current !== id) return;
      setError(getErrorMessage(err, t('billing.errors.load')));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onResume(orderId: string) {
    setActionError(null);
    setBusyOrderId(orderId);
    try {
      const res = await api.resumePayment(orderId);
      window.location.assign(res.url);
    } catch (err) {
      setActionError(getErrorMessage(err, t('billing.errors.resume')));
      setBusyOrderId(null);
    }
  }

  async function onConfirmCancel() {
    if (!confirmId) return;
    const orderId = confirmId;
    setActionError(null);
    setBusyOrderId(orderId);
    try {
      await api.cancelPayment(orderId);
      setPayments((prev) =>
        prev ? prev.map((p) => (p.orderId === orderId ? { ...p, status: 'cancelled' } : p)) : prev,
      );
      setStatusMsg(t('billing.cancelSuccess', { defaultValue: 'Pembayaran dibatalkan' }));
      setConfirmId(null);
      requestAnimationFrame(() => rowRefs.current.get(orderId)?.focus());
    } catch (err) {
      setActionError(getErrorMessage(err, t('billing.errors.cancel')));
    } finally {
      setBusyOrderId(null);
    }
  }

  const onBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  const confirmPayment = confirmId ? payments?.find((p) => p.orderId === confirmId) ?? null : null;

  const busyConfirm = confirmId != null && busyOrderId === confirmId;

  return (
    <main id="main-content" className="page billing-page" tabIndex={-1}>
      <header className="page-header billing-header">
        <div>
          <button type="button" className="back-btn" onClick={onBack}>
            <ArrowLeft size={14} aria-hidden="true" /> {t('billing.back')}
          </button>
          <h1 className="page-title mt-8">{t('billing.title')}</h1>
          <p className="page-subtitle">{t('billing.subtitle')}</p>
        </div>
        {payments !== null && !error && (
          <span className="page-subtitle billing-count" aria-live="polite">
            {t('billing.count', {
              count: payments.length,
              defaultValue: `${payments.length} pembayaran`,
            })}
          </span>
        )}
      </header>

      <p role="status" aria-live="polite" className="sr-only">
        {payments === null && !error ? t('admin.loading') : statusMsg ? statusMsg : ''}
      </p>

      {error ? (
        <InlineError className="mb-12">
          {error}{' '}
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            {t('admin.retry')}
          </Button>
        </InlineError>
      ) : null}
      {actionError && (
        <div role="alert" className="mb-12">
          <InlineError>{actionError}</InlineError>
        </div>
      )}

      {payments === null && !error ? (
        <BillingLedger aria-busy="true" aria-label={t('billing.title')}>
          <ul role="list" className="billing-list" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <li key={i} className="billing-row" aria-hidden="true" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div className="billing-main" style={{ gap: 6, flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Skeleton style={{ width: 96, height: 15, borderRadius: 4 }} />
                    <Skeleton style={{ width: 56, height: 18, borderRadius: 999 }} />
                  </div>
                  <Skeleton style={{ width: '62%', height: 11, borderRadius: 4 }} />
                  <Skeleton style={{ width: '42%', height: 11, borderRadius: 4 }} />
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, opacity: 0.7 }}>
                  <Skeleton style={{ width: 96, height: 32, borderRadius: 8 }} />
                  <Skeleton style={{ width: 96, height: 32, borderRadius: 8 }} />
                </div>
              </li>
            ))}
          </ul>
        </BillingLedger>
      ) : payments?.length === 0 ? (
        <BillingLedger>
          <div className="billing-empty">
            <div className="billing-empty-icon" aria-hidden="true">
              <Receipt size={22} weight="duotone" />
            </div>
            <h2 className="billing-empty-title">{t('billing.empty.title')}</h2>
            <p className="billing-empty-desc">{t('billing.empty.desc')}</p>
            <Button variant="secondary" size="sm" onClick={() => navigate('/pricing')}>
              {t('pricing.title', { defaultValue: 'Lihat paket' })}
            </Button>
          </div>
        </BillingLedger>
      ) : payments ? (
        <BillingLedger>
          <ul role="list" className="billing-list">
            {payments.map((p) => {
              const badge = STATUS_BADGE_KEYS[p.status] ?? {
                tone: 'neutral' as const,
                key: '',
                dot: false,
              };
              const badgeLabel = badge.key ? t(badge.key) : p.status;
              const busy = busyOrderId === p.orderId;
              const isPending = p.status === 'pending';
              return (
                <BillingLedger.Row
                  key={p.orderId}
                  tabIndex={-1}
                  ref={(el) => {
                    if (el) rowRefs.current.set(p.orderId, el);
                    else rowRefs.current.delete(p.orderId);
                  }}
                  aria-label={`${p.teamName} ${p.packageName} ${badgeLabel} ${formatDateAdmin(p.createdAt)}`}
                >
                  <BillingLedger.Main>
                    <BillingLedger.Head>
                      <BillingLedger.Amount amount={p.amount} />
                      <Badge tone={badge.tone} dot={badge.dot}>
                        {badgeLabel}
                      </Badge>
                    </BillingLedger.Head>
                    <BillingLedger.Meta
                      teamName={p.teamName}
                      packageName={p.packageName}
                      durationDays={p.durationDays}
                      createdAt={p.createdAt}
                      completedAt={p.status === 'completed' ? p.completedAt : null}
                      daysLabel={(c) => t('billing.days', { count: c })}
                      formatDate={formatDateAdmin}
                    />
                  </BillingLedger.Main>
                  {isPending && (
                    <BillingLedger.Actions>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        leftIcon={<Trash size={13} aria-hidden="true" />}
                        aria-label={t('billing.cancelAria', {
                          defaultValue: `Batalkan pembayaran ${p.packageName} order ${p.orderId.slice(0, 8)}`,
                          packageName: p.packageName,
                          orderId: p.orderId,
                        })}
                        onClick={() => setConfirmId(p.orderId)}
                      >
                        {t('billing.cancelPayment')}
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        loading={busy}
                        leftIcon={<ArrowSquareOut size={13} weight="bold" aria-hidden="true" />}
                        aria-label={t('billing.resumeAria', {
                          defaultValue: `Lanjutkan pembayaran ${p.packageName} untuk ${p.teamName}`,
                          packageName: p.packageName,
                          teamName: p.teamName,
                        })}
                        onClick={() => void onResume(p.orderId)}
                      >
                        {t('billing.resume')}
                      </Button>
                    </BillingLedger.Actions>
                  )}
                </BillingLedger.Row>
              );
            })}
          </ul>
        </BillingLedger>
      ) : null}

      <ConfirmDeleteDialog
        open={!!confirmId}
        title={t('billing.cancelTitle', { defaultValue: 'Batalkan pembayaran?' })}
        description={
          confirmPayment
            ? t('billing.cancelDesc', {
                defaultValue: `"${confirmPayment.packageName}" untuk "${confirmPayment.teamName}" · Rp ${confirmPayment.amount.toLocaleString('id-ID')} akan dibatalkan. Link Pakasir akan kadaluarsa.`,
                packageName: confirmPayment.packageName,
                teamName: confirmPayment.teamName,
                amount: confirmPayment.amount.toLocaleString('id-ID'),
              })
            : t('billing.cancelDescFallback', { defaultValue: 'Pembayaran ini akan dibatalkan. Link Pakasir akan kadaluarsa.' })
        }
        confirmLabel={t('billing.confirmCancel', { defaultValue: 'Ya, batalkan' })}
        busy={busyConfirm}
        onConfirm={() => void onConfirmCancel()}
        onClose={() => {
          if (!busyConfirm) setConfirmId(null);
        }}
      />
    </main>
  );
}
