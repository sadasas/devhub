import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CaretDown, Check, Lock, Lightning, Star } from '@phosphor-icons/react';
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

function formatDuration(days: number): string {
  const months = Math.round(days / 30);
  return months === 1 ? '1 bulan' : `${months} bulan`;
}

function savingsPercent(original: number, discounted: number): number {
  return Math.round(((original - discounted) / original) * 100);
}

function computeBenefits(pkg: BillingPackage): string[] {
  const benefits: string[] = [];
  if (pkg.maxMembers === null) {
    benefits.push('Unlimited members');
  } else {
    benefits.push(`${pkg.maxMembers} members`);
  }
  if (pkg.maxProjects === null) {
    benefits.push('Unlimited projects');
  } else {
    benefits.push(`${pkg.maxProjects} projects`);
  }
  return benefits;
}

const STATIC_BENEFITS = ['Semua fitur core', 'Export JSON', 'Priority support'];

const FAQ_ITEMS = [
  {
    q: 'Bagaimana cara upgrade?',
    a: 'Pilih workspace yang ingin di-upgrade, lalu pilih paket Pro dan durasi pembayaran. Setelah bayar, plan akan aktif otomatis setelah pembayaran dikonfirmasi.',
  },
  {
    q: 'Apakah ada free trial?',
    a: 'Tidak ada free trial, tapi paket Free tersedia tanpa batas waktu.',
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
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    if (queryTeamId) setSelectedTeamId(queryTeamId);
  }, [queryTeamId]);

  const effectiveTeamId =
    queryTeamId && teams?.some((t) => t.id === queryTeamId) ? queryTeamId : selectedTeamId;

  const proPkg = useMemo(() => packages?.find((p) => !p.isFree) ?? null, [packages]);
  const freePkg = useMemo(() => packages?.find((p) => p.isFree) ?? null, [packages]);

  // Default to cheapest price
  useEffect(() => {
    if (proPkg && !selectedPriceId) {
      setSelectedPriceId(proPkg.prices[0]?.id ?? null);
    }
  }, [proPkg, selectedPriceId]);

  const selectedPrice = useMemo(
    () => proPkg?.prices.find((p) => p.id === selectedPriceId) ?? null,
    [proPkg, selectedPriceId],
  );

  const proBenefits = useMemo(() => (proPkg ? computeBenefits(proPkg) : []), [proPkg]);

  async function onBuy() {
    if (!proPkg || !selectedPriceId) return;
    if (!effectiveTeamId) {
      setActionError('Pilih workspace yang akan di-upgrade.');
      return;
    }
    setActionError(null);
    setBusyKey(`${proPkg.id}:${selectedPriceId}`);
    try {
      const result = await api.startCheckout(effectiveTeamId, proPkg.id, selectedPriceId);
      window.location.assign(result.url);
    } catch (err) {
      setActionError(getErrorMessage(err, 'Gagal memulai checkout.'));
      setBusyKey(null);
    }
  }

  useEffect(() => {
    api
      .listPackages()
      .then((res) => setPackages(res.packages))
      .catch((err) => setError(getErrorMessage(err, 'Gagal memuat paket.')));
  }, []);

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
            <ArrowLeft size={14} aria-hidden="true" /> Kembali
          </button>
          <h1 className="page-title pricing-title">Mulai gratis, upgrade saat timmu butuh.</h1>
          <p className="page-subtitle">
            Semua fitur core tersedia di kedua plan — limit yang berbeda.
          </p>
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
          {/* Free card */}
          {freePkg && (
            <section className="pricing-card" aria-label={`${freePkg.name} plan`}>
              <h2 className="pricing-plan-name">{freePkg.name}</h2>
              {freePkg.description && <p className="page-subtitle">{freePkg.description}</p>}
              <p className="pricing-price">Rp 0</p>
              <ul className="pricing-features">
                {computeBenefits(freePkg).map((b) => (
                  <li key={b}>
                    <Check size={13} weight="bold" aria-hidden="true" />
                    {b}
                  </li>
                ))}
                <li>
                  <Check size={13} weight="bold" aria-hidden="true" />
                  Semua fitur core
                </li>
                <li>
                  <Check size={13} weight="bold" aria-hidden="true" />
                  Export JSON
                </li>
              </ul>
              <Button variant="ghost" size="sm" disabled>
                Paket saat ini
              </Button>
            </section>
          )}

          {/* Pro card */}
          {proPkg && (
            <section className="pricing-card pricing-card-pro" aria-label={`${proPkg.name} plan`}>
              <div className="pricing-pro-header">
                <p className="pricing-recommended">
                  <Star size={11} weight="fill" aria-hidden="true" /> Recommended
                </p>
                <h2 className="pricing-plan-name">{proPkg.name}</h2>
                {proPkg.description && <p className="page-subtitle">{proPkg.description}</p>}
              </div>

              {/* Duration selector */}
              <div>
                <p className="pricing-duration-label">Pilih periode:</p>
                <div className="pricing-duration-grid" role="group" aria-label="Pilih durasi">
                  {proPkg.prices.map((price) => {
                    const original = (price as unknown as { originalPriceIdr?: number | null })
                      .originalPriceIdr;
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
                          {formatDuration(price.durationDays)}
                        </span>
                        <span className="pricing-duration-price">
                          {formatIdr(price.priceIdr)}
                        </span>
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

              {/* Total */}
              {selectedPrice && (
                <p className="pricing-total-line">
                  Total: {formatIdr(selectedPrice.priceIdr)} untuk{' '}
                  {formatDuration(selectedPrice.durationDays)}
                </p>
              )}

              <hr className="pricing-divider" />

              {/* Benefits */}
              <ul className="pricing-benefits">
                {proBenefits.map((b) => (
                  <li key={b}>
                    <Check size={13} weight="bold" aria-hidden="true" />
                    {b}
                  </li>
                ))}
                {STATIC_BENEFITS.map((b) => (
                  <li key={b}>
                    <Check size={13} weight="bold" aria-hidden="true" />
                    {b}
                  </li>
                ))}
              </ul>

              <hr className="pricing-divider" />

              {/* Checkout */}
              <div className="pricing-checkout">
                <div className="field">
                  <label className="field-label" htmlFor="pricing-team">
                    Workspace
                  </label>
                  <SearchableSelect
                    id="pricing-team"
                    placeholder="Pilih workspace"
                    value={selectedTeamId || null}
                    options={(teams ?? []).map((t) => ({ value: t.id, label: t.name }))}
                    onChange={(v) => setSelectedTeamId(v ?? '')}
                  />
                </div>

                {actionError && <InlineError>{actionError}</InlineError>}

                <Button
                  variant="primary"
                  disabled={!user || !effectiveTeamId}
                  loading={!!busyKey}
                  onClick={() => void onBuy()}
                >
                  {selectedPrice
                    ? `Upgrade ke Pro — ${formatIdr(selectedPrice.priceIdr)}`
                    : 'Upgrade ke Pro'}
                </Button>

                {!effectiveTeamId && (
                  <p className="page-subtitle">Pilih workspace di atas untuk melanjutkan.</p>
                )}

                {!user && (
                  <p className="page-subtitle">Buat akun gratis untuk upgrade workspace.</p>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Why upgrade */}
      {proPkg && freePkg && (
        <div className="pricing-why">
          <h3 className="pricing-section-label">Kenapa upgrade ke Pro?</h3>
          <ul className="pricing-benefits">
            {proBenefits.map((b) => (
              <li key={b}>
                <Check size={13} weight="bold" aria-hidden="true" />
                {b}
              </li>
            ))}
            {STATIC_BENEFITS.map((b) => (
              <li key={b}>
                <Check size={13} weight="bold" aria-hidden="true" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* FAQ */}
      <div className="pricing-faq">
        <p className="pricing-section-label">Pertanyaan Umum</p>
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

      {/* Trust */}
      <div className="pricing-trust">
        <Lock size={13} aria-hidden="true" />
        <span>Pembayaran aman via QRIS / Virtual Account</span>
      </div>
      <p className="page-subtitle" style={{ textAlign: 'center' }}>
        Powered by Pakasir
      </p>

      <div className="page-footer">
        {!user && (
          <Button variant="primary" onClick={() => navigate('/')}>
            <Lightning size={14} weight="duotone" aria-hidden="true" />
            Buat akun gratis
          </Button>
        )}
        <p className="page-subtitle">
          Pembayaran melalui QRIS / Virtual Account (Pakasir). Upgrade per workspace; perpanjangan
          manual.
        </p>
      </div>
    </div>
  );
}
