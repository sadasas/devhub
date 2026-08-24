import { useEffect, useState } from 'react';
import { ArrowLeft, Receipt } from '@phosphor-icons/react';
import { useNavigate } from 'react-router';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { PaymentHistoryItem } from '../../lib/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';

function formatIdr(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

const STATUS_BADGE: Record<string, { tone: 'success' | 'neutral' | 'danger'; label: string }> = {
  completed: { tone: 'success', label: 'Paid' },
  pending: { tone: 'neutral', label: 'Pending' },
  cancelled: { tone: 'danger', label: 'Cancelled' },
};

export function PaymentHistoryPage() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<PaymentHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  const load = () => {
    api
      .paymentHistory()
      .then((res) => setPayments(res.payments))
      .catch((err) => setError(getErrorMessage(err, 'Failed to load payment history.')));
  };

  useEffect(() => {
    load();
  }, []);

  async function onResume(orderId: string) {
    setActionError(null);
    setBusyOrderId(orderId);
    try {
      const res = await api.resumePayment(orderId);
      window.location.assign(res.url);
    } catch (err) {
      setActionError(getErrorMessage(err, 'Gagal melanjutkan pembayaran.'));
      setBusyOrderId(null);
    }
  }

  async function onCancel(orderId: string) {
    setActionError(null);
    setBusyOrderId(orderId);
    try {
      await api.cancelPayment(orderId);
      setPayments((prev) =>
        prev ? prev.map((p) => (p.orderId === orderId ? { ...p, status: 'cancelled' } : p)) : prev,
      );
    } catch (err) {
      setActionError(getErrorMessage(err, 'Gagal membatalkan pembayaran.'));
    } finally {
      setBusyOrderId(null);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <button type="button" className="back-btn" onClick={() => navigate('/')}>
            <ArrowLeft size={14} aria-hidden="true" /> Back
          </button>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            Payment History
          </h1>
          <p className="page-subtitle">All payments you have made across workspaces.</p>
        </div>
      </header>

      {error && <InlineError>{error}</InlineError>}
      {actionError && <InlineError>{actionError}</InlineError>}

      {payments === null && !error ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} style={{ width: '100%', height: 48 }} />
          ))}
        </div>
      ) : payments?.length === 0 ? (
        <EmptyState
          icon={<Receipt size={20} />}
          title="No payments yet"
          description="Completed payments for your workspaces will appear here."
        />
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {payments!.map((p) => {
            const badge = STATUS_BADGE[p.status] ?? { tone: 'neutral' as const, label: p.status };
            const busy = busyOrderId === p.orderId;
            return (
              <div key={p.orderId} className="data-row">
                <div className="data-row-main">
                  <span className="data-row-title">
                    <span className="row-title-text">{formatIdr(p.amount)}</span>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </span>
                  <span className="data-row-meta">
                    {p.teamName} · {p.packageName}
                    {p.durationDays ? ` · ${p.durationDays} days` : ''} ·{' '}
                    {new Date(p.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {p.status === 'pending' && (
                  <div className="data-row-side">
                    <Button
                      size="sm"
                      variant="primary"
                      loading={busy}
                      onClick={() => void onResume(p.orderId)}
                    >
                      Lanjutkan pembayaran
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void onCancel(p.orderId)}
                    >
                      Batalkan
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
