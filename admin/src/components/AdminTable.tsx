import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

export type AdminAlign = 'left' | 'right' | 'center';

export interface AdminColumn<T> {
  key: string;
  label: string;
  align?: AdminAlign;
  /** Kolom angka: tabular + rata-kanan otomatis */
  numeric?: boolean;
  sortable?: boolean;
  render: (row: T) => ReactNode;
}

interface AdminTableProps<T> {
  /** Caption untuk screen reader (wajib, i18n) */
  caption: string;
  columns: Array<AdminColumn<T>>;
  rows: T[];
  getRowId: (row: T) => string;
  /** Menu ⋯ per baris (opsional). Render di kolom terakhir tanpa header label. */
  rowMenu?: (row: T) => ReactNode;
  rowMenuLabel?: string;
  /** Sort state (server-side tanggal/nominal bisa client-sort — lihat PaymentsTab) */
  sortKey?: string | null;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  /** Empty: bedakan filter-kosong vs kosong-total */
  isFiltered: boolean;
  emptyFilteredTitle: string;
  emptyFilteredDesc?: string;
  emptyTotalTitle: string;
  emptyTotalDesc?: string;
  onResetFilters?: () => void;
  /** Baris dim (Opsi B: harga nonaktif = baris dim + badge netral) */
  getRowDimmed?: (row: T) => boolean;
  /** aria-label untuk tabel (default: caption) */
  ariaLabel?: string;
}

/** AdminTable<T> generik (Fase 1).
 *  - <table> semantik + wrapper overflow-x:auto untuk 390px
 *  - thead sticky, angka tabular rata-kanan, aria-sort
 *  - Empty bedakan filter-kosong vs kosong-total + aksi reset filter
 */
export function AdminTable<T>({
  caption,
  columns,
  rows,
  getRowId,
  rowMenu,
  rowMenuLabel,
  sortKey,
  sortDir,
  onSort,
  isFiltered,
  emptyFilteredTitle,
  emptyFilteredDesc,
  emptyTotalTitle,
  emptyTotalDesc,
  onResetFilters,
  getRowDimmed,
  ariaLabel,
}: AdminTableProps<T>) {
  const { t } = useTranslation('extras');

  if (rows.length === 0) {
    const title = isFiltered ? emptyFilteredTitle : emptyTotalTitle;
    const desc = isFiltered ? emptyFilteredDesc : emptyTotalDesc;
    return (
      <EmptyState
        icon={<span aria-hidden="true" />}
        title={title}
        description={desc}
        action={
          isFiltered && onResetFilters ? (
            <Button variant="ghost" size="sm" onClick={onResetFilters}>
              {t('admin.resetFilters')}
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="admin-table-wrap">
      <table className="admin-table" aria-label={ariaLabel ?? caption}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((col) => {
              const align = col.align ?? (col.numeric ? 'right' : 'left');
              const isSorted = sortKey === col.key;
              const ariaSort: 'none' | 'ascending' | 'descending' | undefined = col.sortable
                ? isSorted
                  ? sortDir === 'desc'
                    ? 'descending'
                    : 'ascending'
                  : 'none'
                : undefined;
              return (
                <th
                  key={col.key}
                  scope="col"
                  className={`${align === 'right' ? 'align-right num' : align === 'center' ? 'align-center' : ''}`}
                  aria-sort={ariaSort}
                >
                  {col.sortable && onSort ? (
                    <button
                      type="button"
                      className="th-sort-btn"
                      onClick={() => onSort(col.key)}
                      aria-label={t('admin.table.sortBy', { label: col.label })}
                    >
                      {col.label}
                      <span className="th-sort-ind" aria-hidden="true">
                        {isSorted ? (sortDir === 'desc' ? '▼' : '▲') : '↕'}
                      </span>
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              );
            })}
            {rowMenu && (
              <th scope="col" className="align-right">
                <span className="sr-only">{rowMenuLabel ?? t('admin.table.rowActions')}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const dim = getRowDimmed?.(row) ?? false;
            return (
              <tr key={getRowId(row)} className={dim ? 'is-dim' : undefined}>
                {columns.map((col) => {
                  const align = col.align ?? (col.numeric ? 'right' : 'left');
                  return (
                    <td
                      key={col.key}
                      className={`${align === 'right' ? 'align-right num tabular' : align === 'center' ? 'align-center' : ''}${col.numeric ? ' num tabular' : ''}`}
                    >
                      {col.render(row)}
                    </td>
                  );
                })}
                {rowMenu && <td className="align-right">{rowMenu(row)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
