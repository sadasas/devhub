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

  useEffect(() => {
    if (queryTeamId) setSelectedTeamId(queryTeamId);
  }, [queryTeamId]);

  const effectiveTeamId =
    queryTeamId && teams?.some((t) => t.id === queryTeamId) ? queryTeamId : selectedTeamId;

  async function onBuy(pkg: BillingPackage, priceId: string) {
    if (!effectiveTeamId) {
      setActionError('Pilih workspace yang akan di-upgrade.');
      return;
    }
    setActionError(null);
    setBusyKey(`${pkg.id}:${priceId}`);
    try {
      const result = await api.startCheckout(effectiveTeamId, pkg.id, priceId);
      window.location.assign(result.url);
    } catch (err) {
      setActionError(getErrorMessage(err, 'Failed to start checkout.'));
      setBusyKey(null);
    }
  }

  useEffect(() => {
    api
      .listPackages()
      .then((res) => setPackages(res.packages))
      .catch((err) => setError(getErrorMessage(err, 'Failed to load packages.')));
  }, []);

  const onBack = () => {
    if (queryTeamId) navigate(`/team/${queryTeamId}?tab=billing`);
    else if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

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

      {!queryTeamId && teams && teams.length > 0 && (
        <div className="field" style={{ maxWidth: 360, marginBottom: 16 }}>
          <label className="field-label" htmlFor="pricing-team">
            Workspace to upgrade
          </label>
          <SearchableSelect
            id="pricing-team"
            placeholder="Pilih workspace"
            value={selectedTeamId || null}
            options={teams.map((t) => ({ value: t.id, label: t.name }))}
            onChange={(v) => setSelectedTeamId(v ?? '')}
          />
        </div>
      )}

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
      ) : (
        <div className="pricing-grid">
          {(packages ?? []).map((pkg) => (
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
              {!pkg.isFree && (
                <div className="billing-period-toggle" role="group" aria-label="Pilih durasi">
                  {pkg.prices.map((price) => {
                    const original = (price as unknown as { originalPriceIdr?: number | null })
                      .originalPriceIdr;
                    const hasDiscount =
                      typeof original === 'number' && original > price.priceIdr;
                    const hemat = hasDiscount ? original - price.priceIdr : 0;
                    const label =
                      price.durationDays % 365 === 0
                        ? 'Yearly'
                        : price.durationDays % 30 === 0
                          ? `${price.durationDays / 30} Month`
                          : `${price.durationDays} days`;
                    return (
                      <button
                        key={price.id}
                        type="button"
                        className="billing-period-btn"
                        disabled={!user || !!busyKey}
                        onClick={() => (user ? void onBuy(pkg, price.id) : navigate('/'))}
                        aria-label={`${label} — ${formatIdr(price.priceIdr)}${hasDiscount ? `, hemat ${formatIdr(hemat)}` : ''}${busyKey === `${pkg.id}:${price.id}` ? ' — memproses' : ''}`}
                      >
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                          {hasDiscount && (
                            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                                {formatIdr(original)}
                              </span>
                              <span className="badge badge-success" style={{ fontSize: 10, padding: '1px 6px' }}>
                                Hemat {formatIdr(hemat)}
                              </span>
                            </span>
                          )}
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{formatIdr(price.priceIdr)}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {!pkg.isFree && !user && (
                <p className="billing-meta" style={{ marginTop: 10 }}>
                  Create a free account to upgrade a workspace.
                </p>
              )}
              {!pkg.isFree && user && !effectiveTeamId && teams && teams.length > 0 && (
                <p className="billing-meta" style={{ marginTop: 8 }}>
                  Pilih workspace di atas untuk melanjutkan.
                </p>
              )}
            </section>
          ))}
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
          Payment via QRIS / Virtual Account (Pakasir). Upgrades apply per workspace; renewal is
          manual — we remind you before expiry.
        </p>
      </div>
    </div>
  );
}
