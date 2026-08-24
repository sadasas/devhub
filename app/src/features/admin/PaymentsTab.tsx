import { useCallback, useEffect, useState } from 'react';
import { Receipt } from '@phosphor-icons/react';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { AdminPayment } from '../../lib/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { Skeleton } from '../../components/Skeleton';
import { formatIdr } from './charts';

const PAGE_SIZE = 50;

export function PaymentsTab({ refreshKey }: { refreshKey: number }) {
  const [payments, setPayments] = useState<AdminPayment[] | null>(null);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const loadPayments = useCallback(
    async (status: string) => {
      setError(null);
      try {
        const res = await api.listAdminPayments({ limit: PAGE_SIZE, status: status || undefined });
        setPayments(res.payments);
        setPaymentsTotal(res.total);
      } catch (err) {
        setPayments([]);
        setError(getErrorMessage(err, 'Failed to load payments'));
      }
    },
    [],
  );

  useEffect(() => {
    setPayments(null);
    void loadPayments(statusFilter);
  }, [statusFilter, refreshKey, loadPayments]);

  return (
    <section className="tab-panel" role="tabpanel" aria-label="Platform payments">
      <div className="admin-filter-bar">
        <select
          className="select"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPayments(null);
          }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
        </select>
        <span className="page-subtitle">
          {payments !== null ? `${paymentsTotal} payment${paymentsTotal === 1 ? '' : 's'}` : ''}
        </span>
      </div>

      {payments === null && !error ? (
        <>
          <Skeleton style={{ width: '100%', height: 48 }} />
          <Skeleton style={{ width: '100%', height: 48, marginTop: 8 }} />
          <Skeleton style={{ width: '100%', height: 48, marginTop: 8 }} />
        </>
      ) : error ? (
        <InlineError className="mb-12">
          {error}{' '}
          <Button variant="ghost" size="sm" onClick={() => void loadPayments(statusFilter)}>
            Retry
          </Button>
        </InlineError>
      ) : payments?.length === 0 ? (
        <EmptyState
          icon={<Receipt size={22} />}
          title="No payments yet"
          description="Completed and pending payments will appear here."
        />
      ) : (
        <div className="admin-payment-table">
          <div className="admin-payment-header">
            <span>Date</span>
            <span>Buyer</span>
            <span>Team</span>
            <span>Package</span>
            <span style={{ textAlign: 'right' }}>Amount</span>
            <span>Status</span>
          </div>
          {payments!.map((p) => (
            <div key={p.id} className="admin-payment-row">
              <span className="admin-payment-date">
                {new Date(p.createdAt).toLocaleDateString()}
              </span>
              <span className="admin-payment-buyer" title={p.buyerEmail}>
                {p.buyerEmail}
              </span>
              <span className="admin-payment-team" title={p.teamName}>
                {p.teamName}
              </span>
              <span>{p.packageName}</span>
              <span className="admin-payment-amount">{formatIdr(p.amount)}</span>
              <Badge tone={p.status === 'completed' ? 'success' : 'neutral'}>
                {p.status === 'completed' ? 'Paid' : 'Pending'}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
