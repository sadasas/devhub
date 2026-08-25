import { Check, Star, Infinity as InfinityIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { BillingPackage, PackagePrice } from '../../lib/types';
import { Button } from '../../components/Button';

function formatIdr(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

type TFunc = (key: string, opts?: Record<string, unknown>) => string;

function formatDuration(t: TFunc, days: number): string {
  const months = Math.round(days / 30);
  return t('pricing.durationMonths', { count: months });
}

function savingsPercent(original: number, discounted: number): number {
  return Math.round(((original - discounted) / original) * 100);
}

function computeBenefits(t: TFunc, pkg: BillingPackage): string[] {
  const benefits: string[] = [];
  if (pkg.maxMembers === null) {
    benefits.push(t('pricing.benefits.unlimitedMembers'));
  } else {
    benefits.push(t('pricing.benefits.members', { n: pkg.maxMembers }));
  }
  if (pkg.maxProjects === null) {
    benefits.push(t('pricing.benefits.unlimitedProjects'));
  } else {
    benefits.push(t('pricing.benefits.projects', { n: pkg.maxProjects }));
  }
  return benefits;
}

const STATIC_BENEFIT_KEYS = [
  'pricing.benefits.coreFeatures',
  'pricing.benefits.exportJson',
  'pricing.benefits.prioritySupport',
] as const;

type PricingCardProps = {
  pkg: BillingPackage;
  isFeatured?: boolean;
  selectedPrice: PackagePrice | null;
  onBuy: (priceId: string) => void;
  busy: boolean;
  anyBusy: boolean;
  disabledReason?: string | null;
  actionError?: string | null;
  variant?: 'default' | 'free';
};

export function PricingCard({
  pkg,
  isFeatured = false,
  selectedPrice,
  onBuy,
  busy,
  anyBusy,
  disabledReason,
  actionError,
}: PricingCardProps) {
  const { t } = useTranslation('extras');
  const benefits = computeBenefits(t, pkg);
  const isFree = pkg.isFree || pkg.prices.length === 0;
  const primaryPrice = selectedPrice ?? pkg.prices[0] ?? null;
  const hasDiscount =
    primaryPrice?.originalPriceIdr != null && primaryPrice.originalPriceIdr > primaryPrice.priceIdr;

  return (
    <section
      className={`pricing-card${isFeatured ? ' pricing-card-pro pricing-card-featured' : ''}${isFree ? ' pricing-card-free' : ''}`}
      aria-label={t('pricing.planAria', { name: pkg.name })}
      data-featured={isFeatured || undefined}
    >
      {isFeatured && (
        <div className="pricing-badge-pro" aria-hidden="true">
          <Star size={11} weight="fill" /> {t('pricing.recommended')}
        </div>
      )}

      <div className="pricing-card-head">
        <h2 className="pricing-plan-name">
          {pkg.name}
          {isFeatured && <InfinityIcon size={16} weight="bold" aria-hidden="true" className="pricing-plan-icon" />}
        </h2>
        {pkg.description && <p className="pricing-plan-desc">{pkg.description}</p>}
      </div>

      {/* Price block — mono editorial */}
      <div className="pricing-price-block">
        {isFree ? (
          <p className="pricing-price-main">
            <span className="pricing-price-amount">{t('pricing.freePrice')}</span>
            <span className="pricing-price-period">{t('pricing.freePeriod')}</span>
          </p>
        ) : primaryPrice ? (
          <>
            {hasDiscount && (
              <p className="pricing-price-original" aria-label={t('pricing.originalPriceAria', { price: formatIdr(primaryPrice.originalPriceIdr!) })}>
                {formatIdr(primaryPrice.originalPriceIdr!)}
              </p>
            )}
            <p className="pricing-price-main">
              <span className="pricing-price-amount">{formatIdr(primaryPrice.priceIdr)}</span>
              <span className="pricing-price-period">
                {' '}
                / {formatDuration(t, primaryPrice.durationDays)}
              </span>
              {hasDiscount && (
                <span className="pricing-price-badge">
                  {t('pricing.savings', { percent: savingsPercent(primaryPrice.originalPriceIdr!, primaryPrice.priceIdr) })}
                </span>
              )}
            </p>
            {primaryPrice.durationDays >= 300 && (
              <p className="pricing-price-sub">
                {t('pricing.billedYearly', {
                  monthly: formatIdr(Math.round(primaryPrice.priceIdr / (primaryPrice.durationDays / 30))),
                })}
              </p>
            )}
            {hasDiscount && (
              <p className="pricing-price-savings-detail" aria-live="polite">
                {t('pricing.youSave', {
                  amount: formatIdr(primaryPrice.originalPriceIdr! - primaryPrice.priceIdr),
                })}
              </p>
            )}
          </>
        ) : (
          <p className="pricing-price-main">
            <span className="pricing-price-amount">—</span>
          </p>
        )}
      </div>

      <hr className="pricing-divider" />

      <ul className="pricing-benefits">
        {benefits.map((b) => (
          <li key={b}>
            <Check size={14} weight="bold" aria-hidden="true" />
            <span>{b}</span>
          </li>
        ))}
        {STATIC_BENEFIT_KEYS.map((key) => (
          <li key={key}>
            <Check size={14} weight="bold" aria-hidden="true" />
            {t(key)}
          </li>
        ))}
      </ul>

      <hr className="pricing-divider pricing-divider-cta" />

      <div className="pricing-card-cta">
        {actionError && (
          <p className="field-error pricing-cta-error" role="alert" tabIndex={-1}>
            {actionError}
          </p>
        )}
        {isFree ? (
          <Button variant="ghost" size="md" disabled className="pricing-cta-btn" aria-disabled="true">
            {t('pricing.currentPlan')}
          </Button>
        ) : (
          <>
            <Button
              variant={isFeatured ? 'primary' : 'secondary'}
              size="md"
              className="pricing-cta-btn"
              disabled={!!disabledReason || busy || anyBusy}
              loading={busy}
              aria-describedby={disabledReason ? 'pricing-cta-hint' : undefined}
              aria-busy={busy || undefined}
              onClick={() => {
                if (primaryPrice) onBuy(primaryPrice.id);
              }}
            >
              {primaryPrice
                ? t('pricing.ctaWithPrice', { name: pkg.name, price: formatIdr(primaryPrice.priceIdr) })
                : t('pricing.cta', { name: pkg.name })}
            </Button>
            {disabledReason && !busy && (
              <p id="pricing-cta-hint" className="pricing-cta-hint">
                {disabledReason}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
