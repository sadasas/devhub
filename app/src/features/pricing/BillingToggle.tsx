import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { BillingPackage, PackagePrice } from '../../lib/types';

function savingsPercent(original: number, discounted: number): number {
  return Math.round(((original - discounted) / original) * 100);
}

function monthlyEquivalent(price: PackagePrice): number {
  const months = price.durationDays / 30;
  return Math.round(price.priceIdr / months);
}

function bestSavings(prices: PackagePrice[]): number | null {
  let max = 0;
  for (const p of prices) {
    if (p.originalPriceIdr != null && p.originalPriceIdr > p.priceIdr) {
      const s = savingsPercent(p.originalPriceIdr, p.priceIdr);
      if (s > max) max = s;
    }
  }
  return max > 0 ? max : null;
}

type BillingToggleProps = {
  packages: BillingPackage[];
  value: number | null;
  onChange: (durationDays: number) => void;
};

function getDurations(packages: BillingPackage[]): PackagePrice[] {
  const map = new Map<number, PackagePrice>();
  for (const pkg of packages) {
    if (pkg.isFree) continue;
    for (const pr of pkg.prices) {
      if (!map.has(pr.durationDays)) map.set(pr.durationDays, pr);
    }
  }
  return [...map.values()].sort((a, b) => a.durationDays - b.durationDays);
}

function formatDurationShort(days: number, t: (k: string, o?: Record<string, unknown>) => string): string {
  const months = Math.round(days / 30);
  return t('pricing.durationMonths', { count: months });
}

export function BillingToggle({ packages, value, onChange }: BillingToggleProps) {
  const { t } = useTranslation('extras');
  const durations = getDurations(packages);
  const groupRef = useRef<HTMLDivElement>(null);

  const selectedDuration = value ?? durations[0]?.durationDays ?? null;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!groupRef.current) return;
      const buttons = [...groupRef.current.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
      const idx = buttons.findIndex((b) => b.getAttribute('aria-checked') === 'true');
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const next = (idx + dir + buttons.length) % buttons.length;
        const target = buttons[next];
        target?.focus();
        const days = target?.dataset.durationDays;
        if (days) onChange(Number(days));
      } else if (e.key === 'Home') {
        e.preventDefault();
        buttons[0]?.focus();
        const days = buttons[0]?.dataset.durationDays;
        if (days) onChange(Number(days));
      } else if (e.key === 'End') {
        e.preventDefault();
        const last = buttons[buttons.length - 1];
        last?.focus();
        const days = last?.dataset.durationDays;
        if (days) onChange(Number(days));
      }
    },
    [onChange],
  );

  if (durations.length <= 1) return null;

  function savingsForDuration(days: number): number | null {
    let max: number | null = null;
    for (const pkg of packages) {
      if (pkg.isFree) continue;
      const pr = pkg.prices.find((p) => p.durationDays === days);
      if (pr?.originalPriceIdr != null && pr.originalPriceIdr > pr.priceIdr) {
        const s = savingsPercent(pr.originalPriceIdr, pr.priceIdr);
        if (max == null || s > max) max = s;
      }
    }
    if (max == null && durations.length === 2) {
      const monthly = packages
        .flatMap((p) => p.prices)
        .find((p) => p.durationDays === durations[0]?.durationDays);
      const yearly = packages
        .flatMap((p) => p.prices)
        .find((p) => p.durationDays === days && p.durationDays !== monthly?.durationDays);
      if (monthly && yearly) {
        const monthlyTotal = monthly.priceIdr * (days / monthly.durationDays);
        if (monthlyTotal > yearly.priceIdr) {
          return savingsPercent(Math.round(monthlyTotal), yearly.priceIdr);
        }
      }
    }
    return max;
  }

  return (
    <div className="pricing-billing-toggle" role="region" aria-label={t('pricing.billingToggleAria')}>
      <div
        ref={groupRef}
        className="segmented"
        role="radiogroup"
        aria-label={t('pricing.billingGroupAria')}
        onKeyDown={handleKeyDown}
      >
        {durations.map((d) => {
          const isActive = selectedDuration === d.durationDays;
          const sav = savingsForDuration(d.durationDays);
          const monthlyEq = monthlyEquivalent(d);
          const isYearly = d.durationDays > 60;
          const billingLabel = isYearly ? t('pricing.billing.yearly') : t('pricing.billing.monthly');
          return (
            <button
              key={d.durationDays}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={
                isYearly && sav
                  ? `${billingLabel} — ${t('pricing.savings', { percent: sav })}`
                  : billingLabel
              }
              data-duration-days={d.durationDays}
              tabIndex={isActive ? 0 : -1}
              className={`segmented-btn${isActive ? ' segmented-btn-active' : ''}`}
              onClick={() => onChange(d.durationDays)}
            >
              <span className="segmented-label">
                {isYearly ? t('pricing.billing.yearly') : t('pricing.billing.monthly')}
                <span className="segmented-sub">
                  {isYearly ? ` · Rp ${monthlyEq.toLocaleString('id-ID')}/bln` : ` · ${formatDurationShort(d.durationDays, t)}`}
                </span>
              </span>
              {sav != null && sav > 0 && isYearly && (
                <span className="segmented-badge">{t('pricing.savings', { percent: sav })}</span>
              )}
            </button>
          );
        })}
      </div>
      {bestSavings(packages.flatMap((p) => p.prices)) && (
        <p className="pricing-billing-hint">{t('pricing.billingHint')}</p>
      )}
    </div>
  );
}
