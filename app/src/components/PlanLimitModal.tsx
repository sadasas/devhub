import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, Lightning } from '@phosphor-icons/react';
import { api } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import type { BillingPackage, PackagePrice } from '../lib/types';
import { Button } from './Button';
import { Modal } from './Modal';

export type PlanLimitResource = 'projects' | 'members';

interface PlanLimitModalProps {
  open: boolean;
  resource: PlanLimitResource | null;
  teamId: string;
  onClose: () => void;
}

const COPY: Record<PlanLimitResource, string> = {
  projects: 'Project limit reached on your current plan.',
  members: 'Member limit reached on your current plan.',
};

function formatIdr(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

function limitsLabel(maxMembers: number | null, maxProjects: number | null): string {
  const m = maxMembers === null ? 'Unlimited members' : `${maxMembers} members`;
  const p = maxProjects === null ? 'Unlimited projects' : `${maxProjects} projects`;
  return `${m} · ${p}`;
}


export function PlanLimitModal({ open, resource, teamId, onClose }: PlanLimitModalProps) {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<BillingPackage[] | null>(null);
  const [selectedPkg, setSelectedPkg] = useState<BillingPackage | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<PackagePrice | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paidPackages = (packages ?? []).filter((p) => !p.isFree && p.prices.length > 0);

  useEffect(() => {
    if (!open) return;
    setPackages(null);
    setSelectedPkg(null);
    setSelectedPrice(null);
    setError(null);
    api
      .listPackages()
      .then((res) => {
        setPackages(res.packages);
        const first = res.packages.find((p) => !p.isFree && p.prices.length > 0) ?? null;
        if (first) setSelectedPkg(first);
      })
      .catch((err) => setError(getErrorMessage(err, 'Failed to load packages.')));
  }, [open]);

  async function onUpgrade() {
    if (!selectedPkg || !selectedPrice) return;
    setError(null);
    setUpgrading(true);
    try {
      const result = await api.startCheckout(teamId, selectedPkg.id, selectedPrice.id);
      window.location.assign(result.url);
    } catch (err) {
      if (!getErrorMessage(err, '').includes('not available')) {
        setError(getErrorMessage(err, 'Failed to start checkout.'));
        setUpgrading(false);
      } else {
        // Billing belum aktif — arahkan ke halaman pricing.
        navigate('/pricing');
      }
    }
  }

  return (
    <Modal
      open={open && resource !== null}
      title="Upgrade workspace"
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Not now
          </Button>
          <Button
            variant="primary"
            loading={upgrading}
            disabled={!selectedPkg || !selectedPrice}
            onClick={() => void onUpgrade()}
          >
            <Lightning size={14} weight="duotone" aria-hidden="true" />
            Upgrade Pro
          </Button>
        </>
      }
    >
      <div className="form-stack">
        <p className="modal-copy">{resource ? COPY[resource] : ''}</p>

        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}

        {packages === null ? (
          <p className="modal-copy">Loading packages…</p>
        ) : paidPackages.length === 0 ? (
          <p className="modal-copy">
            No upgrade packages are available right now — contact the operator.
          </p>
        ) : (
          <>
            {paidPackages.length > 1 && (
              <div className="field">
                <label className="field-label">Package</label>
                <div className="billing-period-actions">
                  {paidPackages.map((p) => (
                    <Button
                      key={p.id}
                      variant={selectedPkg?.id === p.id ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => {
                        setSelectedPkg(p);
                        setSelectedPrice(null);
                      }}
                    >
                      {p.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {selectedPkg && (
              <>
                <ul className="pricing-features">
                  <li>
                    <Check size={13} weight="bold" aria-hidden="true" />
                    {limitsLabel(selectedPkg.maxMembers, selectedPkg.maxProjects)}
                  </li>
                </ul>
                <div className="field">
                  <label className="field-label">Subscription length</label>
                  <div className="usage-meter-list">
                    {selectedPkg.prices.map((price) => (
                      <button
                        key={price.id}
                        type="button"
                        className={`usage-meter usage-price-row${
                          selectedPrice?.id === price.id ? ' usage-price-selected' : ''
                        }`}
                        onClick={() => setSelectedPrice(price)}
                      >
                        <span className="usage-meter-label">
                          {price.durationDays} days
                        </span>
                        <span className="usage-meter-value usage-price-amount">
                          {formatIdr(price.priceIdr)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <button type="button" className="back-btn" onClick={() => navigate('/pricing')}>
              Perbandingan lengkap →
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
