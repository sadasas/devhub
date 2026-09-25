import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { BillingPackage, PackagePrice } from '../../lib/types';
import { formatIdr } from '../../lib/format';

function savingsPercent(original: number, discounted: number): number {
  return Math.round(((original - discounted) / original) * 100);
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
      const cur = map.get(pr.durationDays);
      // Simpan harga termurah per durasi (anti-salah: dari DB, bukan hardcode).
      if (!cur || pr.priceIdr < cur.priceIdr) map.set(pr.durationDays, pr);
    }
  }
  return [...map.values()].sort((a, b) => a.durationDays - b.durationDays);
}

/** Durasi Best value: 90 hari bila ada; else diskon terbesar; else tengah. */
function bestValueDuration(durations: PackagePrice[], packages: BillingPackage[]): number | null {
  if (durations.length === 0) return null;
  if (durations.some((d) => d.durationDays === 90)) return 90;
  let best: { days: number; sav: number } | null = null;
  for (const d of durations) {
    let max = 0;
    for (const pkg of packages) {
      if (pkg.isFree) continue;
      const pr = pkg.prices.find((p) => p.durationDays === d.durationDays);
      if (pr?.originalPriceIdr != null && pr.originalPriceIdr > pr.priceIdr) {
        const s = savingsPercent(pr.originalPriceIdr, pr.priceIdr);
        if (s > max) max = s;
      }
    }
    if (best == null || max > best.sav) best = { days: d.durationDays, sav: max };
  }
  if (best && best.sav > 0) return best.days;
  return durations[Math.floor(durations.length / 2)]?.durationDays ?? null;
}

export function BillingToggle({ packages, value, onChange }: BillingToggleProps) {
  const { t, i18n } = useTranslation('extras');
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

  const bestDays = bestValueDuration(durations, packages);
  const isId = i18n.resolvedLanguage === 'id';

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
    if (max == null && durations.length >= 2) {
      const base = durations[0];
      if (base && days !== base.durationDays) {
        const monthlyTotal = base.priceIdr * (days / base.durationDays);
        const cur = durations.find((d) => d.durationDays === days);
        if (cur && monthlyTotal > cur.priceIdr) {
          return savingsPercent(Math.round(monthlyTotal), cur.priceIdr);
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
          const isBest = bestDays === d.durationDays;
          const daysLabel = isId ? `${d.durationDays} hari` : `${d.durationDays} days`;
          const ariaLabel = isBest
            ? `${daysLabel} — ${formatIdr(d.priceIdr)} — ${t('pricing.bestValue', { defaultValue: 'Best value' })}${sav ? ` — ${t('pricing.savings', { percent: sav })}` : ''}`
            : sav
              ? `${daysLabel} — ${formatIdr(d.priceIdr)} — ${t('pricing.savings', { percent: sav })}`
              : `${daysLabel} — ${formatIdr(d.priceIdr)}`;
          return (
            <button
              key={d.durationDays}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={ariaLabel}
              data-duration-days={d.durationDays}
              tabIndex={isActive ? 0 : -1}
              className={`segmented-btn${isActive ? ' segmented-btn-active' : ''}`}
              onClick={() => onChange(d.durationDays)}
            >
              <span className="segmented-label">
                {daysLabel}
                <span className="segmented-sub"> · {formatIdr(d.priceIdr)}</span>
              </span>
              {isBest && (
                <span className="segmented-badge">Best value</span>
              )}
              {!isBest && sav != null && sav > 0 && (
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
