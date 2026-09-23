import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CaretDown, Lock, Lightning, ShieldCheck } from '@phosphor-icons/react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { getErrorMessage, isPlanLimitError } from '../../lib/errors';
import type { BillingPackage, BillingStatus } from '../../lib/types';
import { formatBytes, formatIdr } from '../../lib/format';
import { Button } from '../../components/Button';
import { DataErrorState } from '../../components/DataErrorState';
import { DetailList, DetailRow } from '../../components/DetailList';
import { InlineError } from '../../components/InlineError';
import { Modal } from '../../components/Modal';
import { SearchableSelect } from '../../components/SearchableSelect';
import { Skeleton } from '../../components/Skeleton';
import { Avatar } from '../../components/Avatar';
import { LegalFooter } from '../../components/LegalFooter';
import { useAuth } from '../../state/auth-context';
import { useTeams } from '../../state/teams-context';
import { useProjects } from '../../state/projects-context';
import { BillingToggle } from './BillingToggle';
import { PricingCard } from './PricingCard';
import { PricingCompare } from './PricingCompare';
import { PlanLimitModal, type PlanLimitResource } from '../../components/PlanLimitModal';

const FAQ_ITEM_KEYS = ['upgrade', 'trial', 'payment', 'timing', 'downgrade', 'expired'] as const;

function isDowngrade(
  curMembers: number | null,
  curProjects: number | null,
  curStorageBytes: number | null,
  pkg: BillingPackage,
): boolean {
  const num = (v: number | null): number => (v === null ? Infinity : v);
  return (
    num(pkg.maxMembers) < num(curMembers) ||
    num(pkg.maxProjects) < num(curProjects) ||
    num(pkg.maxStorageBytes) < num(curStorageBytes)
  );
}

