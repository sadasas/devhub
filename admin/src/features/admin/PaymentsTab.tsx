import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowClockwise, DownloadSimple } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { AdminPayment } from '../../lib/types';
import { downloadCsv, toCsv } from '../../lib/csv';
import { AdminTable } from '../../components/AdminTable';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { FilterBar } from '../../components/FilterBar';
import { InlineError } from '../../components/InlineError';
import { Pager } from '../../components/Pager';
import { Skeleton } from '../../components/Skeleton';
import { formatDateAdmin, formatIdr } from '../../lib/format';

const PAGE_SIZE = 25;

type SortMode = 'newest' | 'oldest' | 'highest' | 'lowest';

interface PaymentsTabProps {
  refreshKey: number;
  onSettled?: () => void;
}

/**
 * TECH-DEBT (Fase 1): /admin/payments belum dukung ?sort server-side
 * (hanya limit/offset/status/teamId). Sorting tanggal/nominal dilakukan
 * client-side di bawah. Bila dataset besar, tambah ?sort=date|amount&dir=
 * di server (mirror ORDER BY) + kirim dari client.
 */
export function PaymentsTab({ refreshKey, onSettled }: PaymentsTabProps) {
  const { t } = useTranslation('extras');

  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get('status') ?? '';
  const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const [payments, setPayments] = useState<AdminPayment[] | null>(null);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Sort client-side (state lokal, tidak masuk URL — konsisten dengan activity range)
  const [sortMode, setSortMode] = useState<SortMode>('newest');

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

  function resetFilters(): void {
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.delete('status');
        n.delete('page');
        return n;
      },
      { replace: true },
    );
    setSortMode('newest');
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

  const sortedPayments = useMemo(() => {
    if (!payments) return null;
    const arr = [...payments];
    switch (sortMode) {
      case 'oldest':
        arr.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
        break;
      case 'highest':
        arr.sort((a, b) => b.amount - a.amount);
        break;
      case 'lowest':
        arr.sort((a, b) => a.amount - b.amount);
        break;
      case 'newest':
      default:
        arr.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        break;
    }
    return arr;
  }, [payments, sortMode]);

  function handleExport(): void {
    if (!sortedPayments || sortedPayments.length === 0) return;
    const csv = toCsv(
      sortedPayments.map((p) => ({
        orderId: p.orderId,
        buyerEmail: p.buyerEmail,
        teamName: p.teamName,
        packageName: p.packageName,
        durationDays: p.durationDays ?? '',
        amount: p.amount,
        status: p.status,
        createdAt: p.createdAt,
        completedAt: p.completedAt ?? '',
      })),
      [
        { key: 'orderId', label: 'orderId' },
        { key: 'buyerEmail', label: 'buyerEmail' },
        { key: 'teamName', label: 'teamName' },
        { key: 'packageName', label: 'packageName' },
        { key: 'durationDays', label: 'durationDays' },
        { key: 'amount', label: 'amount' },
        { key: 'status', label: 'status' },
        { key: 'createdAt', label: 'createdAt' },
        { key: 'completedAt', label: 'completedAt' },
      ],
    );
    downloadCsv(`admin-payments-p${page}`, csv);
  }

  const isFiltered = statusParam !== '';

  return (
    <section className="tab-panel" aria-label={t('admin.payments.aria')}>
      <p role="status" aria-live="polite" className="sr-only">
        {payments === null ? t('admin.loading') : t('admin.payments.count', { count: paymentsTotal })}
      </p>

      <div className="tab-toolbar">
        <span className="tab-toolbar-title">{t('admin.tabs.payments')}</span>
        <span className="tab-toolbar-actions">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<DownloadSimple size={13} aria-hidden="true" />}
            disabled={!sortedPayments || sortedPayments.length === 0}
            onClick={handleExport}
            aria-label={t('admin.export')}
            title={t('admin.export')}
          >
            {t('admin.export')}
          </Button>
        </span>
      </div>

      <FilterBar
        segments={[
          { value: '', label: t('admin.payments.allStatuses') },
          { value: 'completed', label: t('admin.payments.completed') },
          { value: 'pending', label: t('admin.payments.pending') },
        ]}
        selectedSegment={statusParam}
        onSegmentChange={setStatusFilterAtomic}
        segmentsAriaLabel={t('admin.payments.filterStatusAria', { defaultValue: 'Filter status' })}
        selectValue={sortMode}
        onSelectChange={(v) => setSortMode((v as SortMode) ?? 'newest')}
        selectOptions={[
          { value: 'newest', label: t('admin.payments.sortNewest') },
          { value: 'oldest', label: t('admin.payments.sortOldest') },
          { value: 'highest', label: t('admin.payments.sortHighest') },
          { value: 'lowest', label: t('admin.payments.sortLowest') },
        ]}
        selectAriaLabel={t('admin.payments.sortLabel')}
        countText={payments !== null ? t('admin.payments.count', { count: paymentsTotal }) : undefined}
      />

      {error ? (
        <InlineError className="mb-12">
          {error}{' '}
          <Button variant="ghost" size="sm" leftIcon={<ArrowClockwise size={13} aria-hidden="true" />} onClick={() => void loadPayments()}>
            {t('admin.retry')}
          </Button>
        </InlineError>
      ) : payments === null ? (
        <div role="status" aria-busy="true" aria-label="Loading payments">
          <span className="sr-only">Loading payments…</span>
          <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="data-row" style={{ height: 56 }}>
                <div className="data-row-main" style={{ gap: 6 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Skeleton style={{ width: '40%', height: 14 }} />
                    <Skeleton style={{ width: 48, height: 18, borderRadius: 6 }} />
                  </div>
                  <Skeleton style={{ width: '70%', height: 11, opacity: 0.8 }} />
                </div>
                <Skeleton style={{ width: 56, height: 11, borderRadius: 999 }} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <AdminTable<AdminPayment>
            caption={t('admin.payments.aria')}
            columns={[
              {
                key: 'buyer',
                label: t('admin.payments.buyer'),
                render: (p) => (
                  <span className="cell-stack">
                    <span className="data-row-title">
                      <span className="row-title-text" title={p.buyerEmail}>
                        {p.buyerEmail}
                      </span>
                      <Badge tone={p.status === 'completed' ? 'success' : 'warn'} dot>
                        {p.status === 'completed' ? t('admin.payments.paid') : t('admin.payments.pending')}
                      </Badge>
                    </span>
                    <span className="data-row-meta">
                      {p.teamName} · {p.packageName}
                    </span>
                  </span>
                ),
              },
              {
                key: 'amount',
                label: t('admin.payments.amount'),
                align: 'right',
                numeric: true,
                render: (p) => (
                  <span className="cell-stack" style={{ alignItems: 'flex-end' }}>
                    {/* Nominal kolom kanan + tanggal di bawah */}
                    <span className="tabular" style={{ fontWeight: 600 }}>
                      {formatIdr(p.amount)}
                    </span>
                    <span className="data-row-meta" style={{ justifyContent: 'flex-end' }}>
                      {formatDateAdmin(p.createdAt)}
                    </span>
                  </span>
                ),
              },
            ]}
            rows={sortedPayments ?? []}
            getRowId={(p) => p.id}
            isFiltered={isFiltered}
            emptyFilteredTitle={t('admin.payments.emptyTitle')}
            emptyFilteredDesc={t('admin.payments.emptyFiltered')}
            emptyTotalTitle={t('admin.payments.emptyTitle')}
            emptyTotalDesc={t('admin.payments.emptyDesc')}
            onResetFilters={resetFilters}
          />
          <Pager
            page={page}
            totalPages={totalPages}
            totalItems={paymentsTotal}
            pageSize={PAGE_SIZE}
            onPageChange={(p) => updateParam('page', String(p))}
            ariaLabel={t('admin.payments.paginationAria')}
          />
        </>
      )}
    </section>
  );
}
