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

function Amount({ amount, className = '' }: { amount: number; className?: string }) {
  const formatted = `Rp ${amount.toLocaleString('id-ID')}`;
  return (
    <span className={`billing-amount tabular ${className}`.trim()}>{formatted}</span>
  );
}

interface MetaProps {
  teamName: string;
  packageName: string;
  durationDays: number | null;
  createdAt: string;
  completedAt?: string | null;
  daysLabel?: (count: number) => string;
  formatDate?: (iso: string) => string;
  className?: string;
}

function Meta({
  teamName,
  packageName,
  durationDays,
  createdAt,
  completedAt,
  daysLabel,
  formatDate,
  className = '',
}: MetaProps) {
  return (
    <div className={`billing-meta ${className}`.trim()}>
      <span>{teamName}</span>
      <span aria-hidden="true" className="billing-meta-dot">
        ·
      </span>
      <strong>{packageName}</strong>
      {durationDays != null && daysLabel && (
        <>
          <span aria-hidden="true" className="billing-meta-dot">
            ·
          </span>
          <span>{daysLabel(durationDays)}</span>
        </>
      )}
      <span aria-hidden="true" className="billing-meta-dot">
        ·
      </span>
      <time dateTime={createdAt} className="billing-date">
        {formatDate ? formatDate(createdAt) : createdAt}
      </time>
      {completedAt && (
        <>
          <span aria-hidden="true">→</span>
          <time dateTime={completedAt} className="billing-date">
            {formatDate ? formatDate(completedAt) : completedAt}
          </time>
        </>
      )}
    </div>
  );
}

function Actions({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`billing-actions ${className}`.trim()}>{children}</div>;
}

function Empty({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`billing-empty ${className}`.trim()}>{children}</div>;
}

export const BillingLedger = Object.assign(Root, {
  Row,
  Main,
  Head,
  Amount,
  Meta,
  Actions,
  Empty,
});
