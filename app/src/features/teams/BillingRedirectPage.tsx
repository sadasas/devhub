import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ClockCountdown,
  Copy,
  Lock,
  ArrowSquareOut,
  X,
} from '@phosphor-icons/react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../../lib/api';
import { classifyError, getErrorMessage } from '../../lib/errors';
import { formatDateAdmin, formatDateTimeAdmin, formatIdr } from '../../lib/format';
import type { BillingPayment, BillingStatus, PaymentHistoryItem } from '../../lib/types';
import { Badge } from '../../components/Badge';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { Button } from '../../components/Button';
import { DataErrorState } from '../../components/DataErrorState';
import { DoodleIllustration } from '../../components/DoodleIllustration';
import { InlineError } from '../../components/InlineError';
import { Skeleton } from '../../components/Skeleton';

const POLL_MS = 5_000;
const POLL_MAX = 24;
const POLL_BACKOFF_AFTER = 6;
const POLL_MS_SLOW = 10_000;

type DisplayState = 'loading' | 'unauthenticated' | 'pending' | 'success' | 'failed';

function shortId(id: string) {
  return id.slice(0, 8);
}

function isExpiredPlan(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return Date.parse(expiresAt) < Date.now();
}

/* ---------- Presentational helpers (ledger editorial) ---------- */

/* Opsi K — nav teks kiri atas (‹ Kembali ke workspace / ‹ Kembali mobile),
   menggantikan CardBack icon-only agar sama persis struktur wireframe. */
function NavBack({ to, full, short }: { to: string; full: string; short: string }) {
  return (
    <div className="billing-redirect-navwrap">
      <Link to={to} className="billing-redirect-nav" aria-label={full}>
        <span aria-hidden="true">‹ </span>
        <span className="billing-redirect-nav-full">{full}</span>
        <span className="billing-redirect-nav-short">{short}</span>
      </Link>
    </div>
  );
}

function PaymentFacts({
  payment,
  onCopy,
  copied,
  copyLabel,
  copiedLabel,
  copyAria,
}: {
  payment: (BillingPayment | PaymentHistoryItem) | null;
  onCopy: (text: string) => void;
  copied: boolean;
  copyLabel: string;
  copiedLabel: string;
  copyAria: string;
}) {
  const { t, i18n } = useTranslation('account');
  const locale = i18n.language === 'id' ? 'id-ID' : 'en-US';
  if (!payment) return null;
  const duration = (payment as { durationDays?: number | null }).durationDays ?? null;
  const teamName = (payment as { teamName?: string }).teamName ?? null;
  const amount = payment.amount;
  const createdAt = payment.createdAt;
  const completedAt = (payment as { completedAt?: string | null }).completedAt ?? null;
  const muted = payment.status === 'cancelled';
  /* Opsi K — urutan fakta persis wireframe: Paket, Dibuat, Durasi, Order, Jumlah, Lunas. */
  return (
    <dl className="billing-facts">
      <dt>{t('teams.payment.facts.package')}</dt>
      <dd className={muted ? 'billing-facts--muted' : ''}>{teamName ? `${payment.packageName} — ${teamName}` : payment.packageName}</dd>
      <dt>{t('teams.payment.facts.created')}</dt>
      <dd className={muted ? 'billing-facts--muted' : ''}>{formatDateTimeAdmin(createdAt, locale)}</dd>
      {duration != null && (
        <>
          <dt>{t('teams.payment.facts.duration')}</dt>
          <dd className={muted ? 'billing-facts--muted' : ''}>{t('teams.billing.scheduledDuration', { count: duration })}</dd>
        </>
      )}
      <dt>{t('teams.payment.facts.order')}</dt>
      <dd className={muted ? 'billing-facts--muted' : ''}>
        <span className="billing-redirect-mono" title={payment.orderId}>
          #{shortId(payment.orderId)}
        </span>
        <button
          type="button"
          className="billing-redirect-copy"
          onClick={() => onCopy(payment.orderId)}
          aria-label={copyAria}
        >
          <Copy size={12} aria-hidden="true" /> <span className="billing-redirect-copy-text">{copied ? copiedLabel : copyLabel}</span>
        </button>
      </dd>
      <dt>{t('teams.payment.facts.amount')}</dt>
      <dd className={muted ? 'billing-facts--muted' : ''} style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
        {formatIdr(amount, locale)}
      </dd>
      {completedAt && (
        <>
          <dt>{t('teams.payment.facts.completed')}</dt>
          <dd className={muted ? 'billing-facts--muted billing-facts--paid' : 'billing-facts--paid'}>{formatDateTimeAdmin(completedAt, locale)}</dd>
        </>
      )}
    </dl>
  );
}

