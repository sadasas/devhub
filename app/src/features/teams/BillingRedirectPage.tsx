import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle,
  ClockCountdown,
  Copy,
  Lock,
  XCircle,
  ArrowSquareOut,
  Trash,
} from '@phosphor-icons/react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { BillingPayment, BillingStatus, PaymentHistoryItem } from '../../lib/types';
import { Badge } from '../../components/Badge';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { Button } from '../../components/Button';
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

function formatDateShort(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso ?? '—';
  }
}

/* ---------- Presentational helpers (ledger editorial) ---------- */

function WorkspaceEyebrow({ name, loading }: { name: string | null; loading?: boolean }) {
  if (loading) {
    return (
      <p className="billing-context billing-context--loading" aria-hidden="true">
        <Skeleton style={{ width: 140, height: 13, borderRadius: 6 }} />
      </p>
    );
  }
  const label = name ? `Workspace: ${name}` : 'Workspace: —';
  if (!name) {
    return (
      <p className="billing-context" aria-label={label} style={{ opacity: 0.85, fontStyle: 'italic' }}>
        <span>Workspace</span>
        <span aria-hidden="true" className="billing-context-dot">·</span>
        <span className="billing-context-name">—</span>
      </p>
    );
  }
  return (
    <p className="billing-context" aria-label={label}>
      <span>Workspace</span>
      <span aria-hidden="true" className="billing-context-dot">·</span>
      <span className="billing-context-name" title={name}>{name}</span>
    </p>
  );
}

function PaymentFacts({
  payment,
  team,
}: {
  payment: (BillingPayment | PaymentHistoryItem) | null;
  team: BillingStatus['team'] | null;
}) {
  if (!payment) return null;
  const duration = (payment as { durationDays?: number | null }).durationDays ?? null;
  const amount = payment.amount;
  const createdAt = payment.createdAt;
  const completedAt = (payment as { completedAt?: string | null }).completedAt ?? null;
  // team may provide planExpiresAt for success state but facts focus on payment itself
  return (
    <dl className="billing-facts">
      <dt>Paket</dt>
      <dd>{payment.packageName}</dd>
      {duration != null && (
        <>
          <dt>Durasi</dt>
          <dd>{duration} hari</dd>
        </>
      )}
      <dt>Jumlah</dt>
      <dd style={{ fontVariantNumeric: 'tabular-nums' }}>Rp {amount.toLocaleString('id-ID')}</dd>
      <dt>Order ID</dt>
      <dd style={{ gap: 8 }}>
        <span className="billing-redirect-mono" title={payment.orderId} style={{ maxWidth: 160 }}>
          {shortId(payment.orderId)}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>· Rp {amount.toLocaleString('id-ID')}</span>
      </dd>
      <dt>Dibuat</dt>
      <dd>{formatDateShort(createdAt)}</dd>
      {completedAt && (
        <>
          <dt>Selesai</dt>
          <dd>{formatDateShort(completedAt)}</dd>
        </>
      )}
      {team?.planExpiresAt && (
        <>
          <dt>Aktif sampai</dt>
          <dd>{formatDateShort(team.planExpiresAt)}</dd>
        </>
      )}
    </dl>
  );
}

