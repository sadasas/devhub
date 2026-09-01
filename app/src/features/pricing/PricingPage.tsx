import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CaretDown, Lock, Lightning, ShieldCheck } from '@phosphor-icons/react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { getErrorMessage, isPlanLimitError } from '../../lib/errors';
import type { BillingPackage, BillingStatus } from '../../lib/types';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { SearchableSelect } from '../../components/SearchableSelect';
import { Skeleton } from '../../components/Skeleton';
import { useAuth } from '../../state/auth-context';
import { useTeams } from '../../state/teams-context';
import { BillingToggle } from './BillingToggle';
import { PricingCard } from './PricingCard';
import { PricingCompare } from './PricingCompare';
import { PlanLimitModal, type PlanLimitResource } from '../../components/PlanLimitModal';

const FAQ_ITEM_KEYS = ['upgrade', 'trial', 'payment', 'timing', 'expired'] as const;

function isDowngrade(curMembers: number | null, curProjects: number | null, pkg: BillingPackage): boolean {
  const curM = curMembers === null ? Infinity : curMembers;
  const curP = curProjects === null ? Infinity : curProjects;
  const tgtM = pkg.maxMembers === null ? Infinity : pkg.maxMembers;
  const tgtP = pkg.maxProjects === null ? Infinity : pkg.maxProjects;
  return tgtM < curM || tgtP < curP;
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
  const [selectedDurationDays, setSelectedDurationDays] = useState<number | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const workspaceBarRef = useRef<HTMLDivElement>(null);
  const [highlightWorkspace, setHighlightWorkspace] = useState(false);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [limitModal, setLimitModal] = useState<{
    open: boolean;
    resource: PlanLimitResource | null;
    details: { limit: number; used: number } | null;
    targetName: string | null;
  }>({ open: false, resource: null, details: null, targetName: null });

  useEffect(() => {
    if (queryTeamId) setSelectedTeamId(queryTeamId);
  }, [queryTeamId]);

  const effectiveTeamId =
    queryTeamId && teams?.some((team) => team.id === queryTeamId) ? queryTeamId : selectedTeamId;
  const freePkgs = (packages ?? []).filter((p) => p.isFree);
  const paidPkgs = (packages ?? []).filter((p) => !p.isFree);
  const anyBusy = busyKey !== null;

  const durations = useMemo(() => {
    const map = new Map<number, number>();
    for (const pkg of packages ?? []) {
      if (pkg.isFree) continue;
      for (const pr of pkg.prices) map.set(pr.durationDays, pr.durationDays);
    }
    return [...map.values()].sort((a, b) => a - b);
  }, [packages]);

  useEffect(() => {
    if (durations.length === 0) return;
    if (selectedDurationDays == null) setSelectedDurationDays(durations[0]!);
    else if (!durations.includes(selectedDurationDays)) setSelectedDurationDays(durations[0]!);
  }, [durations, selectedDurationDays]);

  useEffect(() => {
    if (!effectiveTeamId) {
      setBillingStatus(null);
      return;
    }
    let cancelled = false;
    api
      .billingStatus(effectiveTeamId)
      .then((st) => {
        if (!cancelled) setBillingStatus(st);
      })
      .catch(() => {
        if (!cancelled) setBillingStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveTeamId]);

  function requestWorkspaceFocus(pkgId: string) {
    const msg = t('pricing.errors.pickWorkspace');
    setActionError({ pkgId, message: msg });
    setHighlightWorkspace(true);
    window.setTimeout(() => setHighlightWorkspace(false), 1600);
    requestAnimationFrame(() => {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      workspaceBarRef.current?.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'center' });
      const trigger = workspaceBarRef.current?.querySelector<HTMLElement>('#pricing-workspace-select');
      if (trigger) trigger.focus();
      else errorRef.current?.focus();
    });
  }

  async function handleBuy(pkgId: string, priceId: string) {
    if (!effectiveTeamId) {
      requestWorkspaceFocus(pkgId);
      return;
    }
    // pre-check downgrade over-limit to open modal instantly without API roundtrip
    if (billingStatus) {
      const pkg = packages?.find((p) => p.id === pkgId);
      if (pkg && isDowngrade(billingStatus.usage.members.limit, billingStatus.usage.projects.limit, pkg)) {
        const overMembers = pkg.maxMembers !== null && billingStatus.usage.members.used > pkg.maxMembers;
        const overProjects = pkg.maxProjects !== null && billingStatus.usage.projects.used > pkg.maxProjects;
        if (overMembers || overProjects) {
          const resource: PlanLimitResource = overMembers ? 'members' : 'projects';
          const limit = resource === 'members' ? (pkg.maxMembers as number) : (pkg.maxProjects as number);
          const used = resource === 'members' ? billingStatus.usage.members.used : billingStatus.usage.projects.used;
          setLimitModal({ open: true, resource, details: { limit, used }, targetName: pkg.name });
          return;
        }
      }
    }
    setActionError(null);
    setBusyKey(`${pkgId}:${priceId}`);
    try {
      const result = await api.startCheckout(effectiveTeamId, pkgId, priceId);
      window.location.assign(result.url);
    } catch (err) {
      if (isPlanLimitError(err)) {
        const details = err.details as { resource?: string; limit?: number; used?: number; pendingPackageName?: string } | undefined;
        const resource: PlanLimitResource = details?.resource === 'projects' ? 'projects' : 'members';
        const limit = typeof details?.limit === 'number' ? details.limit : 0;
        const used = typeof details?.used === 'number' ? details.used : 0;
        const pkg = packages?.find((p) => p.id === pkgId);
        setLimitModal({ open: true, resource, details: { limit, used }, targetName: pkg?.name ?? (details?.pendingPackageName as string) ?? null });
        setBusyKey(null);
        return;
      }
      setActionError({ pkgId, message: getErrorMessage(err, t('pricing.errors.checkout')) });
      setBusyKey(null);
      requestAnimationFrame(() => errorRef.current?.focus());
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

  const workspaceHasError = !!actionError?.message;

  const currentPackageId = (() => {
    if (!billingStatus || !packages) return null;
    if (billingStatus.team.planPackageId) return billingStatus.team.planPackageId;
    const byName = packages.find((p) => p.name === billingStatus.team.planPackageName);
    return byName?.id ?? null;
  })();
  const pendingPackageId = billingStatus?.team.pendingPackage?.id ?? null;

  return (
    <div className="page pricing-page">
      <header className="page-header pricing-header">
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
        <div role="status" aria-busy="true" aria-live="polite" aria-label={t('pricing.loadingAria', { defaultValue: 'Memuat paket' })}>
          <span className="sr-only">{t('pricing.loadingAria', { defaultValue: 'Memuat paket' })}…</span>
          <div aria-hidden="true">
            <Skeleton style={{ width: '100%', height: 44, borderRadius: 8, marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
              <Skeleton style={{ width: 180, height: 32, borderRadius: 999 }} />
            </div>
            <div className="pricing-grid pricing-grid-featured">
              {[0, 1].map((i) => (
                <div key={i} className="pricing-card">
                  <Skeleton style={{ width: 90, height: 16 }} />
                  <Skeleton style={{ width: 160, height: 30, marginTop: 12 }} />
                  <Skeleton className="skeleton-row" style={{ marginTop: 14 }} />
                  <Skeleton className="skeleton-row" style={{ marginTop: 8 }} />
                  <Skeleton style={{ width: '100%', height: 36, marginTop: 16, borderRadius: 8 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {packages && paidPkgs.length > 0 && (
            <div
              ref={workspaceBarRef}
              className={`pricing-workspace-wrap${highlightWorkspace ? ' pricing-workspace-wrap--highlight' : ''}`}
            >
              <div
                className={`pricing-workspace-bar${highlightWorkspace ? ' pricing-workspace-bar--error pricing-workspace-bar--shake' : ''}`}
                role="region"
                aria-label={t('pricing.workspaceBarAria')}
              >
                <label className="pricing-workspace-label" htmlFor="pricing-workspace-select">
                  {t('pricing.workspaceBarLabel')}
                </label>
                <div className="pricing-workspace-field">
                  <SearchableSelect
                    id="pricing-workspace-select"
                    placeholder={t('pricing.workspacePlaceholder')}
                    value={effectiveTeamId || null}
                    options={(teams ?? []).map((tm) => ({ value: tm.id, label: tm.name }))}
                    onChange={(v) => {
                      setSelectedTeamId(v ?? '');
                      if (v) setActionError(null);
                    }}
                  />
                </div>
              </div>
              {!effectiveTeamId && <p className="pricing-workspace-hint-block">{t('pricing.pickWorkspace')}</p>}
              {workspaceHasError && (
                <p ref={errorRef} className="field-error pricing-workspace-error" role="alert" tabIndex={-1}>
                  {actionError?.message}
                </p>
              )}
            </div>
          )}
          {packages && paidPkgs.length > 0 && durations.length > 1 && (
            <BillingToggle packages={packages} value={selectedDurationDays} onChange={setSelectedDurationDays} />
          )}
          <div className="pricing-grid pricing-grid-featured">
            {paidPkgs.map((pkg, i) => {
              const selectedPrice =
                selectedDurationDays != null
                  ? (pkg.prices.find((p) => p.durationDays === selectedDurationDays) ??
                    pkg.prices[0] ??
                    null)
                  : (pkg.prices[0] ?? null);
              const isSelectedBusy = busyKey?.startsWith(`${pkg.id}:`) ?? false;
              const isCurrent = currentPackageId === pkg.id;
              const isScheduled = pendingPackageId === pkg.id;
              let downgradeBlockedReason: string | null = null;
              let isDowngradeFlag = false;
              if (billingStatus) {
                isDowngradeFlag = isDowngrade(billingStatus.usage.members.limit, billingStatus.usage.projects.limit, pkg);
                if (isDowngradeFlag) {
                  const overMembers = pkg.maxMembers !== null && billingStatus.usage.members.used > pkg.maxMembers;
                  const overProjects = pkg.maxProjects !== null && billingStatus.usage.projects.used > pkg.maxProjects;
                  if (overMembers || overProjects) {
                    const limit = overMembers ? (pkg.maxMembers as number) : (pkg.maxProjects as number);
                    const used = overMembers ? billingStatus.usage.members.used : billingStatus.usage.projects.used;
                    downgradeBlockedReason = t('pricing.downgradeBlockedHint', { used, limit, defaultValue: `Melebihi pemakaianmu (${used}/${limit})` });
                  }
                }
              }
              const pickWorkspaceReason = !user ? null : !effectiveTeamId ? t('pricing.errors.pickWorkspace') : null;
              const disabledReason = downgradeBlockedReason ?? pickWorkspaceReason ?? null;
              const isRenewal = isCurrent;
              return (
                <PricingCard
                  key={pkg.id}
                  pkg={pkg}
                  isFeatured={i === 0 && !isCurrent && !isScheduled}
                  selectedPrice={selectedPrice}
                  onBuy={(pid: string) => handleBuy(pkg.id, pid)}
                  busy={isSelectedBusy}
                  anyBusy={anyBusy}
                  disabledReason={disabledReason}
                  actionError={actionError?.pkgId === pkg.id ? actionError.message : null}
                  onRequireWorkspace={requestWorkspaceFocus}
                  isCurrent={isCurrent}
                  isScheduled={isScheduled}
                  isRenewal={isRenewal}
                  isDowngradeBlocked={!!downgradeBlockedReason}
                />
              );
            })}
            {freePkgs.map((pkg) => (
              <PricingCard
                key={pkg.id}
                pkg={pkg}
                isFeatured={false}
                selectedPrice={null}
                onBuy={() => {}}
                busy={false}
                anyBusy={anyBusy}
                variant="free"
              />
            ))}
          </div>
          {packages && <PricingCompare packages={packages} />}
        </>
      )}
      <section className="pricing-faq" aria-labelledby="pricing-faq-heading">
        <h2 id="pricing-faq-heading" className="pricing-section-label">
          {t('pricing.faqSection')}
        </h2>
        {FAQ_ITEM_KEYS.map((key, i) => {
          const isOpen = openFaq === i;
          const answerId = `pricing-faq-${key}`;
          return (
            <div key={key} className="pricing-faq-item">
              <button
                type="button"
                className="pricing-faq-trigger"
                aria-expanded={isOpen}
                aria-controls={answerId}
                onClick={() => setOpenFaq(isOpen ? null : i)}
              >
                <span>{t(`pricing.faq.${key}.q`)}</span>
                <CaretDown size={14} weight="bold" aria-hidden="true" />
              </button>
              <p id={answerId} className="pricing-faq-answer" hidden={!isOpen}>
                {t(`pricing.faq.${key}.a`)}
              </p>
            </div>
          );
        })}
      </section>
      <div className="pricing-trust-row" role="note" aria-label={t('pricing.trust')}>
        <span>
          <Lock size={14} aria-hidden="true" />
          {t('pricing.trust')}
        </span>
        <span>
          <ShieldCheck size={14} aria-hidden="true" />
          {t('pricing.trustRow')}
        </span>
      </div>
      <p className="page-subtitle" style={{ textAlign: 'center', marginTop: 8 }}>
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
      <PlanLimitModal
        open={limitModal.open}
        resource={limitModal.resource}
        teamId={effectiveTeamId}
        onClose={() => setLimitModal({ open: false, resource: null, details: null, targetName: null })}
        details={limitModal.details}
        mode="downgrade-blocked"
        targetPackageName={limitModal.targetName}
      />
    </div>
  );
}
