import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CaretDown, Lock, Lightning, ShieldCheck } from '@phosphor-icons/react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { BillingPackage } from '../../lib/types';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { SearchableSelect } from '../../components/SearchableSelect';
import { Skeleton } from '../../components/Skeleton';
import { useAuth } from '../../state/auth-context';
import { useTeams } from '../../state/teams-context';
import { PricingCard } from './PricingCard';
import { PricingCompare } from './PricingCompare';
const FAQ_ITEM_KEYS = ['upgrade', 'trial', 'payment', 'timing', 'expired'] as const;
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
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (queryTeamId) setSelectedTeamId(queryTeamId); }, [queryTeamId]);
  const effectiveTeamId = queryTeamId && teams?.some((team) => team.id === queryTeamId) ? queryTeamId : selectedTeamId;
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
    if (Object.keys(init).length > 0) setSelectedPrices((prev) => ({ ...prev, ...init }));
  }, [packages]);
  function handleSelectPrice(pkgId: string, priceId: string) { setSelectedPrices((prev) => ({ ...prev, [pkgId]: priceId })); }
  async function handleBuy(pkgId: string, priceId: string) {
    if (!effectiveTeamId) { const msg = t('pricing.errors.pickWorkspace'); setActionError({ pkgId, message: msg }); requestAnimationFrame(() => errorRef.current?.focus()); return; }
    setActionError(null); setBusyKey(`${pkgId}:${priceId}`);
    try { const result = await api.startCheckout(effectiveTeamId, pkgId, priceId); window.location.assign(result.url); } catch (err) { setActionError({ pkgId, message: getErrorMessage(err, t('pricing.errors.checkout')) }); setBusyKey(null); requestAnimationFrame(() => errorRef.current?.focus()); }
  }
  useEffect(() => { api.listPackages().then((res) => setPackages(res.packages)).catch((err) => setError(getErrorMessage(err, t('pricing.errors.load')))); }, [t]);
  const onBack = () => { if (queryTeamId) navigate(`/team/${queryTeamId}?tab=usage`); else if (window.history.length > 1) navigate(-1); else navigate('/'); };
  const workspaceHasError = !!actionError?.message;
  return (
    <div className="page pricing-page">
      <header className="page-header pricing-header">
        <div>
          <button type="button" className="back-btn" onClick={onBack}><ArrowLeft size={14} aria-hidden="true" /> {t('pricing.back')}</button>
          <h1 className="page-title pricing-title">{t('pricing.title')}</h1>
          <p className="page-subtitle">{t('pricing.subtitle')}</p>
        </div>
      </header>
      {error && <InlineError>{error}</InlineError>}
      {packages === null && !error ? (
        <div className="pricing-grid pricing-grid-featured" aria-busy="true" aria-label={t('pricing.loadingAria', { defaultValue: 'Memuat paket' })}>
          {[0, 1].map((i) => (<div key={i} className="pricing-card" aria-hidden="true"><Skeleton style={{ width: 90, height: 16 }} /><Skeleton style={{ width: 160, height: 30, marginTop: 12 }} /><Skeleton className="skeleton-row" style={{ marginTop: 14 }} /><Skeleton className="skeleton-row" style={{ marginTop: 8 }} /><Skeleton style={{ width: '100%', height: 36, marginTop: 16 }} /></div>))}
        </div>
      ) : (
        <>
          {packages && paidPkgs.length > 0 && (
            <div className="pricing-workspace-wrap">
              <div className="pricing-workspace-bar" role="region" aria-label={t('pricing.workspaceBarAria')}>
                <label className="pricing-workspace-label" htmlFor="pricing-workspace-select">{t('pricing.workspaceBarLabel')}</label>
                <div className="pricing-workspace-field"><SearchableSelect id="pricing-workspace-select" placeholder={t('pricing.workspacePlaceholder')} value={effectiveTeamId || null} options={(teams ?? []).map((tm) => ({ value: tm.id, label: tm.name }))} onChange={(v) => { setSelectedTeamId(v ?? ''); if (v) setActionError(null); }} /></div>
              </div>
              {!effectiveTeamId && <p className="pricing-workspace-hint-block">{t('pricing.pickWorkspace')}</p>}
              {workspaceHasError && <p ref={errorRef} className="field-error pricing-workspace-error" role="alert" tabIndex={-1}>{actionError?.message}</p>}
            </div>
          )}
          <div className="pricing-grid pricing-grid-featured">
            {paidPkgs.map((pkg, i) => {
              const priceId = selectedPrices[pkg.id] ?? pkg.prices[0]?.id ?? null;
              const selectedPrice = pkg.prices.find((p) => p.id === priceId) ?? pkg.prices[0] ?? null;
              const isSelectedBusy = busyKey?.startsWith(`${pkg.id}:`) ?? false;
              const disabledReason = !user ? null : !effectiveTeamId ? t('pricing.errors.pickWorkspace') : null;
              return <PricingCard key={pkg.id} pkg={pkg} isFeatured={i === 0} selectedPrice={selectedPrice} onSelectPrice={(pid: string) => handleSelectPrice(pkg.id, pid)} onBuy={(pid: string) => handleBuy(pkg.id, pid)} busy={isSelectedBusy} anyBusy={anyBusy} disabledReason={disabledReason} actionError={actionError?.pkgId === pkg.id ? actionError.message : null} />;
            })}
            {freePkgs.map((pkg) => (<PricingCard key={pkg.id} pkg={pkg} isFeatured={false} selectedPrice={null} onBuy={() => {}} busy={false} anyBusy={anyBusy} variant="free" />))}
          </div>
          {packages && <PricingCompare packages={packages} />}
        </>
      )}
      <section className="pricing-faq" aria-labelledby="pricing-faq-heading"><h2 id="pricing-faq-heading" className="pricing-section-label">{t('pricing.faqSection')}</h2>{FAQ_ITEM_KEYS.map((key, i) => { const isOpen = openFaq === i; const answerId = `pricing-faq-${key}`; return (<div key={key} className="pricing-faq-item"><button type="button" className="pricing-faq-trigger" aria-expanded={isOpen} aria-controls={answerId} onClick={() => setOpenFaq(isOpen ? null : i)}><span>{t(`pricing.faq.${key}.q`)}</span><CaretDown size={14} weight="bold" aria-hidden="true" /></button><p id={answerId} className="pricing-faq-answer" hidden={!isOpen}>{t(`pricing.faq.${key}.a`)}</p></div>); })}</section>
      <div className="pricing-trust-row" role="note" aria-label={t('pricing.trust')}><span><Lock size={14} aria-hidden="true" />{t('pricing.trust')}</span><span><ShieldCheck size={14} aria-hidden="true" />{t('pricing.trustRow')}</span></div>
      <p className="page-subtitle" style={{ textAlign: 'center', marginTop: 8 }}>{t('pricing.poweredBy')}</p>
      <div className="page-footer">{!user && <Button variant="primary" onClick={() => navigate('/')}><Lightning size={14} weight="duotone" aria-hidden="true" />{t('pricing.createAccount')}</Button>}</div>
    </div>
  );
}
