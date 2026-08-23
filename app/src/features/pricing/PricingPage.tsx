import { useEffect, useState } from 'react';
import { ArrowLeft, CaretDown, Check, Lightning, Star } from '@phosphor-icons/react';
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

function formatDuration(days: number): string {
  const months = Math.round(days / 30);
  return months === 1 ? '1 bulan' : `${months} bulan`;
}

function savingsPercent(original: number, discounted: number): number {
  return Math.round(((original - discounted) / original) * 100);
}

const FAQ_ITEMS = [
  {
    q: 'Bagaimana cara upgrade?',
    a: 'Pilih workspace yang ingin di-upgrade, lalu pilih paket Pro dan durasi pembayaran. Setelah bayar, plan akan aktif otomatis setelah pembayaran dikonfirmasi.',
  },
  {
    q: 'Apakah ada free trial?',
    a: 'Tidak ada free trial, tapi paket Free tersedia tanpa batas waktu dengan limit 2 members dan 3 projects.',
  },
  {
    q: 'Bagaimana cara bayar?',
    a: 'Pembayaran melalui QRIS atau Virtual Account via Pakasir. Setelah bayar, pembayaran akan dikonfirmasi otomatis.',
  },
  {
    q: 'Bisa upgrade kapan saja?',
    a: 'Ya, bisa upgrade kapan saja. Sisa hari dari plan sebelumnya akan ditambahkan ke plan baru.',
  },
  {
    q: 'Apa yang terjadi jika plan expired?',
    a: 'Workspace akan kembali ke plan Free. Data tetap aman, tapi limit akan berlaku kembali.',
  },
];

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
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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

  const proPkg = packages?.find((p) => !p.isFree);
  const cheapestPro = proPkg?.prices[0] ?? null;
  const originalCheapest = (cheapestPro as unknown as { originalPriceIdr?: number | null })
    ?.originalPriceIdr;
  const hasDiscCheapest =
    cheapestPro !== null &&
    typeof originalCheapest === 'number' &&
    originalCheapest > cheapestPro.priceIdr;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <button type="button" className="back-btn" onClick={onBack}>
            <ArrowLeft size={14} aria-hidden="true" /> Back
          </button>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            Simple pricing for growing teams
          </h1>
          <p className="page-subtitle">
            Start free. Upgrade when your workspace needs more.
          </p>
        </div>
      </header>

      {error && <InlineError>{error}</InlineError>}

      {/* Step indicator */}
      <div className="pricing-steps">
        <span className={step === 1 ? 'pricing-step-active' : 'pricing-step'}>
          Step 1: Pilih Paket
        </span>
        <span className="pricing-step-arrow">—</span>
        <span className={step === 2 ? 'pricing-step-active' : 'pricing-step'}>
          Step 2: Konfirmasi
        </span>
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
          {(packages ?? []).map((pkg) => (
            <section
              key={pkg.id}
              className={`pricing-card${pkg.isFree ? '' : ' pricing-card-pro'}`}
              aria-label={`${pkg.name} plan`}
            >
              {!pkg.isFree && (
                <p className="pricing-recommended">
                  <Star size={11} weight="fill" aria-hidden="true" /> Recommended
                </p>
              )}
              <h2 className="pricing-plan-name">{pkg.name}</h2>
              {pkg.description && <p className="page-subtitle">{pkg.description}</p>}
              {!pkg.isFree && cheapestPro && (
                <div>
                  <div className="pricing-price">
                    {formatIdr(cheapestPro.priceIdr)}
                    <span className="pricing-period"> / {formatDuration(cheapestPro.durationDays)}</span>
                  </div>
                  {hasDiscCheapest && (
                    <p className="pricing-savings">
                      Hemat {savingsPercent(originalCheapest as number, cheapestPro.priceIdr)}% dengan paket tahunan
                    </p>
                  )}
                </div>
              )}
              {pkg.isFree && <p className="pricing-price">Rp 0</p>}
              {pkg.isFree ? (
                <ul className="pricing-features">
                  <li>
                    <Check size={13} weight="bold" aria-hidden="true" />
                    {limitLine(pkg)}
                  </li>
                  <li>
                    <Check size={13} weight="bold" aria-hidden="true" />
                    All core features
                  </li>
                  <li>
                    <Check size={13} weight="bold" aria-hidden="true" />
                    JSON export
                  </li>
                </ul>
              ) : (
                <ul className="pricing-features">
                  <li>
                    <Check size={13} weight="bold" aria-hidden="true" />
                    Unlimited members
                  </li>
                  <li>
                    <Check size={13} weight="bold" aria-hidden="true" />
                    Unlimited projects
                  </li>
                  <li>
                    <Check size={13} weight="bold" aria-hidden="true" />
                    All core features
                  </li>
                  <li>
                    <Check size={13} weight="bold" aria-hidden="true" />
                    JSON export
                  </li>
                  <li>
                    <Check size={13} weight="bold" aria-hidden="true" />
                    Priority support
                  </li>
                </ul>
              )}
              {!pkg.isFree ? (
                <Button variant="primary" size="sm" onClick={() => handleSelectPackage(pkg)}>
                  Mulai Upgrade
                </Button>
              ) : (
                <Button variant="ghost" size="sm" disabled>
                  Paket saat ini
                </Button>
              )}
            </section>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16, maxWidth: 560 }}>
          {/* Back link */}
          <button type="button" className="pricing-back-link" onClick={() => setStep(1)}>
            <ArrowLeft size={13} aria-hidden="true" /> Kembali
          </button>

          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Konfirmasi Pembelian
          </h2>

          {/* Order summary */}
          {selectedPkg && selectedPrice && (
            <div className="pricing-order-summary">
              <div className="pricing-order-row">
                <span className="pricing-order-label">Plan</span>
                <span className="pricing-order-value">{selectedPkg.name}</span>
              </div>
              <div className="pricing-order-row">
                <span className="pricing-order-label">Member</span>
                <span className="pricing-order-value">
                  {selectedPkg.maxMembers === null ? 'Unlimited' : selectedPkg.maxMembers}
                </span>
              </div>
              <div className="pricing-order-row">
                <span className="pricing-order-label">Project</span>
                <span className="pricing-order-value">
                  {selectedPkg.maxProjects === null ? 'Unlimited' : selectedPkg.maxProjects}
                </span>
              </div>
              <div className="pricing-order-row">
                <span className="pricing-order-label">Durasi</span>
                <span className="pricing-order-value">{formatDuration(selectedPrice.durationDays)}</span>
              </div>
              <div className="pricing-order-row pricing-order-total">
                <span className="pricing-order-label">Total</span>
                <span className="pricing-order-value">{formatIdr(selectedPrice.priceIdr)}</span>
              </div>
            </div>
          )}

          {/* Duration cards */}
          {selectedPkg && (
            <div>
              <p className="pricing-section-label">Durasi</p>
              <div className="pricing-duration-grid" role="group" aria-label="Pilih durasi">
                {selectedPkg.prices.map((price) => {
                  const original = (price as unknown as { originalPriceIdr?: number | null }).originalPriceIdr;
                  const hasDisc = typeof original === 'number' && original > price.priceIdr;
                  const isActive = selectedPriceId === price.id;
                  return (
                    <button
                      key={price.id}
                      type="button"
                      className={`pricing-duration-card${isActive ? ' pricing-duration-card-active' : ''}`}
                      aria-pressed={isActive}
                      onClick={() => setSelectedPriceId(price.id)}
                    >
                      <span className="pricing-duration-name">
                        📅 {formatDuration(price.durationDays)}
                      </span>
                      <span className="pricing-duration-price">{formatIdr(price.priceIdr)}</span>
                      {hasDisc && (
                        <span className="pricing-duration-savings">
                          Hemat {savingsPercent(original as number, price.priceIdr)}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Workspace */}
          <div className="field">
            <label className="field-label" htmlFor="pricing-team-step2">
              Workspace
            </label>
            <SearchableSelect
              id="pricing-team-step2"
              placeholder="Pilih workspace"
              value={selectedTeamId || null}
              options={(teams ?? []).map((t) => ({ value: t.id, label: t.name }))}
              onChange={(v) => setSelectedTeamId(v ?? '')}
            />
          </div>

          {/* CTA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {actionError && <InlineError>{actionError}</InlineError>}
            <Button
              variant="primary"
              disabled={!user || !effectiveTeamId}
              loading={!!busyKey}
              onClick={() => void onBuy()}
            >
              Bayar sekarang
            </Button>
            {!effectiveTeamId && (
              <p className="page-subtitle">Pilih workspace di atas untuk melanjutkan.</p>
            )}
          </div>

          {!user && (
            <p className="page-subtitle">Create a free account to upgrade a workspace.</p>
          )}
        </div>
      )}

      {/* FAQ */}
      <div className="pricing-faq">
        <p className="pricing-section-label" style={{ marginTop: 24 }}>Pertanyaan Umum</p>
        {FAQ_ITEMS.map((item, i) => (
          <div key={i} className="pricing-faq-item">
            <button
              type="button"
              className="pricing-faq-trigger"
              aria-expanded={openFaq === i}
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
            >
              {item.q}
              <CaretDown size={14} weight="bold" aria-hidden="true" />
            </button>
            {openFaq === i && <p className="pricing-faq-answer">{item.a}</p>}
          </div>
        ))}
      </div>

      <div className="page-footer">
        {!user && (
          <Button variant="primary" onClick={() => navigate('/')}>
            <Lightning size={14} weight="duotone" aria-hidden="true" />
            Create a free account
          </Button>
        )}
        <p className="page-subtitle">
          Payment via QRIS / Virtual Account (Pakasir). Upgrades apply per workspace; renewal is manual.
        </p>
      </div>
    </div>
  );
}
