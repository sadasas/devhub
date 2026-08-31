import { useCallback, useEffect, useRef, useState } from 'react';
import { CaretLeft, CaretRight, Receipt } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { AdminPayment } from '../../lib/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { Skeleton } from '../../components/Skeleton';
import { formatDateAdmin, formatIdr } from '../../lib/format';

const PAGE_SIZE = 25;

interface PaymentsTabProps {
  refreshKey: number;
  onSettled?: () => void;
}

export function PaymentsTab({ refreshKey, onSettled }: PaymentsTabProps) {
  const { t } = useTranslation('extras');

  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get('status') ?? '';
  const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const [payments, setPayments] = useState<AdminPayment[] | null>(null);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const latestRequest = useRef(0);

  function updateParam(key: string, value: string | null): void {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  }

  function setStatusFilterAtomic(nextStatus: string | null): void {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (nextStatus) n.set('status', nextStatus);
        else n.delete('status');
        n.delete('page');
        return n;
      },
      { replace: true },
    );
  }

  const loadPayments = useCallback(async () => {
    const requestId = ++latestRequest.current;
    try {
      const res = await api.listAdminPayments({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        status: statusParam || undefined,
      });
      if (latestRequest.current !== requestId) return;
      setPayments(res.payments);
      setPaymentsTotal(res.total);
      setError(null);
    } catch (err) {
      if (latestRequest.current !== requestId) return;
      setError(getErrorMessage(err, t('admin.payments.errors.load')));
    } finally {
      if (latestRequest.current === requestId) onSettled?.();
    }
  }, [statusParam, page, t, onSettled]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(paymentsTotal / PAGE_SIZE));

  useEffect(() => {
    if (error === null && paymentsTotal > 0 && page > totalPages) {
      updateParam('page', String(totalPages));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentsTotal, page, totalPages]);

  return (
    <section className="tab-panel" aria-label={t('admin.payments.aria')}>
      <p role="status" aria-live="polite" className="sr-only">
        {payments === null ? t('admin.loading') : t('admin.payments.count', { count: paymentsTotal })}
      </p>
      <div className="admin-filter-bar">
        <span className="admin-activity-ranges" role="radiogroup" aria-label={t('admin.payments.filterStatusAria', { defaultValue: 'Filter status' })}>
          <button type="button" role="radio" aria-checked={statusParam === ''} className={`sub-tab ${statusParam === '' ? 'sub-tab-active' : ''}`} tabIndex={statusParam === '' ? 0 : -1} onClick={() => setStatusFilterAtomic(null)}>{t('admin.payments.allStatuses')}</button>
          <button type="button" role="radio" aria-checked={statusParam === 'completed'} className={`sub-tab ${statusParam === 'completed' ? 'sub-tab-active' : ''}`} tabIndex={statusParam === 'completed' ? 0 : -1} onClick={() => setStatusFilterAtomic('completed')}>{t('admin.payments.completed')}</button>
          <button type="button" role="radio" aria-checked={statusParam === 'pending'} className={`sub-tab ${statusParam === 'pending' ? 'sub-tab-active' : ''}`} tabIndex={statusParam === 'pending' ? 0 : -1} onClick={() => setStatusFilterAtomic('pending')}>{t('admin.payments.pending')}</button>
        </span>
        <span className="page-subtitle admin-filter-count">
          {payments !== null ? t('admin.payments.count', { count: paymentsTotal }) : ''}
        </span>
      </div>

      {error ? (
        <InlineError className="mb-12">
          {error}{' '}
          <Button variant="secondary" size="sm" onClick={() => void loadPayments()}>
            {t('admin.retry')}
          </Button>
        </InlineError>
      ) : payments === null ? (
        <>
          <Skeleton style={{ width: '100%', height: 48 }} />
          <Skeleton style={{ width: '100%', height: 48, marginTop: 8 }} />
          <Skeleton style={{ width: '100%', height: 48, marginTop: 8 }} />
        </>
      ) : payments.length === 0 ? (
        <EmptyState
          icon={<Receipt size={22} aria-hidden="true" />}
          title={t('admin.payments.emptyTitle')}
          description={t('admin.payments.emptyDesc')}
        />
      ) : (
        <>
          <div className="data-list">
            {payments.map((p) => (
              <div key={p.id} className="data-row">
                <div className="data-row-main">
                  <span className="data-row-title">
                    <span className="row-title-text" title={p.buyerEmail}>{p.buyerEmail}</span>
                    <Badge tone={p.status === 'completed' ? 'success' : 'warn'} dot>
                      {p.status === 'completed' ? t('admin.payments.paid') : t('admin.payments.pending')}
                    </Badge>
                  </span>
                  <span className="data-row-meta">
                    {p.teamName} · {p.packageName} · {formatIdr(p.amount)} ·{' '}
                    {formatDateAdmin(p.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <nav className="pager" aria-label={t('admin.payments.paginationAria')}>
              <Button
                size="sm"
                variant="secondary" leftIcon={<CaretLeft size={12} aria-hidden="true" />} disabled={page <= 1}
                onClick={() => updateParam('page', String(page - 1))}
              >
                {t('admin.pager.previous')}
              </Button>
              <span className="pager-status">{t('admin.pager.status', { page, total: totalPages })}</span>
              <Button
                size="sm"
                variant="secondary" leftIcon={<CaretRight size={12} aria-hidden="true" />} disabled={page >= totalPages}
                onClick={() => updateParam('page', String(page + 1))}
              >
                {t('admin.pager.next')}
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}


