import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CaretDown, Check, Lock, Lightning, Star } from '@phosphor-icons/react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { BillingPackage, PackagePrice } from '../../lib/types';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { SearchableSelect } from '../../components/SearchableSelect';
import { Skeleton } from '../../components/Skeleton';
import { useAuth } from '../../state/auth-context';
import { useTeams } from '../../state/teams-context';

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

const FAQ_ITEM_KEYS = ['upgrade', 'trial', 'payment', 'timing', 'expired'] as const;

function DurationCard({
  price,
  isActive,
  pkgId,
  onSelect,
}: {
  price: PackagePrice;
  isActive: boolean;
  pkgId: string;
  onSelect: (pkgId: string, priceId: string) => void;
}) {
  const { t } = useTranslation('extras');
  const original = price.originalPriceIdr;
  const hasDisc = typeof original === 'number' && original > price.priceIdr;
  return (
    <button
      type="button"
      className={`pricing-duration-card${isActive ? ' pricing-duration-card-active' : ''}`}
      aria-pressed={isActive}
      onClick={() => onSelect(pkgId, price.id)}
    >
      <span className="pricing-duration-name">{formatDuration(t, price.durationDays)}</span>
      {hasDisc && (
        <span className="pricing-duration-original">{formatIdr(original)}</span>
      )}
      <span className="pricing-duration-price">{formatIdr(price.priceIdr)}</span>
      {hasDisc && (
        <span className="pricing-duration-savings">
          {t('pricing.savings', { percent: savingsPercent(original, price.priceIdr) })}
        </span>
      )}
    </button>
  );
}

function PricingCard({
  pkg,
  isRecommended,
  selectedPriceId,
  onSelectPrice,
  onSelectTeam,
  selectedTeamId,
  onBuy,
  busy,
  anyBusy,
  user,
  teams,
  actionError,
}: {
  pkg: BillingPackage;
  isRecommended: boolean;
  selectedPriceId: string | null;
  onSelectPrice: (pkgId: string, priceId: string) => void;
  onSelectTeam: (teamId: string) => void;
  selectedTeamId: string;
  onBuy: (pkgId: string, priceId: string) => void;
  busy: boolean;
  anyBusy: boolean;
  user: { id: string } | null;
  teams: { id: string; name: string }[] | null;
  actionError: string | null;
}) {
  const { t } = useTranslation('extras');
  const selectedPrice = pkg.prices.find((p) => p.id === selectedPriceId) ?? null;
  const benefits = computeBenefits(t, pkg);

  return (
    <section
      className={`pricing-card${isRecommended ? ' pricing-card-pro' : ''}`}
      aria-label={t('pricing.planAria', { name: pkg.name })}
    >
      {isRecommended && (
        <div className="pricing-pro-header">
          <p className="pricing-recommended">
            <Star size={11} weight="fill" aria-hidden="true" /> {t('pricing.recommended')}
          </p>
        </div>
      )}

      <h2 className="pricing-plan-name">{pkg.name}</h2>
      {pkg.description && <p className="page-subtitle">{pkg.description}</p>}

      {pkg.prices.length > 0 ? (
        <>
          <div>
            <p className="pricing-duration-label">{t('pricing.choosePeriod')}</p>
            <div className="pricing-duration-grid" role="group" aria-label={t('pricing.chooseDurationAria')}>
              {pkg.prices.map((price) => (
                <DurationCard
                  key={price.id}
                  price={price}
                  isActive={selectedPriceId === price.id}
                  pkgId={pkg.id}
                  onSelect={onSelectPrice}
                />
              ))}
            </div>
          </div>

          {selectedPrice && (
            <p className="pricing-total-line">
              {t('pricing.totalLabel')}{' '}
              {selectedPrice.originalPriceIdr != null && selectedPrice.originalPriceIdr > selectedPrice.priceIdr ? (
                <>{formatIdr(selectedPrice.originalPriceIdr)} → </>
              ) : null}
              {formatIdr(selectedPrice.priceIdr)}{' '}
              {t('pricing.totalFor', { duration: formatDuration(t, selectedPrice.durationDays) })}
            </p>
          )}
        </>
      ) : (
        <p className="pricing-price">{t('pricing.freePrice')}</p>
      )}

      <hr className="pricing-divider" />

      <ul className="pricing-benefits">
        {benefits.map((b) => (
          <li key={b}>
            <Check size={13} weight="bold" aria-hidden="true" />
            {b}
          </li>
        ))}
        {STATIC_BENEFIT_KEYS.map((key) => (
          <li key={key}>
            <Check size={13} weight="bold" aria-hidden="true" />
            {t(key)}
          </li>
        ))}
      </ul>

      <hr className="pricing-divider" />

      <div className="pricing-checkout">
        {pkg.prices.length > 0 && (
          <div className="field">
            <label className="field-label" htmlFor={`pricing-team-${pkg.id}`}>
              {t('pricing.workspace')}
            </label>
            <SearchableSelect
              id={`pricing-team-${pkg.id}`}
              placeholder={t('pricing.workspacePlaceholder')}
              value={selectedTeamId || null}
              options={(teams ?? []).map((tm) => ({ value: tm.id, label: tm.name }))}
              onChange={(v) => onSelectTeam(v ?? '')}
            />
          </div>
        )}

        {actionError && <InlineError>{actionError}</InlineError>}

        {pkg.prices.length > 0 ? (
          <Button
            variant={isRecommended ? 'primary' : 'secondary'}
            disabled={!user || !selectedTeamId || busy || anyBusy}
            loading={busy}
            onClick={() => {
              const priceId = selectedPriceId ?? pkg.prices[0]?.id;
              if (priceId) onBuy(pkg.id, priceId);
            }}
          >
            {selectedPrice
              ? t('pricing.ctaWithPrice', { name: pkg.name, price: formatIdr(selectedPrice.priceIdr) })
              : t('pricing.cta', { name: pkg.name })}
          </Button>
        ) : (
          <Button variant="ghost" size="sm" disabled>
            {t('pricing.currentPlan')}
          </Button>
        )}

        {isRecommended && !selectedTeamId && (
          <p className="page-subtitle">{t('pricing.pickWorkspace')}</p>
        )}
      </div>
    </section>
  );
}

