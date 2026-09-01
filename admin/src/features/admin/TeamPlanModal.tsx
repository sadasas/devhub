import { useEffect, useRef, useState } from 'react';
import { ArrowClockwise, ArrowLeft, Check, FloppyDisk, X } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { AdminPackage, AdminTeam } from '../../lib/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { Modal } from '../../components/Modal';
import { formatIdr } from '../../lib/format';

interface TeamPlanModalProps {
  open: boolean;
  team: AdminTeam | null;
  onClose: () => void;
  onSaved: (team: AdminTeam) => void;
}

export function TeamPlanModal({ open, team, onClose, onSaved }: TeamPlanModalProps) {
  const { t } = useTranslation('extras');
  const [plan, setPlan] = useState<'free' | 'pro'>('free');
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [packages, setPackages] = useState<AdminPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  // ADR-047 §G: grant paket berbayar = 2 langkah (ringkasan dulu, baru eksekusi).
  const [stage, setStage] = useState<'edit' | 'confirm'>('edit');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didPreselectRef = useRef(false);

  function resetSelection(): void {
    setSelectedPackageId(null);
    setSelectedDays(null);
    setStage('edit');
    setError(null);
  }

  async function loadPackages(): Promise<void> {
    setPackagesLoading(true);
    setPackagesError(null);
    try {
      const p = await api.adminListPackages();
      setPackages(p);
    } catch (err) {
      setPackagesError(getErrorMessage(err, t('admin.teamPlan.errors.packages')));
    } finally {
      setPackagesLoading(false);
    }
  }

  useEffect(() => {
    if (!open || !team) return;
    setPlan(team.plan === 'pro' ? 'pro' : 'free');
    resetSelection();
    didPreselectRef.current = false;
    setBusy(false);
    void loadPackages();
  }, [open, team]);

  // Pre-select snapshot histori: paket + durasi exact jika pro (tanpa tebak) — sekali per open
  useEffect(() => {
    if (didPreselectRef.current) return;
    if (!open || !team || packages.length === 0) return;
    if (team.plan !== 'pro') return;
    const snapPackageId = team.planPackageId;
    const snapDays = team.planDurationDays;
    if (snapPackageId && snapDays) {
      const pkg = packages.find((p) => p.id === snapPackageId && !p.isFree && p.isActive);
      const priceExists = pkg?.prices.some((pr) => pr.durationDays === snapDays);
      if (pkg && priceExists) {
        setSelectedPackageId(snapPackageId);
        setSelectedDays(snapDays);
        setPlan('pro');
        didPreselectRef.current = true;
        return;
      }
    }
    // Fallback: paket snapshot tidak ditemukan (harga diubah/di-nonaktifkan) — pre-select paket saja
    if (snapPackageId) {
      const pkg = packages.find((p) => p.id === snapPackageId && !p.isFree && p.isActive);
      if (pkg) {
        setSelectedPackageId(snapPackageId);
        // durasi tetap null → user pilih chip (tampilkan hint expiry)
        setPlan('pro');
        didPreselectRef.current = true;
      }
    }
    didPreselectRef.current = true;
  }, [open, team, packages]);

  const currentPlan = team?.plan ?? 'free';
  const proPackages = packages.filter((p) => !p.isFree && p.isActive);

  const selectedPkg = proPackages.find((p) => p.id === selectedPackageId) ?? null;
  const selectedPrice =
    selectedPkg?.prices.find((pr) => pr.durationDays === selectedDays) ?? null;

  function handleSelectPackage(pkg: AdminPackage, days: number): void {
    setPlan('pro');
    setSelectedPackageId(pkg.id);
    setSelectedDays(days);
    setStage('edit');
  }

  function handlePrimaryAction(): void {
    if (!team || busy) return;
    if (stage === 'edit') {
      if (plan === 'pro') {
        // Ringkas dulu (summary-confirm); free langsung dieksekusi (reversibel).
        if (!selectedPkg || !selectedPrice) return;
        setStage('confirm');
        return;
      }
      void doSave();
      return;
    }
    void doSave();
  }

  async function doSave(): Promise<void> {
    if (!team) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.adminSetTeamPlan(
        team.id,
        plan,
        plan === 'pro' && selectedPkg && selectedDays ? selectedPkg.id : undefined,
        plan === 'pro' && selectedPkg && selectedDays ? selectedDays : undefined,
      );
      onSaved({
        ...team,
        plan: result.plan,
        planPackageId: plan === 'pro' && selectedPkg ? selectedPkg.id : null,
        planDurationDays: plan === 'pro' && selectedDays ? selectedDays : null,
        planExpiresAt: team.planExpiresAt, // akan di-refresh dari listTeams next fetch; snapshot dijaga sinkron dengan plan
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, t('admin.teamPlan.errors.update')));
    } finally {
      setBusy(false);
    }
  }

  const canProceed = plan === 'free' ? plan !== currentPlan : Boolean(selectedPkg && selectedPrice);

  return (
    <Modal
      open={open}
      title={t('admin.teamPlan.title')}
      onClose={onClose}
      width="md"
      footer={
        <>
          <Button variant="secondary" size="sm" leftIcon={stage === 'confirm' ? <ArrowLeft size={13} aria-hidden="true" /> : <X size={13} aria-hidden="true" />} disabled={busy} onClick={() => {
            if (stage === 'confirm') setStage('edit');
            else onClose();
          }}>
            {stage === 'confirm' ? t('admin.teamPlan.back') : t('common:action.cancel')}
          </Button>
          <Button
            size="sm"
            leftIcon={<FloppyDisk size={13} aria-hidden="true" />}
            loading={busy}
            disabled={!canProceed || busy}
            onClick={handlePrimaryAction}
          >
            {busy
              ? t('admin.teamPlan.saving')
              : stage === 'confirm'
                ? t('admin.teamPlan.confirm')
                : t('admin.teamPlan.save')}
          </Button>
        </>
      }
    >
      {error && <InlineError>{error}</InlineError>}
      {stage === 'confirm' && selectedPkg && selectedPrice ? (
        <div className="form-stack">
          <span className="page-subtitle">{t('admin.teamPlan.confirmTitle')}</span>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)' }}>
            {t('admin.teamPlan.confirmGrant', {
              name: selectedPkg.name,
              days: selectedPrice.durationDays,
              price: formatIdr(selectedPrice.priceIdr),
              team: team?.name ?? '—',
            })}
          </p>
        </div>
      ) : (
        <div className="form-stack">
          <div>
            <span className="page-subtitle">{t('admin.teamPlan.team')}</span>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)' }}>{team?.name ?? '—'}</p>
          </div>
          <div>
            <span className="page-subtitle">{t('admin.teamPlan.currentPlan')}</span>
            <p style={{ margin: '4px 0 0', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge tone={currentPlan === 'pro' ? 'success' : 'neutral'}>
                {currentPlan === 'pro' ? t('admin.plan.pro') : t('admin.plan.free')}
              </Badge>
              {team?.planDurationDays && team.planExpiresAt && (
                <span className="admin-plan-desc" style={{ paddingLeft: 0 }}>
                  {t('admin.teamPlan.currentDuration', {
                    defaultValue: '{{days}} hari · sampai {{date}}',
                    days: team.planDurationDays,
                    date: new Date(team.planExpiresAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
                  })}
                </span>
              )}
            </p>
          </div>
          <div>
            <span className="page-subtitle">{t('admin.teamPlan.newPlan')}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              {/* Free card — tanpa chip durasi, boleh jadi satu tombol */}
              <button
                type="button"
                className={`admin-plan-card ${plan === 'free' ? 'admin-plan-card-selected' : ''}`}
                onClick={() => { setPlan('free'); setSelectedPackageId(null); setSelectedDays(null); }}
                aria-pressed={plan === 'free'}
              >
                <span className="admin-plan-card-row">
                  <span
                    className="admin-plan-radio"
                    data-selected={plan === 'free' ? 'true' : undefined}
                    aria-hidden="true"
                  >
                    {plan === 'free' && <Check size={10} weight="bold" color="var(--accent)" />}
                  </span>
                  <span className="admin-plan-name">{t('admin.plan.free')}</span>
                </span>
                <span className="admin-plan-desc">{t('admin.teamPlan.freeDesc')}</span>
              </button>

              {/* Pro cards — header tombol + chip durasi sebagai SIBLING (bukan nested) */}
              {packagesLoading ? (
                <p className="admin-plan-desc form-helper-italic">{t('admin.loading')}</p>
              ) : packagesError ? (
                <InlineError>
                  {packagesError}{' '}
                  <Button variant="ghost" size="sm" leftIcon={<ArrowClockwise size={13} aria-hidden="true" />} onClick={() => void loadPackages()}>
                    {t('admin.retry')}
                  </Button>
                </InlineError>
              ) : proPackages.length > 0 ? (
                proPackages.map((pkg) => {
                  const cardSelected = plan === 'pro' && selectedPackageId === pkg.id;
                  return (
                    <div
                      key={pkg.id}
                      className={`admin-plan-card ${cardSelected ? 'admin-plan-card-selected' : ''}`}
                    >
                      <button
                        type="button"
                        className="admin-plan-card-head"
                        aria-pressed={cardSelected}
                        onClick={() => {
                          const first = pkg.prices[0];
                          if (first) handleSelectPackage(pkg, first.durationDays);
                        }}
                      >
                        <span className="admin-plan-card-row">
                          <span
                            className="admin-plan-radio"
                            data-selected={cardSelected ? 'true' : undefined}
                            aria-hidden="true"
                          >
                            {cardSelected && <Check size={10} weight="bold" color="var(--accent)" />}
                          </span>
                          <span className="admin-plan-name">{pkg.name}</span>
                        </span>
                        <span className="admin-plan-desc">
                          {pkg.description ||
                            t('admin.teamPlan.packageDesc', {
                              members: pkg.maxMembers === null ? t('common:usage.unlimited') : pkg.maxMembers,
                              projects: pkg.maxProjects === null ? t('common:usage.unlimited') : pkg.maxProjects,
                            })}
                        </span>
                      </button>
                      {pkg.prices.length > 0 && (
                        <div className="admin-plan-chips">
                          {pkg.prices.map((price) => {
                            const chipSelected = cardSelected && selectedDays === price.durationDays;
                            return (
                              <button
                                key={price.id}
                                type="button"
                                className={`btn btn-ghost btn-sm admin-plan-chip ${chipSelected ? 'admin-plan-chip-selected' : ''}`}
                                aria-pressed={chipSelected}
                                onClick={() => handleSelectPackage(pkg, price.durationDays)}
                              >
                                {t('admin.teamPlan.durationPrice', {
                                  days: price.durationDays,
                                  price: formatIdr(price.priceIdr),
                                })}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="admin-plan-desc" style={{ fontStyle: 'italic' }}>
                  {t('admin.teamPlan.noProPackages')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}


