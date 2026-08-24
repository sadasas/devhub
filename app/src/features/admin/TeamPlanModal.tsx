import { useEffect, useState } from 'react';
import { Check } from '@phosphor-icons/react';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { AdminPackage, AdminTeam } from '../../lib/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { Modal } from '../../components/Modal';

interface TeamPlanModalProps {
  open: boolean;
  team: AdminTeam | null;
  onClose: () => void;
  onSaved: (team: AdminTeam & { plan: string }) => void;
}

function formatIdr(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

export function TeamPlanModal({ open, team, onClose, onSaved }: TeamPlanModalProps) {
  const [plan, setPlan] = useState<'free' | 'pro'>('free');
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [packages, setPackages] = useState<AdminPackage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !team) return;
    setPlan((team as AdminTeam & { plan?: string }).plan === 'pro' ? 'pro' : 'free');
    setSelectedPackageId(null);
    setSelectedDays(null);
    setError(null);
    void api.adminListPackages().then(setPackages).catch(() => setPackages([]));
  }, [open, team]);

  const currentPlan = (team as AdminTeam & { plan?: string })?.plan ?? 'free';
  const proPackages = packages.filter((p) => !p.isFree && p.isActive);

  function handleSelectPackage(pkg: AdminPackage, days: number, _priceIdr: number) {
    setPlan('pro');
    setSelectedPackageId(pkg.id);
    setSelectedDays(days);
  }

  async function handleSave() {
    if (!team) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.adminSetTeamPlan(
        team.id,
        plan,
        plan === 'pro' && selectedPackageId && selectedDays ? selectedPackageId : undefined,
        plan === 'pro' && selectedPackageId && selectedDays ? selectedDays : undefined,
      );
      onSaved({ ...team, plan: result.plan });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update team plan'));
    } finally {
      setBusy(false);
    }
  }

  const canSave = plan !== currentPlan || (plan === 'pro' && selectedPackageId !== null);

  return (
    <Modal
      open={open}
      title="Change team plan"
      onClose={onClose}
      width="md"
      footer={
        <Button onClick={() => void handleSave()} disabled={!canSave || busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      {error && <InlineError>{error}</InlineError>}
      <div className="form-stack">
        <div>
          <span className="page-subtitle">Team</span>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)' }}>{team?.name ?? '—'}</p>
        </div>
        <div>
          <span className="page-subtitle">Current plan</span>
          <p style={{ margin: '4px 0 0' }}>
            <Badge tone={currentPlan === 'pro' ? 'success' : 'neutral'}>
              {currentPlan === 'pro' ? 'Pro' : 'Free'}
            </Badge>
          </p>
        </div>
        <div>
          <span className="page-subtitle">New plan</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            {/* Free card */}
            <button
              type="button"
              className="admin-plan-card"
              style={{
                background: plan === 'free' ? 'var(--accent-dim)' : 'var(--bg-inset)',
                border: `1px solid ${plan === 'free' ? 'var(--accent)' : 'var(--border-hairline)'}`,
                borderRadius: 'var(--radius-card)',
                padding: '12px 14px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onClick={() => { setPlan('free'); setSelectedPackageId(null); setSelectedDays(null); }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 16, height: 16, borderRadius: '50%',
                    border: `2px solid ${plan === 'free' ? 'var(--accent)' : 'var(--border-strong)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {plan === 'free' && <Check size={10} weight="bold" color="var(--accent)" />}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Free</span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)', paddingLeft: 24 }}>
                No expiry · max 2 members · 3 projects
              </p>
            </button>

            {/* Pro cards — one per package */}
            {proPackages.length > 0 ? (
              proPackages.map((pkg) => (
                <div key={pkg.id}>
                  <button
                    type="button"
                    className="admin-plan-card"
                    style={{
                      background: plan === 'pro' && selectedPackageId === pkg.id
                        ? 'var(--accent-dim)' : 'var(--bg-inset)',
                      border: `1px solid ${plan === 'pro' && selectedPackageId === pkg.id
                        ? 'var(--accent)' : 'var(--border-hairline)'}`,
                      borderRadius: 'var(--radius-card)',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                    }}
                    onClick={() => {
                      const first = pkg.prices[0];
                      if (first) {
                        handleSelectPackage(pkg, first.durationDays, first.priceIdr);
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          width: 16, height: 16, borderRadius: '50%',
                          border: `2px solid ${plan === 'pro' && selectedPackageId === pkg.id
                            ? 'var(--accent)' : 'var(--border-strong)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {plan === 'pro' && selectedPackageId === pkg.id && (
                          <Check size={10} weight="bold" color="var(--accent)" />
                        )}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{pkg.name}</span>
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)', paddingLeft: 24 }}>
                      {pkg.description || `${pkg.maxMembers === null ? 'Unlimited' : pkg.maxMembers} members · ${pkg.maxProjects === null ? 'Unlimited' : pkg.maxProjects} projects`}
                    </p>
                    {/* Duration options */}
                    {pkg.prices.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, paddingLeft: 24, flexWrap: 'wrap' }}>
                        {pkg.prices.map((price) => {
                          const selected = selectedPackageId === pkg.id && selectedDays === price.durationDays;
                          return (
                            <button
                              key={price.id}
                              type="button"
                              style={{
                                background: selected ? 'var(--accent-dim)' : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-hairline)'}`,
                                borderRadius: 'var(--radius-sm)',
                                padding: '4px 10px',
                                cursor: 'pointer',
                                fontSize: 12,
                                color: selected ? 'var(--accent)' : 'var(--text-secondary)',
                                fontWeight: selected ? 600 : 400,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectPackage(pkg, price.durationDays, price.priceIdr);
                              }}
                            >
                              {price.durationDays}d — {formatIdr(price.priceIdr)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </button>
                </div>
              ))
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No active Pro packages. Create a package first.
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
