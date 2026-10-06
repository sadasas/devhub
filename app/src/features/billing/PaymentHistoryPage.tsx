import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowSquareOut, Eye, X } from '@phosphor-icons/react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { PaymentHistoryItem } from '../../lib/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { DataErrorState } from '../../components/DataErrorState';
import { DoodleIllustration } from '../../components/DoodleIllustration';
import { Skeleton } from '../../components/Skeleton';
import { StatusBanner } from '../../components/StatusBanner';
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
  const { t, i18n } = useTranslation('extras');
  const locale = i18n.language === 'id' ? 'id-ID' : 'en-US';
  const navigate = useNavigate();
  const [payments, setPayments] = useState<PaymentHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadErrorRaw, setLoadErrorRaw] = useState<unknown>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [resumeBusyId, setResumeBusyId] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
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
      setLoadErrorRaw(null);
    } catch (err) {
      if (latestRequest.current !== id) return;
      setError(getErrorMessage(err, t('billing.errors.load')));
      setLoadErrorRaw(err);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

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
      setStatusMsg(t('billing.cancelSuccess'));
      setConfirmId(null);
      requestAnimationFrame(() => rowRefs.current.get(orderId)?.focus());
    } catch (err) {
      setActionError(getErrorMessage(err, t('billing.errors.cancel')));
    } finally {
      setBusyOrderId(null);
    }
  }

  const confirmPayment = confirmId ? payments?.find((p) => p.orderId === confirmId) ?? null : null;

  const busyConfirm = confirmId != null && busyOrderId === confirmId;

  async function onResume(orderId: string) {
    setResumeError(null);
    setResumeBusyId(orderId);
    try {
      const res = await api.resumePayment(orderId);
      window.location.assign(res.url);
    } catch (err) {
      setResumeError(getErrorMessage(err, t('billing.errors.resume')));
    } finally {
      setResumeBusyId(null);
    }
  }

  /* Opsi E: pembayaran pending terbaru diangkat jadi hero; sisanya jadi riwayat. */
  const heroPending =
    payments
      ?.filter((p) => p.status === 'pending')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  const heroBusy = heroPending != null && busyOrderId === heroPending.orderId;
  /* Wireframe E: hero tidak diduplikasi di daftar riwayat. */
  const historyPayments = heroPending
    ? (payments ?? []).filter((p) => p.orderId !== heroPending.orderId)
    : (payments ?? []);
  const hasCancelled = (payments ?? []).some((p) => p.status === 'cancelled');

  return (
    <div className="page billing-page">
      {/* Flat content card wraps page content; dialog stays a sibling portal target. */}
      <article className="pcard">
        <div className="pcard-body">
          <div className="narrow-center">
      <header className="page-header billing-header">
        <div>
          <h1 className="page-title mt-8">{t('billing.title')}</h1>
        </div>
        {payments !== null && !error && (
          <span className="page-subtitle billing-count" aria-live="polite">
            {t('billing.count', {
              count: payments.length,
            })}
          </span>
        )}
      </header>

      <p role="status" aria-live="polite" className="sr-only">
        {payments === null && !error ? t('billing.loading') : statusMsg ? statusMsg : ''}
      </p>

      {error ? (
        <DataErrorState error={loadErrorRaw ?? error} onRetry={() => void load()} retryLabel={t('common:action.retry')} />
      ) : null}

      {heroPending && !error ? (
        <section
          className="billing-hero"
          aria-label={t('billing.rowLabel', {
            teamName: heroPending.teamName,
            packageName: heroPending.packageName,
            status: t('billing.status.pending'),
            date: formatDateAdmin(heroPending.createdAt, locale),
          })}
        >
          <div className="billing-hero-top">
            <div className="billing-hero-left">
              <p className="billing-hero-eyebrow">
                {t('billing.heroEyebrow', { id: heroPending.orderId.slice(0, 8) })}
              </p>
              <p className="billing-hero-name">
                {heroPending.packageName} — {heroPending.teamName}
                {heroPending.durationDays != null
                  ? ` · ${t('billing.days', { count: heroPending.durationDays })}`
                  : ''}
              </p>
              <p className="billing-hero-sub">
                {t('billing.heroCreatedOrder', {
                  date: formatDateAdmin(heroPending.createdAt, locale),
                  id: heroPending.orderId.slice(0, 8),
                })}
              </p>
            </div>
            <div className="billing-hero-right">
              <BillingLedger.Amount
                amount={heroPending.amount}
                locale={locale}
                className="billing-hero-amount"
              />
              <Badge tone="warn" dot>
                {t('billing.status.pending')}
              </Badge>
            </div>
          </div>
          <div className="billing-hero-actions">
            <Button
              size="sm"
              variant="primary"
              disabled={resumeBusyId !== null || heroBusy}
              loading={resumeBusyId === heroPending.orderId}
              leftIcon={<ArrowSquareOut size={14} weight="bold" aria-hidden="true" />}
              aria-label={t('billing.resumeAria', {
                packageName: heroPending.packageName,
                orderId: heroPending.orderId.slice(0, 8),
              })}
              onClick={() => void onResume(heroPending.orderId)}
            >
              {t('billing.resume')}
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={resumeBusyId !== null || heroBusy}
              leftIcon={<X size={14} aria-hidden="true" />}
              aria-label={t('billing.cancelAria', {
                packageName: heroPending.packageName,
                orderId: heroPending.orderId.slice(0, 8),
              })}
              onClick={() => setConfirmId(heroPending.orderId)}
            >
              {t('billing.cancelPayment')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={resumeBusyId !== null || heroBusy}
              leftIcon={<Eye size={14} aria-hidden="true" />}
              aria-label={t('billing.detailAria', {
                packageName: heroPending.packageName,
                orderId: heroPending.orderId.slice(0, 8),
              })}
              onClick={() => navigate(`/billing/${heroPending.teamId}?orderId=${heroPending.orderId}`)}
            >
              {t('billing.detail')}
            </Button>
          </div>
          <p className="billing-hero-help">{t('billing.heroHelp')}</p>
        </section>
      ) : null}

      {resumeError && !error ? (
        <StatusBanner
          tone="danger"
          message={resumeError}
          onDismiss={() => setResumeError(null)}
        />
      ) : null}

      {payments === null && !error ? (
        <BillingLedger aria-busy="true" aria-label={t('billing.title')}>
          <ul role="list" className="billing-list" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <BillingLedger.Row key={i}>
                <BillingLedger.Main>
                  <BillingLedger.Head>
                    <Skeleton style={{ width: 110, height: 15 }} />
                    <Skeleton style={{ width: 64, height: 18, borderRadius: 'var(--radius-pill)' }} />
                  </BillingLedger.Head>
                  <div className="billing-meta">
                    <Skeleton style={{ width: '62%', height: 11 }} />
                  </div>
                </BillingLedger.Main>
                <BillingLedger.Actions>
                  <Skeleton style={{ width: 86, height: 28, borderRadius: 'var(--radius-input)' }} />
                </BillingLedger.Actions>
              </BillingLedger.Row>
            ))}
          </ul>
        </BillingLedger>
      ) : payments?.length === 0 ? (
        <BillingLedger>
          <div className="billing-empty">
            <DoodleIllustration variant="receipt" tone="soft-cream" size={140} />
            <h2 className="billing-empty-title">{t('billing.empty.title')}</h2>
            <p className="billing-empty-desc">{t('billing.empty.desc')}</p>
            <Button variant="secondary" size="sm" onClick={() => navigate('/pricing')}>
              {t('pricing.title', { defaultValue: 'Lihat paket' })}
            </Button>
          </div>
        </BillingLedger>
      ) : payments ? (
        <>
          {heroPending && historyPayments.length > 0 ? (
            <h2 className="billing-history-eyebrow">{t('billing.historyLabel')}</h2>
          ) : null}
          <BillingLedger>
          <ul role="list" className="billing-list">
            {(heroPending ? historyPayments : payments).map((p) => {
              const badge = STATUS_BADGE_KEYS[p.status] ?? {
                tone: 'neutral' as const,
                key: '',
                dot: false,
              };
              const badgeLabel = badge.key ? t(badge.key) : p.status;
              const busy = busyOrderId === p.orderId;
              const isPending = p.status === 'pending';
              const isCancelled = p.status === 'cancelled';
              return (
                <BillingLedger.Row
                  key={p.orderId}
                  tabIndex={-1}
                  className={p.status === 'cancelled' ? 'billing-row--muted' : ''}
                  ref={(el) => {
                    if (el) rowRefs.current.set(p.orderId, el);
                    else rowRefs.current.delete(p.orderId);
                  }}
                  aria-label={t('billing.rowLabel', {
                    teamName: p.teamName,
                    packageName: p.packageName,
                    status: badgeLabel,
                    date: formatDateAdmin(p.createdAt, locale),
                  })}
                >
                  <BillingLedger.Main>
                    <BillingLedger.Head>
                      <span className="billing-row-title">
                        {p.packageName} — {p.teamName} ·{' '}
                        <BillingLedger.Amount amount={p.amount} locale={locale} />
                      </span>
                      <Badge tone={badge.tone} dot={badge.dot}>
                        {badgeLabel}
                      </Badge>
                    </BillingLedger.Head>
                    <BillingLedger.Meta
                      createdAt={p.createdAt}
                      orderId={p.orderId}
                      expiredSuffix={isCancelled ? t('billing.expiredLinkSuffix') : null}
                      formatDate={(iso) => formatDateAdmin(iso, locale)}
                    />
                  </BillingLedger.Main>
                  <BillingLedger.Actions>
                    {isPending && (
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busy}
                        leftIcon={<X size={14} aria-hidden="true" />}
                        aria-label={t('billing.cancelAria', {
                          packageName: p.packageName,
                          orderId: p.orderId.slice(0, 8),
                        })}
                        onClick={() => setConfirmId(p.orderId)}
                      >
                        {t("billing.cancelPayment")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      leftIcon={<Eye size={14} aria-hidden="true" />}
                      aria-label={t('billing.detailAria', {
                        packageName: p.packageName,
                        orderId: p.orderId.slice(0, 8),
                      })}
                      onClick={() => navigate(`/billing/${p.teamId}?orderId=${p.orderId}`)}
                    >
                      {t('billing.detail')}
                    </Button>
                  </BillingLedger.Actions>
                </BillingLedger.Row>
              );
            })}
          </ul>
        </BillingLedger>
          {hasCancelled && !error ? (
            <p className="billing-note">{t('billing.cancelledNote')}</p>
          ) : null}
        </>
      ) : null}

          </div>
        </div>
      </article>
      <ConfirmDeleteDialog
        open={!!confirmId}
        title={t('billing.cancelTitle')}
        description={
          confirmPayment
            ? t('billing.cancelDesc', {
                packageName: confirmPayment.packageName,
                teamName: confirmPayment.teamName,
                amount: confirmPayment.amount.toLocaleString(locale),
              })
            : t('billing.cancelDescFallback')
        }
        confirmLabel={t('billing.confirmCancel')}
        confirmIcon={<X size={14} aria-hidden="true" />}
        busy={busyConfirm}
        error={actionError}
        onConfirm={() => void onConfirmCancel()}
        onClose={() => {
          if (!busyConfirm) {
            setConfirmId(null);
            setActionError(null);
          }
        }}
      />
    </div>
  );
}