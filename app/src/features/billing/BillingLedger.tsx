import { forwardRef } from 'react';
import type { ReactNode, HTMLAttributes, LiHTMLAttributes } from 'react';

interface LedgerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

function Root({ children, className = '', ...rest }: LedgerProps) {
  return (
    <div className={`billing-ledger ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

interface RowProps extends LiHTMLAttributes<HTMLLIElement> {
  children: ReactNode;
}

const Row = forwardRef<HTMLLIElement, RowProps>(function Row(
  { children, className = '', ...rest },
  ref,
) {
  return (
    <li ref={ref} className={`billing-row ${className}`.trim()} {...rest}>
      {children}
    </li>
  );
});

function Main({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`billing-main ${className}`.trim()}>{children}</div>;
}

function Head({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`billing-row-head ${className}`.trim()}>{children}</div>;
}

import { formatIdr } from '../../lib/format';

function Amount({ amount, locale = 'id-ID', className = '' }: { amount: number; locale?: string; className?: string }) {
  return (
    <span className={`billing-amount ${className}`.trim()}>{formatIdr(amount, locale)}</span>
  );
}

interface MetaProps {
  createdAt: string;
  orderId?: string | null;
  expiredSuffix?: string | null;
  formatDate?: (iso: string) => string;
  className?: string;
}

/* Wireframe E: baris ramping — meta hanya tanggal · #order (+ suffix kedaluwarsa).
   Judul "Paket — Tim · Nominal" dirender di Head oleh pemanggil. */
function Meta({
  createdAt,
  orderId,
  expiredSuffix,
  formatDate,
  className = '',
}: MetaProps) {
  return (
    <div className={`billing-meta ${className}`.trim()}>
      <time dateTime={createdAt} className="billing-date">
        {formatDate ? formatDate(createdAt) : createdAt}
      </time>
      {orderId && (
        <>
          <span aria-hidden="true" className="billing-meta-dot">
            ·
          </span>
          <span className="billing-order" title={orderId}>
            #{orderId.slice(0, 8)}
          </span>
        </>
      )}
      {expiredSuffix && (
        <>
          <span aria-hidden="true" className="billing-meta-dot">
            ·
          </span>
          <span>{expiredSuffix}</span>
        </>
      )}
    </div>
  );
}

function Actions({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`billing-actions ${className}`.trim()}>{children}</div>;
}

export const BillingLedger = Object.assign(Root, {
  Row,
  Main,
  Head,
  Amount,
  Meta,
  Actions,
});