export function PricingPage() {
  const { t } = useTranslation('extras');
  const { user } = useAuth();
  const { teams } = useTeams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryTeamId = searchParams.get('teamId');
  const [selectedTeamId, setSelectedTeamId] = useState<string>(queryTeamId ?? '');
  const [packages, setPackages] = useState<BillingPackage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ pkgId: string; message: string } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [selectedPrices, setSelectedPrices] = useState<Record<string, string>>({});
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    if (queryTeamId) setSelectedTeamId(queryTeamId);
  }, [queryTeamId]);

  const effectiveTeamId =
    queryTeamId && teams?.some((t) => t.id === queryTeamId) ? queryTeamId : selectedTeamId;

  const freePkgs = (packages ?? []).filter((p) => p.isFree);
  const paidPkgs = (packages ?? []).filter((p) => !p.isFree);
  const anyBusy = busyKey !== null;

  const initRef = useRef(false);
  useEffect(() => {
    if (!packages || initRef.current) return;
    initRef.current = true;
    const init: Record<string, string> = {};
    for (const pkg of packages) {
      if (!pkg.isFree && pkg.prices.length > 0) {
        const first = pkg.prices[0];
        if (first) init[pkg.id] = first.id;
      }
    }
    if (Object.keys(init).length > 0) {
      setSelectedPrices((prev) => ({ ...prev, ...init }));
    }
  }, [packages]);

  function handleSelectPrice(pkgId: string, priceId: string) {
    setSelectedPrices((prev) => ({ ...prev, [pkgId]: priceId }));
  }

  async function handleBuy(pkgId: string, priceId: string) {
    if (!effectiveTeamId) {
      setActionError({ pkgId, message: t('pricing.errors.pickWorkspace') });
      return;
    }
    setActionError(null);
    setBusyKey(`${pkgId}:${priceId}`);
    try {
      const result = await api.startCheckout(effectiveTeamId, pkgId, priceId);
      window.location.assign(result.url);
    } catch (err) {
      setActionError({ pkgId, message: getErrorMessage(err, t('pricing.errors.checkout')) });
      setBusyKey(null);
    }
  }

  useEffect(() => {
    api
      .listPackages()
      .then((res) => setPackages(res.packages))
      .catch((err) => setError(getErrorMessage(err, t('pricing.errors.load'))));
  }, [t]);

  const onBack = () => {
    if (queryTeamId) navigate(`/team/${queryTeamId}?tab=usage`);
    else if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <button type="button" className="back-btn" onClick={onBack}>
            <ArrowLeft size={14} aria-hidden="true" /> {t('pricing.back')}
          </button>
          <h1 className="page-title pricing-title">{t('pricing.title')}</h1>
          <p className="page-subtitle">{t('pricing.subtitle')}</p>
        </div>
      </header>

      {error && <InlineError>{error}</InlineError>}

      {packages === null && !error ? (
        <div className="pricing-grid" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i}>
              <Skeleton style={{ width: 90, height: 20 }} />
              <Skeleton style={{ width: 140, height: 34, marginTop: 12 }} />
              <Skeleton className="skeleton-row" style={{ marginTop: 12 }} />
              <Skeleton className="skeleton-row" style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="pricing-grid">
          {freePkgs.map((pkg) => (
              <PricingCard
                key={pkg.id}
                pkg={pkg}
                isRecommended={false}
                selectedPriceId={null}
                onSelectPrice={handleSelectPrice}
                onSelectTeam={setSelectedTeamId}
                selectedTeamId={selectedTeamId}
                onBuy={handleBuy}
                busy={false}
                anyBusy={anyBusy}
                user={user}
                teams={teams}
                actionError={null}
              />
          ))}
          {paidPkgs.map((pkg, i) => {
            const isSelectedBusy = busyKey?.startsWith(`${pkg.id}:`) ?? false;
            return (
              <PricingCard
                key={pkg.id}
                pkg={pkg}
                isRecommended={i === 0}
                selectedPriceId={selectedPrices[pkg.id] ?? pkg.prices[0]?.id ?? null}
                onSelectPrice={handleSelectPrice}
                onSelectTeam={setSelectedTeamId}
                selectedTeamId={selectedTeamId}
                onBuy={handleBuy}
                busy={isSelectedBusy}
                anyBusy={anyBusy}
                user={user}
                teams={teams}
                actionError={actionError?.pkgId === pkg.id ? actionError.message : null}
              />
            );
          })}
        </div>
      )}

      {/* FAQ */}
      <div className="pricing-faq">
        <p className="pricing-section-label">{t('pricing.faqSection')}</p>
        {FAQ_ITEM_KEYS.map((key, i) => (
          <div key={key} className="pricing-faq-item">
            <button
              type="button"
              className="pricing-faq-trigger"
              aria-expanded={openFaq === i}
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
            >
              {t(`pricing.faq.${key}.q`)}
              <CaretDown size={14} weight="bold" aria-hidden="true" />
            </button>
            {openFaq === i && <p className="pricing-faq-answer">{t(`pricing.faq.${key}.a`)}</p>}
          </div>
        ))}
      </div>

      {/* Trust */}
      <div className="pricing-trust">
        <Lock size={13} aria-hidden="true" />
        <span>{t('pricing.trust')}</span>
      </div>
      <p className="page-subtitle" style={{ textAlign: 'center' }}>
        {t('pricing.poweredBy')}
      </p>

      <div className="page-footer">
        {!user && (
          <Button variant="primary" onClick={() => navigate('/')}>
            <Lightning size={14} weight="duotone" aria-hidden="true" />
            {t('pricing.createAccount')}
          </Button>
        )}
      </div>
    </div>
  );
}
