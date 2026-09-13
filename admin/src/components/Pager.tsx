import { useTranslation } from 'react-i18next';
import { CaretLeft, CaretRight } from '@phosphor-icons/react';
import { Button } from './Button';

interface PagerProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  ariaLabel: string;
}

/** Pager bernomor (Fase 1): "Showing x of y" + prev/next/numbered.
 *  Mengganti pager sederhana existing di Users/Payments/Teams.
 */
export function Pager({ page, totalPages, totalItems, pageSize, onPageChange, ariaLabel }: PagerProps) {
  const { t } = useTranslation('extras');

  if (totalItems <= 0 || totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  // Window 5 halaman di sekitar current (tanpa lodash)
  function pageWindow(): Array<number | '…'> {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const set = new Set<number>([1, 2, page - 1, page, page + 1, totalPages - 1, totalPages]);
    const nums = [...set].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
    const out: Array<number | '…'> = [];
    let prev = 0;
    for (const n of nums) {
      if (n - prev > 1) out.push('…');
      out.push(n);
      prev = n;
    }
    return out;
  }

  return (
    <nav className="pager-numbered" aria-label={ariaLabel}>
      <span className="pager-showing tabular">
        {t('admin.pager.showing', { from, to, total: totalItems })}
      </span>
      <Button
        size="sm"
        variant="ghost"
        leftIcon={<CaretLeft size={12} aria-hidden="true" />}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label={t('admin.pager.previous')}
        title={t('admin.pager.previous')}
      >
        {t('admin.pager.previous')}
      </Button>
      <span className="pager-pages" role="group" aria-label={ariaLabel}>
        {pageWindow().map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="pager-ellipsis" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className="pager-num"
              aria-current={p === page ? 'page' : undefined}
              aria-label={t('admin.pager.goToPage', { page: p })}
              disabled={p === page}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          ),
        )}
      </span>
      <Button
        size="sm"
        variant="ghost"
        leftIcon={<CaretRight size={12} aria-hidden="true" />}
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label={t('admin.pager.next')}
        title={t('admin.pager.next')}
      >
        {t('admin.pager.next')}
      </Button>
    </nav>
  );
}
