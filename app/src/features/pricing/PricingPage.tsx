import { useEffect, useState } from 'react';
import { Check, Lightning, Sparkle } from '@phosphor-icons/react';
import { useNavigate } from 'react-router';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { BillingPackage } from '../../lib/types';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { Skeleton } from '../../components/Skeleton';
import { useAuth } from '../../state/auth-context';

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
  const navigate = useNavigate();
  const [packages, setPackages] = useState<BillingPackage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listPackages()
      .then((res) => setPackages(res.packages))
      .catch((err) => setError(getErrorMessage(err, 'Failed to load packages.')));
  }, []);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Pricing</h1>
          <p className="page-subtitle">
            Per-workspace plans. Start free — upgrade when your workspace grows.
          </p>
        </div>
      </header>

      {error && <InlineError>{error}</InlineError>}

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
                <div className="usage-meter-list">
                  {pkg.prices.map((price) => (
                    <Button
                      key={price.id}
                      variant="primary"
                      size="sm"
                      disabled={!user}
                      onClick={() =>
                        user ? navigate(`/team/?tab=billing`) : navigate('/')
                      }
                    >
                      {formatIdr(price.priceIdr)} / {price.durationDays} days
                    </Button>
                  ))}
                  {!user && (
                    <p className="billing-meta">Create a free account to upgrade a workspace.</p>
                  )}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <div className="page-footer">
        {user ? (
          <Button variant="ghost" onClick={() => navigate('/')}>
            Back to dashboard
          </Button>
        ) : (
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