export function BillingRedirectPage() {
  const { t, i18n } = useTranslation('account');
  const locale = i18n.language === 'id' ? 'id-ID' : 'en-US';
  const { teamId = '' } = useParams<{ teamId: string }>();
  const [searchParams] = useSearchParams();
  const orderIdQuery = searchParams.get('orderId');

  const [data, setData] = useState<BillingStatus | null>(null);
  const [detailPayment, setDetailPayment] = useState<PaymentHistoryItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loadErrorRaw, setLoadErrorRaw] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'resume' | 'cancel' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const timerRef = useRef<number | null>(null);
  const pollCountRef = useRef(0);

  const load = useCallback(async () => {
    setActionError(null);
    try {
      if (orderIdQuery) {
        const res = await api.getPayment(orderIdQuery);
        setDetailPayment(res.payment);
        // Detail is pure order — no billingStatus fetch (was 2nd call 1.68kB). Workspace info from payment.teamName only.
        setData(null);
        setError(null);
        setErrorCode(null);
        setLoadErrorRaw(null);
        return res.payment as unknown as BillingStatus;
      }
      const status = await api.billingStatus(teamId);
      setData(status);
      setDetailPayment(null);
      setError(null);
      setErrorCode(null);
      setLoadErrorRaw(null);
      return status;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setErrorCode('UNAUTHORIZED');
        setError(null);
      } else {
        const msg = getErrorMessage(err, t('teams.payment.loadError', { defaultValue: 'Gagal memuat pembayaran.' }));
        setError(msg);
        setErrorCode(err instanceof ApiError ? err.code : 'UNKNOWN');
        setLoadErrorRaw(err);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [teamId, t, orderIdQuery]);

  useEffect(() => {
    setLoading(true);
    void load();
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, [load]);

  const targetPayment: BillingPayment | PaymentHistoryItem | null = useMemo(() => {
    if (orderIdQuery && detailPayment) return detailPayment as unknown as BillingPayment;
    if (!data || data.payments.length === 0) return null;
    if (orderIdQuery) {
      const found = data.payments.find((p) => p.orderId === orderIdQuery);
      if (found) return found;
    }
    const pending = [...data.payments].filter((p) => p.status === 'pending').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (pending) return pending;
    const completed = [...data.payments].filter((p) => p.status === 'completed').sort((a, b) => (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt))[0];
    if (completed) return completed;
    return [...data.payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  }, [data, orderIdQuery, detailPayment]);

  const displayState: DisplayState = useMemo(() => {
    if (loading && !data && !detailPayment && !errorCode) return 'loading';
    if (errorCode === 'UNAUTHORIZED') return 'unauthenticated';
    if (error && !data && !detailPayment) return 'failed';
    if (orderIdQuery && detailPayment) {
      if (detailPayment.status === 'pending') return 'pending';
      if (detailPayment.status === 'completed') return 'success';
      return 'failed';
    }
    if (!data) return 'loading';
    if (data.team.plan === 'pro' && !isExpiredPlan(data.team.planExpiresAt)) return 'success';
    const hasPending = data.payments.some((p) => p.status === 'pending');
    if (hasPending) return 'pending';
    return 'failed';
  }, [loading, data, detailPayment, error, errorCode, orderIdQuery]);

  const hasPending = (data?.payments.some((p) => p.status === 'pending') ?? false) || detailPayment?.status === 'pending' || false;
  const failedVariant: 'cancelled' | 'expired' | 'failed' | null = useMemo(() => {
    if (displayState !== 'failed') return null;
    if (targetPayment?.status === 'cancelled') return 'cancelled';
    if (data?.team.planExpiresAt && isExpiredPlan(data.team.planExpiresAt)) return 'expired';
    // fallback when data is null but detailPayment is cancelled
    if ((detailPayment as unknown as { status?: string })?.status === 'cancelled') return 'cancelled';
    return 'failed';
  }, [displayState, data, targetPayment, detailPayment]);

  const shouldPoll = displayState === 'pending' && hasPending;

  useEffect(() => {
    if (!shouldPoll) {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      pollCountRef.current = 0;
      return;
    }
    const schedule = () => {
      const interval = pollCountRef.current >= POLL_BACKOFF_AFTER ? POLL_MS_SLOW : POLL_MS;
      timerRef.current = window.setInterval(() => {
        if (document.visibilityState === 'hidden') return;
        pollCountRef.current += 1;
        void load();
        if (pollCountRef.current >= POLL_MAX) {
          if (timerRef.current !== null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
        } else if (pollCountRef.current === POLL_BACKOFF_AFTER) {
          if (timerRef.current !== null) window.clearInterval(timerRef.current);
          timerRef.current = window.setInterval(() => {
            if (document.visibilityState === 'hidden') return;
            pollCountRef.current += 1;
            void load();
            if (pollCountRef.current >= POLL_MAX && timerRef.current !== null) {
              window.clearInterval(timerRef.current);
              timerRef.current = null;
            }
          }, POLL_MS_SLOW);
        }
      }, interval);
    };
    pollCountRef.current = 0;
    schedule();
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && shouldPoll && timerRef.current === null && pollCountRef.current < POLL_MAX) void load();
    };
    const onPageHide = () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      timerRef.current = null;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [shouldPoll, load]);

  const handleResume = async () => {
    if (!targetPayment || targetPayment.status !== 'pending') return;
    setBusy('resume');
    setActionError(null);
    try {
      const res = await api.resumePayment(targetPayment.orderId);
      window.location.assign(res.url);
    } catch (err) {
      setActionError(getErrorMessage(err, t('teams.billing.resumeError', { defaultValue: 'Gagal melanjutkan pembayaran.' })));
      setBusy(null);
    }
  };

  const handleCancel = async () => {
    if (!targetPayment || targetPayment.status !== 'pending') return;
    setBusy('cancel');
    setActionError(null);
    try {
      await api.cancelPayment(targetPayment.orderId);
      await load();
    } catch (err) {
      setActionError(getErrorMessage(err, t('teams.billing.cancelError', { defaultValue: 'Gagal membatalkan.' })));
    } finally {
      setBusy(null);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  // Invariant workspace name: detailPayment primary (pure order, no billingStatus)
  const workspaceName: string | null = (detailPayment?.teamName ?? null) as string | null;
  const workspaceMismatch =
    !!detailPayment && !!teamId && detailPayment.teamId !== teamId;
  const billingHref = `/?team=${encodeURIComponent(teamId || detailPayment?.teamId || '')}&tab=settings&section=billing`;
  const backLabel = t('teams.payment.back', { defaultValue: 'Kembali ke workspace' });
  const backShort = t('teams.payment.backShort', { defaultValue: 'Kembali' });
  const copyLabel = t('teams.payment.copyOrder', { defaultValue: 'Salin' });
  const copiedLabel = t('common:action.copied', { defaultValue: 'Disalin' });
  const copyAria = t('teams.payment.copyOrderId', { defaultValue: 'Salin Order ID' });
  const durationDays = (targetPayment as { durationDays?: number | null } | null)?.durationDays ?? null;
  const durationLabel = durationDays != null ? t('teams.billing.scheduledDuration', { count: durationDays }) : '';
  const detailSub = targetPayment
    ? t('teams.payment.detailSub', {
        packageName: targetPayment.packageName,
        duration: durationLabel,
        id: shortId(targetPayment.orderId),
      })
    : '';
  const activeUntilDate = data?.team.planExpiresAt
    ?? (targetPayment as { completedAt?: string | null } | null)?.completedAt
    ?? null;

  const renderHeroIcon = () => {
    const size = 20;
    const weight = 'regular' as const;
    /* Status utama pakai Doodle billing baru (keputusan owner 2026-10-05):
       pending = jam pasir, paid = struk + stempel, cancelled = struk
       sobek. Ikon Phosphor dipertahankan untuk login-required +
       menunggu-tanpa-order. */
    if (displayState === 'success') return <DoodleIllustration variant="paid" tone="soft-mint" size={104} />;
    if (displayState === 'failed') return <DoodleIllustration variant="cancelled" tone="soft-cream" size={104} />;
    if (displayState === 'pending' && targetPayment) return <DoodleIllustration variant="pending" tone="soft-cream" size={104} />;
    if (displayState === 'pending') return <span className="billing-redirect-icon billing-redirect-icon--pending" aria-hidden="true"><ClockCountdown size={size} weight={weight} /></span>;
    if (displayState === 'unauthenticated') return <span className="billing-redirect-icon billing-redirect-icon--neutral" aria-hidden="true"><Lock size={size} weight={weight} /></span>;
    return null;
  };

  return (
    <div className="billing-redirect-shell">
      {/* Wireframe K: tanpa header bar — langsung nav kembali. */}
      <main className="billing-redirect-page" aria-labelledby="billing-redirect-title">
        {displayState === 'loading' && (
          <div className="billing-redirect-card" role="status" aria-live="polite" aria-busy="true" aria-label="Loading billing status">
            <NavBack to={billingHref} full={backLabel} short={backShort} />
            <span className="sr-only">Memuat pembayaran…</span>
            <div aria-hidden="true" className="billing-redirect-status">
              <Skeleton style={{ width: 64, height: 64, borderRadius: 999 }} />
              <Skeleton style={{ width: 84, height: 20, borderRadius: 999 }} />
              <Skeleton style={{ width: 150, height: 26, borderRadius: 6 }} />
              <Skeleton style={{ width: 190, height: 18, borderRadius: 6 }} />
              <Skeleton style={{ width: '70%', height: 13, borderRadius: 6 }} />
            </div>
            <dl className="billing-facts" aria-hidden="true">
              {["Paket", "Dibuat", "Durasi", "Order ID", "Jumlah"].map((label) => (
                <div key={label} style={{ display: "contents" }}>
                  <dt><Skeleton style={{ width: 60, height: 11, borderRadius: 4 }} /></dt>
                  <dd><Skeleton style={{ width: 120, height: 13, borderRadius: 4 }} /></dd>
                </div>
              ))}
            </dl>
            <div className="billing-redirect-actions" aria-hidden="true" style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <Skeleton style={{ width: 100, height: 28, borderRadius: 8 }} />
              <Skeleton style={{ width: 170, height: 28, borderRadius: 8 }} />
            </div>
          </div>
        )}

        {displayState === 'unauthenticated' && (
          <section className="billing-redirect-card billing-redirect-card--neutral" role="alert" aria-live="assertive">
            <NavBack to="/" full={t('common:action.backToHome', { defaultValue: 'Beranda' })} short={backShort} />
            <div className="billing-redirect-hero">
              {renderHeroIcon()}
              <div>
                <h1 id="billing-redirect-title" className="billing-redirect-title">{t('teams.payment.loginRequired', { defaultValue: 'Login diperlukan' })}</h1>
                <p className="billing-redirect-subtitle">{t('teams.payment.loginRequiredDesc', { defaultValue: 'Masuk dulu untuk melihat status pembayaran.' })}</p>
              </div>
            </div>
            <div className="billing-redirect-actions">
              <Button variant="primary" onClick={() => { const rt = `${window.location.pathname}${window.location.search}`; window.location.href = `/?returnTo=${encodeURIComponent(rt)}`; }}>{t('common:action.signIn', { defaultValue: 'Masuk' })}</Button>
            </div>
          </section>
        )}

        {error && displayState !== 'unauthenticated' && displayState !== 'loading' && !data && !detailPayment && (
          <DataErrorState
            error={loadErrorRaw ?? error}
            onRetry={() => void load()}
            retryLabel={t('common:action.retry', { defaultValue: 'Coba lagi' })}
            title={t('teams.payment.loadErrorTitle', { defaultValue: 'Gagal memuat pembayaran' })}
            description={t(`common:dataError.${classifyError(loadErrorRaw ?? error)}Desc`, { defaultValue: 'Gagal memuat pembayaran. Coba lagi.' })}
          />
        )}

        {(data || detailPayment) && displayState === 'pending' && targetPayment && (
          <>
            {/* Wireframe K: status langsung di background, tanpa kartu pembungkus. */}
            <section role="status" aria-live="polite">
            <NavBack to={billingHref} full={backLabel} short={backShort} />
            <div className="billing-redirect-status">
              {renderHeroIcon()}
              <div className="billing-redirect-badges">
                <Badge tone="warn" dot>{t('teams.payment.pendingBadge', { defaultValue: 'Tertunda' })}</Badge>
              </div>
              <p className="billing-redirect-amount">{formatIdr(targetPayment.amount, locale)}</p>
              <h1 id="billing-redirect-title" className="billing-redirect-title">{t('teams.payment.waitingTitle', { defaultValue: 'Menunggu pembayaran' })}</h1>
              <p className="billing-redirect-subtitle">{detailSub}</p>
            </div>
            {workspaceMismatch && (
              <p className="billing-redirect-help" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {t('teams.payment.workspaceMismatch', { teamName: detailPayment?.teamName ?? '', defaultValue: `Order ini milik workspace lain: ${detailPayment?.teamName}` })}
              </p>
            )}
            <PaymentFacts
              payment={targetPayment}
              onCopy={(text) => void handleCopy(text)}
              copied={copied}
              copyLabel={copyLabel}
              copiedLabel={copiedLabel}
              copyAria={copyAria}
            />
            {actionError && <InlineError>{actionError}</InlineError>}
            <div className="billing-redirect-actions">
              <Button variant="primary" size="sm" leftIcon={<ArrowSquareOut size={13} weight="bold" aria-hidden="true" />} loading={busy === 'resume'} disabled={busy !== null} onClick={() => void handleResume()}>{t('teams.billing.resumePayment', { defaultValue: 'Lanjutkan pembayaran' })}</Button>
              <Button variant="danger" size="sm" leftIcon={<X size={13} aria-hidden="true" />} disabled={busy !== null} loading={busy === 'cancel'} onClick={() => setConfirmCancel(true)}>{t('teams.billing.cancelPayment', { defaultValue: 'Batalkan' })}</Button>
            </div>
            <p className="billing-redirect-help billing-redirect-help--center">{t('teams.payment.pendingActiveHelp', { date: formatDateTimeAdmin(targetPayment.createdAt, locale) })}</p>
            <p className="sr-only" aria-live="polite">{t("teams.payment.pollingHint")}</p>
          </section>
          <ConfirmDeleteDialog
            open={confirmCancel}
            title={t('extras:billing.cancelTitle')}
            description={targetPayment ? t('extras:billing.cancelDesc', { packageName: targetPayment.packageName, teamName: workspaceName ?? '', amount: targetPayment.amount.toLocaleString(locale) }) : t('extras:billing.cancelDescFallback')}
            confirmLabel={t('extras:billing.confirmCancel')}
            confirmIcon={<X size={14} aria-hidden="true" />}
            busy={busy === 'cancel'}
            onConfirm={() => { setConfirmCancel(false); void handleCancel(); }}
            onClose={() => { if (busy !== 'cancel') setConfirmCancel(false); }}
          />
          </>
        )}

        {(data || detailPayment) && displayState === 'pending' && !targetPayment && (
          <section className="billing-redirect-card" role="status" aria-live="polite">
            <NavBack to={billingHref} full={backLabel} short={backShort} />
            <div className="billing-redirect-hero">
              {renderHeroIcon()}
              <div>
                <h1 className="billing-redirect-title">{t('teams.payment.waiting', { defaultValue: 'Menunggu pembayaran' })}</h1>
              </div>
            </div>
          </section>
        )}

        {(data || detailPayment) && displayState === 'success' && (
          <section role="status" aria-live="polite">
            <NavBack to={billingHref} full={backLabel} short={backShort} />
            <div className="billing-redirect-status">
              {renderHeroIcon()}
              <div className="billing-redirect-badges">
                <Badge tone="success" dot>{t('teams.payment.paidBadge', { defaultValue: 'Lunas' })}</Badge>
              </div>
              {targetPayment ? (
                <p className="billing-redirect-amount">{formatIdr(targetPayment.amount, locale)}</p>
              ) : null}
              <h1 id="billing-redirect-title" className="billing-redirect-title">{t('teams.payment.paidTitle', { defaultValue: 'Pembayaran lunas' })}</h1>
              <p className="billing-redirect-subtitle">
                {activeUntilDate
                  ? t('teams.payment.paidSubActiveUntil', { date: formatDateAdmin(activeUntilDate, locale) })
                  : t('teams.payment.unlimited', { defaultValue: 'Paket Pro aktif.' })}
              </p>
            </div>
            <PaymentFacts
              payment={targetPayment}
              onCopy={(text) => void handleCopy(text)}
              copied={copied}
              copyLabel={copyLabel}
              copiedLabel={copiedLabel}
              copyAria={copyAria}
            />
            <p className="billing-redirect-help billing-redirect-help--center">{t("teams.payment.lunasHelp")}</p>
          </section>
        )}

        {(data || detailPayment) && displayState === 'failed' && (
          <section role="alert">
            <NavBack to={billingHref} full={backLabel} short={backShort} />
            <div className="billing-redirect-status">
              {renderHeroIcon()}
              <div className="billing-redirect-badges">
                <Badge tone="danger" dot>{failedVariant === 'cancelled' ? t("teams.payment.cancelledBadge") : t("teams.payment.failedBadge")}</Badge>
              </div>
              {targetPayment ? (
                <p className={`billing-redirect-amount${failedVariant === 'cancelled' ? ' billing-redirect-amount--muted' : ''}`}>{formatIdr(targetPayment.amount, locale)}</p>
              ) : null}
              <h1 id="billing-redirect-title" className={`billing-redirect-title${failedVariant === 'cancelled' ? ' billing-redirect-title--muted' : ''}`}>{failedVariant === 'cancelled' ? t('teams.payment.cancelledTitle', { defaultValue: 'Pembayaran dibatalkan' }) : failedVariant === 'expired' ? t('teams.payment.expiredTitle', { defaultValue: 'Masa Pro habis' }) : t('teams.payment.failedTitle', { defaultValue: 'Pembayaran belum berhasil' })}</h1>
              <p className="billing-redirect-subtitle">{failedVariant === 'cancelled' ? t('teams.payment.cancelledShortDesc', { defaultValue: 'Link pembayaran kedaluwarsa.' }) : failedVariant === 'expired' ? t('teams.payment.expiredDesc', { defaultValue: 'Langganan habis. Perpanjang untuk lanjut.' }) : t('teams.payment.failedDesc', { defaultValue: 'Pembayaran belum masuk.' })}</p>
            </div>
            <PaymentFacts
              payment={targetPayment}
              onCopy={(text) => void handleCopy(text)}
              copied={copied}
              copyLabel={copyLabel}
              copiedLabel={copiedLabel}
              copyAria={copyAria}
            />
            <div className="billing-redirect-actions billing-redirect-actions--center">
              {/* Usage now lives in the dashboard settings tab (billing section). */}
              <Button variant="primary" size="sm" leftIcon={<ArrowSquareOut size={13} weight="bold" aria-hidden="true" />} onClick={() => (window.location.href = `/pricing?teamId=${teamId || detailPayment?.teamId || ''}`)}>{t('teams.payment.newPayment', { defaultValue: 'Lihat Paket' })}</Button>
            </div>
            <p className="billing-redirect-help billing-redirect-help--center">{t("teams.payment.batalHelp")}</p>
          </section>
        )}
      </main>
    </div>
  );
}
