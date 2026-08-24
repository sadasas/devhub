import { useCallback, useEffect, useState } from 'react';
import { Receipt } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('extras');
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
        setError(getErrorMessage(err, t('admin.payments.errors.load')));
      }
    },
    [t],
  );

  useEffect(() => {
    setPayments(null);
    void loadPayments(statusFilter);
  }, [statusFilter, refreshKey, loadPayments]);

  return (
    <section className="tab-panel" role="tabpanel" aria-label={t('admin.payments.aria')}>
      <div className="admin-filter-bar">
        <select
          className="select"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPayments(null);
          }}
          aria-label={t('admin.payments.filterStatusAria')}
        >
          <option value="">{t('admin.payments.allStatuses')}</option>
          <option value="completed">{t('admin.payments.completed')}</option>
          <option value="pending">{t('admin.payments.pending')}</option>
        </select>
        <span className="page-subtitle">
          {payments !== null ? t('admin.payments.count', { count: paymentsTotal }) : ''}
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
            {t('admin.retry')}
          </Button>
        </InlineError>
      ) : payments?.length === 0 ? (
        <EmptyState
          icon={<Receipt size={22} />}
          title={t('admin.payments.emptyTitle')}
          description={t('admin.payments.emptyDesc')}
        />
      ) : (
        <div className="admin-payment-table">
          <div className="admin-payment-header">
            <span>{t('admin.payments.date')}</span>
            <span>{t('admin.payments.buyer')}</span>
            <span>{t('admin.payments.team')}</span>
            <span>{t('admin.payments.package')}</span>
            <span style={{ textAlign: 'right' }}>{t('admin.payments.amount')}</span>
            <span>{t('admin.payments.status')}</span>
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
                {p.status === 'completed' ? t('admin.payments.paid') : t('admin.payments.pending')}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
