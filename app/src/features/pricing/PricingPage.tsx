import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CaretDown, Check, Lock, Lightning, Star } from '@phosphor-icons/react';
import { useNavigate, useSearchParams } from 'react-router';
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
    a: 'Pilih workspace yang ingin di-upgrade, lalu pilih paket dan durasi pembayaran. Setelah bayar, plan akan aktif otomatis setelah pembayaran dikonfirmasi.',
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
  const original = price.originalPriceIdr;
  const hasDisc = typeof original === 'number' && original > price.priceIdr;
  return (
    <button
      type="button"
      className={`pricing-duration-card${isActive ? ' pricing-duration-card-active' : ''}`}
      aria-pressed={isActive}
      onClick={() => onSelect(pkgId, price.id)}
    >
      <span className="pricing-duration-name">{formatDuration(price.durationDays)}</span>
      {hasDisc && (
        <span className="pricing-duration-original">{formatIdr(original)}</span>
      )}
      <span className="pricing-duration-price">{formatIdr(price.priceIdr)}</span>
      {hasDisc && (
        <span className="pricing-duration-savings">
          Hemat {savingsPercent(original, price.priceIdr)}%
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
  busyKey,
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
  busyKey: string | null;
  user: { id: string } | null;
  teams: { id: string; name: string }[] | null;
  actionError: string | null;
}) {
  const selectedPrice = pkg.prices.find((p) => p.id === selectedPriceId) ?? null;
  const benefits = computeBenefits(pkg);

  return (
    <section
      className={`pricing-card${isRecommended ? ' pricing-card-pro' : ''}`}
      aria-label={`${pkg.name} plan`}
    >
      {isRecommended && (
        <div className="pricing-pro-header">
          <p className="pricing-recommended">
            <Star size={11} weight="fill" aria-hidden="true" /> Recommended
          </p>
        </div>
      )}

      <h2 className="pricing-plan-name">{pkg.name}</h2>
      {pkg.description && <p className="page-subtitle">{pkg.description}</p>}

      {pkg.prices.length > 0 ? (
        <>
          <div>
            <p className="pricing-duration-label">Pilih periode:</p>
            <div className="pricing-duration-grid" role="group" aria-label="Pilih durasi">
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
              Total: {selectedPrice.originalPriceIdr != null && selectedPrice.originalPriceIdr > selectedPrice.priceIdr ? (
                <>{formatIdr(selectedPrice.originalPriceIdr)} → </>
              ) : null}
              {formatIdr(selectedPrice.priceIdr)} untuk {formatDuration(selectedPrice.durationDays)}
            </p>
          )}
        </>
      ) : (
        <p className="pricing-price">Rp 0</p>
      )}

      <hr className="pricing-divider" />

      <ul className="pricing-benefits">
        {benefits.map((b) => (
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

      <div className="pricing-checkout">
        {pkg.prices.length > 0 && (
          <div className="field">
            <label className="field-label" htmlFor={`pricing-team-${pkg.id}`}>
              Workspace
            </label>
            <SearchableSelect
              id={`pricing-team-${pkg.id}`}
              placeholder="Pilih workspace"
              value={selectedTeamId || null}
              options={(teams ?? []).map((t) => ({ value: t.id, label: t.name }))}
              onChange={(v) => onSelectTeam(v ?? '')}
            />
          </div>
        )}

        {isRecommended && actionError && <InlineError>{actionError}</InlineError>}

        {pkg.prices.length > 0 ? (
          <Button
            variant={isRecommended ? 'primary' : 'secondary'}
            disabled={!user || !selectedTeamId}
            loading={!!busyKey}
            onClick={() => {
              const priceId = selectedPriceId ?? pkg.prices[0]?.id;
              if (priceId) onBuy(pkg.id, priceId);
            }}
          >
            {selectedPrice
              ? `Upgrade ke ${pkg.name} — ${formatIdr(selectedPrice.priceIdr)}`
              : `Upgrade ke ${pkg.name}`}
          </Button>
        ) : (
          <Button variant="ghost" size="sm" disabled>
            Paket saat ini
          </Button>
        )}

        {isRecommended && !selectedTeamId && (
          <p className="page-subtitle">Pilih workspace di atas untuk melanjutkan.</p>
        )}
      </div>
    </section>
  );
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
  const [selectedPrices, setSelectedPrices] = useState<Record<string, string>>({});
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    if (queryTeamId) setSelectedTeamId(queryTeamId);
  }, [queryTeamId]);

  const effectiveTeamId =
    queryTeamId && teams?.some((t) => t.id === queryTeamId) ? queryTeamId : selectedTeamId;

  const freePkgs = (packages ?? []).filter((p) => p.isFree);
  const paidPkgs = (packages ?? []).filter((p) => !p.isFree);

  const initRef = useRef(false);
  useEffect(() => {
    if (!packages || initRef.current) return;
    initRef.current = true;
    const init: Record<string, string> = {};
    for (const pkg of packages) {
      if (!pkg.isFree && pkg.prices.length > 0) {
        init[pkg.id] = pkg.prices[0].id;
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
      setActionError('Pilih workspace yang akan di-upgrade.');
      return;
    }
    setActionError(null);
    setBusyKey(`${pkgId}:${priceId}`);
    try {
      const result = await api.startCheckout(effectiveTeamId, pkgId, priceId);
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
          <p className="page-subtitle">Semua fitur core tersedia — limit yang berbeda.</p>
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
              busyKey={busyKey}
              user={user}
              teams={teams}
              actionError={null}
            />
          ))}
          {paidPkgs.map((pkg, i) => (
            <PricingCard
              key={pkg.id}
              pkg={pkg}
              isRecommended={i === 0}
              selectedPriceId={selectedPrices[pkg.id] ?? pkg.prices[0]?.id ?? null}
              onSelectPrice={handleSelectPrice}
              onSelectTeam={setSelectedTeamId}
              selectedTeamId={selectedTeamId}
              onBuy={handleBuy}
              busyKey={busyKey}
              user={user}
              teams={teams}
              actionError={i === 0 ? actionError : null}
            />
          ))}
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