export function PricingPage() {
  const { t } = useTranslation('extras');
  const { user } = useAuth();
  const { teams } = useTeams();
  // Opsional: hitung proyek per workspace untuk picker (aman tanpa provider di test).
  let projectCounts: Record<string, number> = {};
  try {
    // Hook selalu dipanggil (aturan hooks) — hanya aksesnya yang defensif.
    const { projects } = useProjects();
    projectCounts = (projects ?? []).reduce<Record<string, number>>((acc, p) => {
      acc[p.teamId] = (acc[p.teamId] ?? 0) + 1;
      return acc;
    }, {});
  } catch {
    projectCounts = {};
  }
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryTeamId = searchParams.get('teamId');
  const [selectedTeamId, setSelectedTeamId] = useState<string>(queryTeamId ?? '');
  const [packages, setPackages] = useState<BillingPackage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [packagesErrorRaw, setPackagesErrorRaw] = useState<unknown>(null);
  const [actionError, setActionError] = useState<{ pkgId: string; message: string } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [selectedDurationDays, setSelectedDurationDays] = useState<number | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  // Konfirmasi sebelum order dibuat: checkout (orderId/url) baru ada
  // setelah user menekan Bayar di modal.
  const [confirm, setConfirm] = useState<{ pkgId: string; priceId: string } | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);  const errorRef = useRef<HTMLParagraphElement>(null);
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
  const paidPkgs = (packages ?? [])
    .filter((p) => !p.isFree)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  // Rekomendasi dari data (is_featured); fallback ke paket paid pertama agar selalu ada badge.
  const featuredPaidId = paidPkgs.find((p) => p.isFeatured)?.id ?? paidPkgs[0]?.id ?? null;
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

  function handleBuy(pkgId: string, priceId: string) {
    if (!effectiveTeamId) {
      requestWorkspaceFocus(pkgId);
      return;
    }
    // pre-check downgrade over-limit to open modal instantly without API roundtrip
    if (billingStatus) {
      const pkg = packages?.find((p) => p.id === pkgId);
      if (
        pkg &&
        isDowngrade(
          billingStatus.usage.members.limit,
          billingStatus.usage.projects.limit,
          billingStatus.usage.storage.limitBytes,
          pkg,
        )
      ) {
        const overMembers = pkg.maxMembers !== null && billingStatus.usage.members.used > pkg.maxMembers;
        const overProjects = pkg.maxProjects !== null && billingStatus.usage.projects.used > pkg.maxProjects;
        const overStorage =
          pkg.maxStorageBytes !== null && billingStatus.usage.storage.usedBytes > pkg.maxStorageBytes;
        if (overMembers || overProjects || overStorage) {
          const resource: PlanLimitResource = overMembers ? 'members' : overProjects ? 'projects' : 'storage';
          if (resource === 'storage') {
            setLimitModal({ open: true, resource, details: null, targetName: pkg.name });
          } else {
            const limit = resource === 'members' ? (pkg.maxMembers as number) : (pkg.maxProjects as number);
            const used = resource === 'members' ? billingStatus.usage.members.used : billingStatus.usage.projects.used;
            setLimitModal({ open: true, resource, details: { limit, used }, targetName: pkg.name });
          }
          return;
        }
      }
    }
    setActionError(null);
    setConfirmError(null);
    setConfirm({ pkgId, priceId });
  }

  function closeConfirm() {
    if (busyKey !== null) return;
    setConfirm(null);
    setConfirmError(null);
  }

  // Data ringkasan dari harga paket (klien) — order belum dibuat.
  const confirmData = (() => {
    if (!confirm || !effectiveTeamId) return null;
    const team = (teams ?? []).find((tm) => tm.id === effectiveTeamId);
    const pkg = packages?.find((p) => p.id === confirm.pkgId);
    const price = pkg?.prices.find((pr) => pr.id === confirm.priceId) ?? null;
    if (!pkg || !price) return null;
    return {
      pkgId: pkg.id,
      priceId: price.id,
      teamName: (team as { name?: string } | undefined)?.name ?? effectiveTeamId.slice(0, 8),
      packageName: pkg.name,
      durationDays: price.durationDays,
      amount: price.priceIdr,
    };
  })();
  const confirmBusy = confirmData != null && busyKey === `${confirmData.pkgId}:${confirmData.priceId}`;

  async function confirmCheckout() {
    if (!confirmData || !effectiveTeamId || busyKey !== null) return;
    const { pkgId, priceId } = confirmData;
    setConfirmError(null);
    setBusyKey(`${pkgId}:${priceId}`);
    try {
      const result = await api.startCheckout(effectiveTeamId, pkgId, priceId);
      const url = typeof (result as { url?: unknown }).url === 'string' ? (result as { url: string }).url : '';
      if (!url) throw new Error(t('pricing.errors.checkout'));
      setBusyKey(null);
      setConfirm(null);
      window.location.assign(url);
    } catch (err) {
      if (isPlanLimitError(err)) {
        const details = err.details as { resource?: string; limit?: number; used?: number; pendingPackageName?: string } | undefined;
        const resource: PlanLimitResource =
          details?.resource === 'projects' ? 'projects' : details?.resource === 'storage' ? 'storage' : 'members';
        const pkg = packages?.find((p) => p.id === pkgId);
        // Storage: angka byte mentah tak terbaca — modal menampilkan copy generik.
        const modalDetails =
          resource === 'storage' || typeof details?.limit !== 'number' || typeof details?.used !== 'number'
            ? null
            : { limit: details.limit, used: details.used };
        setLimitModal({ open: true, resource, details: modalDetails, targetName: pkg?.name ?? (details?.pendingPackageName as string) ?? null });
        setBusyKey(null);
        setConfirm(null);
        return;
      }
      setConfirmError(getErrorMessage(err, t('pricing.errors.checkout')));
      setBusyKey(null);
    }
  }

  const loadPackages = useCallback(() => {
    setError(null);
    setPackagesErrorRaw(null);
    api
      .listPackages()
      .then((res) => setPackages(res.packages))
      .catch((err) => {
        setError(getErrorMessage(err, t('pricing.errors.load')));
        setPackagesErrorRaw(err);
      });
  }, [t]);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

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
      {/* Flat content card wraps page content; modal stays a sibling portal target. */}
      <article className="pcard">
        <div className="pcard-body">
          <div className="narrow-center">
      <header className="page-header pricing-header">
        <div>
          <h1 className="page-title pricing-title">{t('pricing.title')}</h1>
          <p className="page-subtitle">{t('pricing.subtitle')}</p>
        </div>
      </header>
      {error && <DataErrorState error={packagesErrorRaw ?? error} onRetry={loadPackages} />}
      {packages === null && !error ? (
        <div role="status" aria-busy="true" aria-live="polite" aria-label={t('pricing.loadingAria', { defaultValue: 'Memuat paket' })}>
          <span className="sr-only">{t('pricing.loadingAria', { defaultValue: 'Memuat paket' })}…</span>
          <div aria-hidden="true">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', border: '1px solid var(--border-hairline)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <Skeleton style={{ width: 140, height: 13 }} />
              <Skeleton style={{ flex: 1, height: 36, borderRadius: 8 }} />
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
              <Skeleton style={{ width: 110, height: 32, borderRadius: 999 }} />
              <Skeleton style={{ width: 150, height: 32, borderRadius: 999 }} />
            </div>
            <div className="pricing-grid pricing-grid-featured">
              {[0, 1, 2].map((i) => (
                <div key={i} className="pricing-card">
                  <Skeleton style={{ width: 90, height: 16 }} />
                  <Skeleton style={{ width: '70%', height: 12, marginTop: 8 }} />
                  <Skeleton style={{ width: 160, height: 30, marginTop: 12 }} />
                  <Skeleton style={{ width: 110, height: 16, marginTop: 6, borderRadius: 999 }} />
                  {[0, 1, 2, 3, 4].map((j) => (
                    <div key={j} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: j === 0 ? 14 : 8 }}>
                      <Skeleton style={{ width: 14, height: 14, borderRadius: 999, flexShrink: 0 }} />
                      <Skeleton style={{ width: `${70 - j * 6}%`, height: 12 }} />
                    </div>
                  ))}
                  <Skeleton style={{ width: '100%', height: 34, marginTop: 16, borderRadius: 8 }} />
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
                    allowEmpty={false}
                    triggerEmptyLabel={t('pricing.workspacePlaceholder')}
                    value={effectiveTeamId || null}
                    options={(teams ?? []).map((tm) => {
                      const projCount = projectCounts[tm.id] ?? 0;
                      const memberCount = (tm as { memberCount?: number }).memberCount ?? 0;
                      const teamName = (tm as { name?: string }).name ?? tm.id.slice(0, 8);
                      return {
                        value: tm.id,
                        label: teamName,
                        hint: `${memberCount} anggota • ${projCount} proyek`,
                        icon: (
                          <Avatar
                            src={null}
                            name={teamName}
                            id={tm.id}
                            size={22}
                          />
                        ),
                      };
                    })}
                    onChange={(v) => {
                      setSelectedTeamId(v ?? '');
                      setConfirm(null);
                      setConfirmError(null);
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
            {paidPkgs.map((pkg) => {
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
                isDowngradeFlag = isDowngrade(
                  billingStatus.usage.members.limit,
                  billingStatus.usage.projects.limit,
                  billingStatus.usage.storage.limitBytes,
                  pkg,
                );
                if (isDowngradeFlag) {
                  const overMembers = pkg.maxMembers !== null && billingStatus.usage.members.used > pkg.maxMembers;
                  const overProjects = pkg.maxProjects !== null && billingStatus.usage.projects.used > pkg.maxProjects;
                  const overStorage =
                    pkg.maxStorageBytes !== null && billingStatus.usage.storage.usedBytes > pkg.maxStorageBytes;
                  if (overMembers || overProjects || overStorage) {
                    if (overStorage && !overMembers && !overProjects) {
                      downgradeBlockedReason = t('pricing.downgradeBlockedHintStorage', {
                        used: formatBytes(billingStatus.usage.storage.usedBytes),
                        limit: formatBytes(pkg.maxStorageBytes as number),
                        defaultValue: `Melebihi penyimpananmu (${formatBytes(billingStatus.usage.storage.usedBytes)}/${formatBytes(pkg.maxStorageBytes as number)})`,
                      });
                    } else {
                      const limit = overMembers ? (pkg.maxMembers as number) : (pkg.maxProjects as number);
                      const used = overMembers ? billingStatus.usage.members.used : billingStatus.usage.projects.used;
                      downgradeBlockedReason = t('pricing.downgradeBlockedHint', { used, limit, defaultValue: `Melebihi pemakaianmu (${used}/${limit})` });
                    }
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
                  isFeatured={pkg.id === featuredPaidId && !isCurrent && !isScheduled}
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
      <LegalFooter compact />
          </div>
        </div>
      </article>
      <Modal
        open={confirmData !== null}
        title={t('pricing.confirm.title')}
        onClose={confirmBusy ? undefined : closeConfirm}
        width="sm"
        footer={
          <>
            <Button variant="ghost" size="md" onClick={closeConfirm} disabled={confirmBusy}>
              {t('pricing.confirm.cancel')}
            </Button>
            <Button
              variant="primary"
              size="md"
              loading={confirmBusy}
              disabled={confirmBusy || confirmData === null}
              onClick={() => void confirmCheckout()}
            >
              {confirmData ? t('pricing.confirm.pay', { price: formatIdr(confirmData.amount) }) : t('pricing.confirm.pay', { price: '' })}
            </Button>
          </>
        }
      >
        {confirmData && (
          <>
            <DetailList>
              <DetailRow label={t('pricing.confirm.workspace')}>{confirmData.teamName}</DetailRow>
              <DetailRow label={t('pricing.confirm.package')}>{confirmData.packageName}</DetailRow>
              <DetailRow label={t('pricing.confirm.duration')}>{t('pricing.confirm.days', { count: confirmData.durationDays })}</DetailRow>
              <DetailRow label={t('pricing.confirm.amount')}>
                <span className="tabular">{formatIdr(confirmData.amount)}</span>
              </DetailRow>
            </DetailList>
            <p className="field-helper" style={{ marginTop: 8 }}>{t('pricing.confirm.fees')}</p>
            {confirmError && <InlineError>{confirmError}</InlineError>}
          </>
        )}
      </Modal>
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