export function BillingRedirectPage() {
  const { t } = useTranslation('account');
  const { teamId = '' } = useParams<{ teamId: string }>();
  const [searchParams] = useSearchParams();
  const orderIdQuery = searchParams.get('orderId');

  const [data, setData] = useState<BillingStatus | null>(null);
  const [detailPayment, setDetailPayment] = useState<PaymentHistoryItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
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
        // Keep data for team name fallback, but detail is primary
        try {
          const status = await api.billingStatus(teamId);
          setData(status);
        } catch {}
        setError(null);
        setErrorCode(null);
        return res.payment as unknown as BillingStatus;
      }
      const status = await api.billingStatus(teamId);
      setData(status);
      setDetailPayment(null);
      setError(null);
      setErrorCode(null);
      return status;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setErrorCode('UNAUTHORIZED');
        setError(null);
      } else {
        const msg = getErrorMessage(err, t('teams.payment.loadError', { defaultValue: 'Gagal memuat pembayaran.' }));
        setError(msg);
        setErrorCode(err instanceof ApiError ? err.code : 'UNKNOWN');
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

  // Invariant workspace name: detailPayment primary, fallback data.team.name
  const workspaceName: string | null = (detailPayment?.teamName ?? data?.team.name ?? null) as string | null;
  const workspaceMismatch =
    !!detailPayment && !!teamId && detailPayment.teamId !== teamId;
  const pendingScheduled = (data as BillingStatus | null)?.team.pendingPackage ?? null;

  const renderHeroIcon = () => {
    const size = 20;
    const weight = 'regular' as const;
    if (displayState === 'success') return <span className="billing-redirect-icon billing-redirect-icon--success" aria-hidden="true"><CheckCircle size={size} weight={weight} /></span>;
    if (displayState === 'pending') return <span className="billing-redirect-icon billing-redirect-icon--pending" aria-hidden="true"><ClockCountdown size={size} weight={weight} /></span>;
    if (displayState === 'failed') return <span className="billing-redirect-icon billing-redirect-icon--danger" aria-hidden="true"><XCircle size={size} weight={weight} /></span>;
    if (displayState === 'unauthenticated') return <span className="billing-redirect-icon billing-redirect-icon--neutral" aria-hidden="true"><Lock size={size} weight={weight} /></span>;
    return null;
  };

  return (
    <div className="billing-redirect-shell">
      <header className="billing-redirect-header">
        <Link to="/" className="billing-redirect-logo" aria-label="DevHub">DevHub</Link>
        <span className="billing-redirect-header-meta">Secure payment · Pakasir</span>
      </header>

      <main className="billing-redirect-page" aria-labelledby="billing-redirect-title">
        {displayState === 'loading' && (
          <div className="billing-redirect-card" role="status" aria-live="polite" aria-busy="true" aria-label="Loading billing status">
            <span className="sr-only">Memuat pembayaran…</span>
            <WorkspaceEyebrow name={null} loading />
            <div aria-hidden="true" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <Skeleton style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Skeleton style={{ width: 110, height: 18, borderRadius: 6 }} />
                  <Skeleton style={{ width: 64, height: 18, borderRadius: 999 }} />
                  <Skeleton style={{ width: 32, height: 18, borderRadius: 999 }} />
                </div>
                <Skeleton style={{ width: '88%', height: 13, borderRadius: 6 }} />
                <Skeleton style={{ width: '62%', height: 11, borderRadius: 6 }} />
              </div>
            </div>
            <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 0, border: '1px solid var(--border-hairline)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-inset)' }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ display: 'contents' }}>
                  <div style={{ padding: '10px 12px', borderBottom: i < 3 ? '1px solid var(--border-hairline)' : 'none', borderRight: '1px solid var(--border-hairline)' }}>
                    <Skeleton style={{ width: 60, height: 11, borderRadius: 4 }} />
                  </div>
                  <div style={{ padding: '10px 12px', borderBottom: i < 3 ? '1px solid var(--border-hairline)' : 'none' }}>
                    <Skeleton style={{ width: 120, height: 13, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
            <div aria-hidden="true" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <Skeleton style={{ width: 158, height: 32, borderRadius: 8 }} />
              <Skeleton style={{ width: 84, height: 32, borderRadius: 8 }} />
            </div>
          </div>
        )}

        {displayState === 'unauthenticated' && (
          <section className="billing-redirect-card billing-redirect-card--neutral" role="alert" aria-live="assertive">
            <WorkspaceEyebrow name={workspaceName} />
            <div className="billing-redirect-hero">
              {renderHeroIcon()}
              <div>
                <h1 id="billing-redirect-title" className="billing-redirect-title">{t('teams.payment.loginRequired', { defaultValue: 'Login diperlukan' })}</h1>
                <p className="billing-redirect-subtitle">{t('teams.payment.loginRequiredDesc', { defaultValue: 'Masuk dulu untuk melihat status pembayaran.' })}</p>
              </div>
            </div>
            <div className="billing-redirect-actions">
              <Button variant="primary" onClick={() => { const rt = `${window.location.pathname}${window.location.search}`; window.location.href = `/?returnTo=${encodeURIComponent(rt)}`; }}>{t('common:action.signIn', { defaultValue: 'Masuk' })}</Button>
              <Link className="billing-redirect-link" to="/">{t('common:action.backToHome', { defaultValue: 'Beranda' })}</Link>
            </div>
          </section>
        )}

        {error && displayState !== 'unauthenticated' && displayState !== 'loading' && !data && !detailPayment && (
          <section className="billing-redirect-card billing-redirect-card--danger" role="alert">
            <WorkspaceEyebrow name={workspaceName} />
            <div className="billing-redirect-hero">
              <span className="billing-redirect-icon billing-redirect-icon--danger" aria-hidden="true"><XCircle size={20} weight="regular" /></span>
              <div>
                <h1 className="billing-redirect-title">{t('teams.payment.loadErrorTitle', { defaultValue: 'Gagal memuat pembayaran' })}</h1>
                <p className="billing-redirect-subtitle">{error}</p>
              </div>
            </div>
            <div className="billing-redirect-actions">
              <Button variant="secondary" onClick={() => void load()}>{t('common:action.retry', { defaultValue: 'Coba lagi' })}</Button>
            </div>
          </section>
        )}

        {(data || detailPayment) && displayState === 'pending' && targetPayment && (
          <>
            <section className="billing-redirect-card" role="status" aria-live="polite">
            <WorkspaceEyebrow name={workspaceName} />
            <div className="billing-redirect-hero">
              {renderHeroIcon()}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <h1 id="billing-redirect-title" className="billing-redirect-title">{targetPayment.packageName}</h1>
                  <Badge tone="warn" dot>{t('teams.billing.pendingBadge', { defaultValue: 'Menunggu' })}</Badge>
                  <Badge tone="info">Pro</Badge>
                </div>
                <p className="billing-redirect-subtitle">Selesaikan pembayaran untuk {targetPayment.packageName} · Rp {targetPayment.amount.toLocaleString('id-ID')} via QRIS / VA. Paket aktif otomatis setelah terbayar.</p>
              </div>
            </div>
            {workspaceMismatch && (
              <p className="billing-redirect-help" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Order ini milik workspace lain: {detailPayment?.teamName}
              </p>
            )}
            <PaymentFacts payment={targetPayment} team={data?.team ?? null} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
              <span className="billing-redirect-mono" title={targetPayment.orderId}>Order {shortId(targetPayment.orderId)} · Rp {targetPayment.amount.toLocaleString('id-ID')}</span>
              <button type="button" className="billing-redirect-copy" onClick={() => void handleCopy(targetPayment.orderId)} aria-label="Copy order ID"><Copy size={12} aria-hidden="true" /> {copied ? t('common:copied', { defaultValue: 'Tersalin' }) : 'Copy'}</button>
            </div>
            {actionError && <InlineError>{actionError}</InlineError>}
            <div className="billing-redirect-actions">
              <Button variant="primary" size="sm" leftIcon={<ArrowSquareOut size={13} weight="bold" aria-hidden="true" />} loading={busy === 'resume'} disabled={busy !== null} onClick={() => void handleResume()}>{t('teams.billing.resumePayment', { defaultValue: 'Lanjutkan pembayaran' })}</Button>
              <Button variant="ghost" size="sm" leftIcon={<Trash size={13} aria-hidden="true" />} disabled={busy !== null} loading={busy === 'cancel'} onClick={() => setConfirmCancel(true)}>{t('teams.billing.cancelPayment', { defaultValue: 'Batalkan' })}</Button>
            </div>
            <p className="billing-redirect-help" style={{ marginTop: 4 }}>Butuh bantuan? Hubungi admin tim dengan Order ID di atas.</p>
            {pendingScheduled && (
              <p className="billing-redirect-help" style={{ color: 'var(--status-warn)', marginTop: 6 }}>
                {t('teams.payment.scheduledHelp', {
                  defaultValue: `Downgrade terjadwal ke ${pendingScheduled.name} akan aktif ${new Date(pendingScheduled.activateAt).toLocaleDateString('id-ID')}. Batalkan di Billing.`,
                  name: pendingScheduled.name,
                  date: new Date(pendingScheduled.activateAt).toLocaleDateString('id-ID'),
                })}
              </p>
            )}
            <p className="sr-only" aria-live="polite">Mengecek otomatis tiap 5 detik</p>
          </section>
          <ConfirmDeleteDialog
            open={confirmCancel}
            title={t('billing.cancelTitle', { defaultValue: 'Batalkan pembayaran?' })}
            description={targetPayment ? t('billing.cancelDesc', { defaultValue: '"' + targetPayment.packageName + '" untuk "' + (workspaceName ?? '') + '" \u00b7 Rp ' + targetPayment.amount.toLocaleString('id-ID') + ' akan dibatalkan. Link Pakasir akan kadaluarsa.', packageName: targetPayment.packageName, teamName: workspaceName ?? '', amount: targetPayment.amount.toLocaleString('id-ID') }) : t('billing.cancelDescFallback', { defaultValue: 'Pembayaran ini akan dibatalkan. Link Pakasir akan kadaluarsa.' })}
            confirmLabel={t('billing.confirmCancel', { defaultValue: 'Ya, batalkan' })}
            busy={busy === 'cancel'}
            onConfirm={() => { setConfirmCancel(false); void handleCancel(); }}
            onClose={() => { if (busy !== 'cancel') setConfirmCancel(false); }}
          />
          </>
        )}

        {(data || detailPayment) && displayState === 'pending' && !targetPayment && (
          <section className="billing-redirect-card" role="status" aria-live="polite">
            <WorkspaceEyebrow name={workspaceName} />
            <div className="billing-redirect-hero">
              {renderHeroIcon()}
              <div>
                <h1 className="billing-redirect-title">{t('teams.payment.waiting', { defaultValue: 'Menunggu pembayaran' })}</h1>
                <p className="billing-redirect-subtitle">Selesaikan pembayaran via QRIS / VA.</p>
              </div>
            </div>
          </section>
        )}

        {(data || detailPayment) && displayState === 'success' && (
          <section className="billing-redirect-card billing-redirect-card--success" role="status" aria-live="polite">
            <WorkspaceEyebrow name={workspaceName} />
            <div className="billing-redirect-hero">
              {renderHeroIcon()}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <h1 id="billing-redirect-title" className="billing-redirect-title">{targetPayment ? targetPayment.packageName : t('teams.payment.proActive', { defaultValue: 'Pro aktif' })}</h1>
                  <Badge tone="success" dot>{t('teams.billing.activeBadge', { defaultValue: 'Lunas' })}</Badge>
                  <Badge tone="info">Pro</Badge>
                </div>
                <p className="billing-redirect-subtitle">
                  {data?.team.planExpiresAt
                    ? t('teams.payment.unlimitedUntil', { defaultValue: 'Aktif sampai {{date}}.', date: new Date(data.team.planExpiresAt).toLocaleDateString('id-ID') })
                    : t('teams.payment.unlimited', { defaultValue: 'Paket Pro aktif.' })}
                </p>
              </div>
            </div>
            <PaymentFacts payment={targetPayment} team={data?.team ?? null} />
            {targetPayment && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                <span className="billing-redirect-mono" title={targetPayment.orderId}>Order {shortId(targetPayment.orderId)} · Rp {targetPayment.amount.toLocaleString('id-ID')}</span>
                <button type="button" className="billing-redirect-copy" onClick={() => void handleCopy(targetPayment.orderId)} aria-label="Copy order ID"><Copy size={12} aria-hidden="true" /> {copied ? t('common:copied', { defaultValue: 'Tersalin' }) : 'Copy'}</button>
              </div>
            )}
            <div className="billing-redirect-actions">
              <Button variant="primary" onClick={() => (window.location.href = `/team/${teamId || detailPayment?.teamId || ''}?tab=usage`)}>{t('teams.payment.back', { defaultValue: 'Kembali ke workspace' })}</Button>
            </div>
            <p className="billing-redirect-help">Kwitansi dikirim ke email. Sisa hari dari paket sebelumnya telah ditambahkan.</p>
            {pendingScheduled && (
              <p className="billing-redirect-help" style={{ color: 'var(--status-warn)', marginTop: 8 }}>
                {t('teams.payment.scheduledHelp', {
                  defaultValue: `Downgrade terjadwal ke ${pendingScheduled.name} akan aktif ${new Date(pendingScheduled.activateAt).toLocaleDateString('id-ID')}. Batalkan di Billing.`,
                  name: pendingScheduled.name,
                  date: new Date(pendingScheduled.activateAt).toLocaleDateString('id-ID'),
                })}
              </p>
            )}
          </section>
        )}

        {(data || detailPayment) && displayState === 'failed' && (
          <section className="billing-redirect-card billing-redirect-card--danger" role="alert">
            <WorkspaceEyebrow name={workspaceName} />
            <div className="billing-redirect-hero">
              {renderHeroIcon()}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <h1 id="billing-redirect-title" className="billing-redirect-title">{targetPayment ? targetPayment.packageName : (failedVariant === 'cancelled' ? t('teams.payment.cancelledTitle', { defaultValue: 'Pembayaran dibatalkan' }) : failedVariant === 'expired' ? t('teams.payment.expiredTitle', { defaultValue: 'Masa Pro habis' }) : t('teams.payment.failedTitle', { defaultValue: 'Pembayaran belum berhasil' }))}</h1>
                  <Badge tone="danger" dot>{failedVariant === 'cancelled' ? 'Batal' : 'Gagal'}</Badge>
                  <Badge tone="info">Pro</Badge>
                </div>
                <p className="billing-redirect-subtitle">{failedVariant === 'cancelled' ? t('teams.payment.cancelledDesc', { defaultValue: 'Link pembayaran kadaluarsa.' }) : failedVariant === 'expired' ? t('teams.payment.expiredDesc', { defaultValue: 'Langganan habis. Perpanjang untuk lanjut.' }) : t('teams.payment.failedDesc', { defaultValue: 'Pembayaran belum masuk.' })}</p>
              </div>
            </div>
            <PaymentFacts payment={targetPayment} team={data?.team ?? null} />
            {targetPayment && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                <span className="billing-redirect-mono" title={targetPayment.orderId}>Order {shortId(targetPayment.orderId)} · Rp {targetPayment.amount.toLocaleString('id-ID')}</span>
                <button type="button" className="billing-redirect-copy" onClick={() => void handleCopy(targetPayment.orderId)} aria-label="Copy order ID"><Copy size={12} aria-hidden="true" /> {copied ? t('common:copied', { defaultValue: 'Tersalin' }) : 'Copy'}</button>
              </div>
            )}
            <div className="billing-redirect-actions">
              <Button variant="primary" size="sm" onClick={() => (window.location.href = `/pricing?teamId=${teamId || detailPayment?.teamId || ''}`)}>{t('teams.payment.newPayment', { defaultValue: 'Lihat Paket' })}</Button>
              <Link className="billing-redirect-link" to={`/team/${teamId || detailPayment?.teamId || ''}?tab=usage`}>{t('teams.payment.back', { defaultValue: 'Kembali ke workspace' })}</Link>
            </div>
            <p className="billing-redirect-help">Butuh bantuan? Hubungi admin tim dengan Order ID.</p>
          </section>
        )}
      </main>
    </div>
  );
}
