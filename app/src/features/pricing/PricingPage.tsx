import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Lightning, Sparkle } from '@phosphor-icons/react';
import { useNavigate, useSearchParams } from 'react-router';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { BillingPackage } from '../../lib/types';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { SearchableSelect } from '../../components/SearchableSelect';
import { Skeleton } from '../../components/Skeleton';
import { useAuth } from '../../state/auth-context';
import { useTeams } from '../../state/teams-context';

function formatIdr(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

function limitLine(pkg: BillingPackage): string {
  const m = pkg.maxMembers === null ? 'Unlimited members' : `${pkg.maxMembers} members`;
  const p = pkg.maxProjects === null ? 'unlimited projects' : `${pkg.maxProjects} projects`;
  return `${m} · ${p.charAt(0).toUpperCase()}${p.slice(1)}`;
}

export function PricingPage() {
  const { user } = useAuth();
  const { teams } = useTeams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryTeamId = searchParams.get('teamId');
  const [selectedTeamId, setSelectedTeamId] = useState<string>(queryTeamId ?? '');
  const [packages, setPackages] = useState<BillingPackage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPkg, setSelectedPkg] = useState<BillingPackage | null>(null);
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);

  useEffect(() => {
    if (queryTeamId) setSelectedTeamId(queryTeamId);
  }, [queryTeamId]);

  const effectiveTeamId =
    queryTeamId && teams?.some((t) => t.id === queryTeamId) ? queryTeamId : selectedTeamId;

  async function onBuy() {
    if (!selectedPkg || !selectedPriceId) return;
    if (!effectiveTeamId) {
      setActionError('Pilih workspace yang akan di-upgrade.');
      return;
    }
    setActionError(null);
    setBusyKey(`${selectedPkg.id}:${selectedPriceId}`);
    try {
      const result = await api.startCheckout(effectiveTeamId, selectedPkg.id, selectedPriceId);
      window.location.assign(result.url);
    } catch (err) {
      setActionError(getErrorMessage(err, 'Failed to start checkout.'));
      setBusyKey(null);
    }
  }

  function handleSelectPackage(pkg: BillingPackage) {
    if (pkg.isFree) return;
    setSelectedPkg(pkg);
    setSelectedPriceId(pkg.prices[0]?.id ?? null);
    setStep(2);
    setActionError(null);
  }

  useEffect(() => {
    api
      .listPackages()
      .then((res) => setPackages(res.packages))
      .catch((err) => setError(getErrorMessage(err, 'Failed to load packages.')));
  }, []);

  const onBack = () => {
    if (step === 2) {
      setStep(1);
      return;
    }
    if (queryTeamId) navigate(`/team/${queryTeamId}?tab=billing`);
    else if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  const selectedPrice = selectedPkg?.prices.find((p) => p.id === selectedPriceId) ?? null;
  const originalSelected = (selectedPrice as unknown as { originalPriceIdr?: number | null })
    ?.originalPriceIdr;
  const hasDiscountSelected =
    typeof originalSelected === 'number' && selectedPrice !== null && originalSelected > selectedPrice.priceIdr;
  const hematSelected = hasDiscountSelected ? (originalSelected as number) - (selectedPrice as NonNullable<typeof selectedPrice>).priceIdr : 0;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <button type="button" className="back-btn" onClick={onBack}>
            <ArrowLeft size={14} aria-hidden="true" /> Back
          </button>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            Pricing
          </h1>
          <p className="page-subtitle">
            Per-workspace plans. Start free — upgrade when your workspace grows.
          </p>
        </div>
      </header>

      {error && <InlineError>{error}</InlineError>}
      {actionError && <InlineError>{actionError}</InlineError>}

      {/* Stepper */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <span className={`badge ${step === 1 ? 'badge-info' : 'badge-neutral'}`}>1. Pilih Paket</span>
        <span style={{ color: 'var(--text-muted)' }}>→</span>
        <span className={`badge ${step === 2 ? 'badge-info' : 'badge-neutral'}`}>2. Workspace & Durasi</span>
      </div>

      {packages === null && !error ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}
          aria-busy="true"
        >
          {[0, 1].map((i) => (
            <div key={i}>
              <Skeleton style={{ width: 90, height: 20 }} />
              <Skeleton style={{ width: 140, height: 34, marginTop: 12 }} />
              <Skeleton className="skeleton-row" style={{ marginTop: 14 }} />
              <Skeleton className="skeleton-row" style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>
      ) : step === 1 ? (
        <div className="pricing-grid">
          {(packages ?? []).map((pkg) => {
            const cheapest = pkg.prices[0] ?? null;
            const originalCheapest = (cheapest as unknown as { originalPriceIdr?: number | null })
              ?.originalPriceIdr;
            const hasDisc =
              cheapest !== null &&
              typeof originalCheapest === 'number' &&
              originalCheapest > cheapest.priceIdr;
            const perMonthNormal = cheapest ? Math.round(cheapest.priceIdr / (cheapest.durationDays / 30)) : 0;
            return (
              <section
                key={pkg.id}
                className={`pricing-card${pkg.isFree ? '' : ' pricing-card-pro'}`}
                aria-label={`${pkg.name} plan`}
              >
                {!pkg.isFree && (
                  <p className="pricing-flag">
                    <Sparkle size={12} weight="duotone" aria-hidden="true" /> Upgrade
                  </p>
                )}
                <h2 className="pricing-plan-name">{pkg.name}</h2>
                {pkg.description && <p className="page-subtitle">{pkg.description}</p>}
                {!pkg.isFree && cheapest && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 22, fontWeight: 700 }}>{formatIdr(cheapest.priceIdr)}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/ {cheapest.durationDays} hari</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Biaya normal {formatIdr(perMonthNormal)} / bulan
                    </div>
                    {hasDisc && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                          {formatIdr(originalCheapest as number)}
                        </span>
                        <span className="badge badge-success" style={{ fontSize: 11, padding: '2px 8px' }}>
                          Hemat {formatIdr((originalCheapest as number) - cheapest.priceIdr)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {pkg.isFree && <p style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Rp 0</p>}
                <ul className="pricing-features">
                  <li>
                    <Check size={13} weight="bold" aria-hidden="true" />
                    {limitLine(pkg)}
                  </li>
                  <li>
                    <Check size={13} weight="bold" aria-hidden="true" />
                    Every feature included
                  </li>
                  <li>
                    <Check size={13} weight="bold" aria-hidden="true" />
                    JSON export — your data stays yours
                  </li>
                </ul>
                {!pkg.isFree ? (
                  <Button variant="primary" size="sm" onClick={() => handleSelectPackage(pkg)}>
                    Pilih Paket
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" disabled>
                    Paket saat ini
                  </Button>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16, maxWidth: 560 }}>
          <div className="field">
            <label className="field-label" htmlFor="pricing-team-step2">
              Workspace to upgrade
            </label>
            <SearchableSelect
              id="pricing-team-step2"
              placeholder="Pilih workspace"
              value={selectedTeamId || null}
              options={(teams ?? []).map((t) => ({ value: t.id, label: t.name }))}
              onChange={(v) => setSelectedTeamId(v ?? '')}
            />
          </div>

          {selectedPkg && (
            <>
              <div>
                <p style={{ fontWeight: 600, margin: '0 0 8px' }}>
                  Durasi — {selectedPkg.name} — berapa bulan?
                </p>
                <div className="billing-period-toggle" role="group" aria-label="Pilih durasi bulan">
                  {selectedPkg.prices.map((price) => {
                    const months = Math.round(price.durationDays / 30);
                    const original = (price as unknown as { originalPriceIdr?: number | null }).originalPriceIdr;
                    const hasDisc = typeof original === 'number' && original > price.priceIdr;
                    const isActive = selectedPriceId === price.id;
                    return (
                      <button
                        key={price.id}
                        type="button"
                        className={`billing-period-btn${isActive ? ' active' : ''}`}
                        aria-pressed={isActive}
                        onClick={() => setSelectedPriceId(price.id)}
                      >
                        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{months} Bulan</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatIdr(price.priceIdr)}</span>
                          {hasDisc && (
                            <span className="badge badge-success" style={{ fontSize: 10, padding: '1px 6px' }}>
                              Hemat {formatIdr((original as number) - price.priceIdr)}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedPrice && (
                <div className="billing-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {hasDiscountSelected && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                        {formatIdr(originalSelected as number)}
                      </span>
                      <span className="badge badge-success" style={{ fontSize: 11, padding: '2px 8px' }}>
                        Hemat {formatIdr(hematSelected)}
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 22, fontWeight: 700 }}>{formatIdr(selectedPrice.priceIdr)}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      / {selectedPrice.durationDays} hari
                    </span>
                  </div>
                  <p className="billing-meta">
                    Biaya normal {formatIdr(Math.round(selectedPrice.priceIdr / (selectedPrice.durationDays / 30)))} / bulan
                    {hasDiscountSelected ? ` · Anda hemat ${formatIdr(hematSelected)}` : ''}
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                      Kembali
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!user || !effectiveTeamId}
                      loading={!!busyKey}
                      onClick={() => void onBuy()}
                    >
                      Bayar via QRIS/VA
                    </Button>
                  </div>
                  {!effectiveTeamId && (
                    <p className="billing-meta">Pilih workspace di atas untuk melanjutkan.</p>
                  )}
                </div>
              )}
            </>
          )}

          {!user && (
            <p className="billing-meta">Create a free account to upgrade a workspace.</p>
          )}
        </div>
      )}

      <div className="page-footer">
        {!user && (
          <Button variant="primary" onClick={() => navigate('/')}>
            <Lightning size={14} weight="duotone" aria-hidden="true" />
            Create a free account
          </Button>
        )}
        <p className="billing-meta">
          Payment via QRIS / Virtual Account (Pakasir). Upgrades apply per workspace; renewal is manual — we remind
          you before expiry.
        </p>
      </div>
    </div>
  );
}
