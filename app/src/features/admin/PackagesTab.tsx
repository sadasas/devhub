import { useCallback, useEffect, useState } from 'react';
import { Package, PencilSimple, Power, Trash } from '@phosphor-icons/react';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { AdminPackage } from '../../lib/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { Skeleton } from '../../components/Skeleton';
import { formatIdr } from './charts';
import { PackageModal } from './PackageModal';

export function PackagesTab({ refreshKey }: { refreshKey: number }) {
  const [packages, setPackages] = useState<AdminPackage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyPackageId, setBusyPackageId] = useState<string | null>(null);
  const [packageModalOpen, setPackageModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<AdminPackage | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPackage, setDeletingPackage] = useState<AdminPackage | null>(null);

  const loadPackages = useCallback(async () => {
    setError(null);
    try {
      const p = await api.adminListPackages();
      setPackages(p);
    } catch (err) {
      setPackages([]);
      setError(getErrorMessage(err, 'Failed to load packages'));
    }
  }, []);

  useEffect(() => {
    void loadPackages();
  }, [refreshKey, loadPackages]);

  async function onTogglePackageActive(pkg: AdminPackage) {
    setBusyPackageId(pkg.id);
    setError(null);
    try {
      await api.adminPatchPackage(pkg.id, { isActive: !pkg.isActive });
      setPackages((prev) =>
        prev ? prev.map((p) => (p.id === pkg.id ? { ...p, isActive: !p.isActive } : p)) : prev,
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update package'));
    } finally {
      setBusyPackageId(null);
    }
  }

  function onPackageSaved(saved: AdminPackage) {
    setPackages((prev) => {
      if (!prev) return [saved];
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
  }

  function onDeletePackage(pkg: AdminPackage) {
    setDeletingPackage(pkg);
    setDeleteDialogOpen(true);
  }

  async function confirmDeletePackage() {
    if (!deletingPackage) return;
    setBusyPackageId(deletingPackage.id);
    setError(null);
    try {
      await api.adminDeletePackage(deletingPackage.id);
      setPackages((prev) => (prev ? prev.filter((p) => p.id !== deletingPackage.id) : prev));
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete package'));
    } finally {
      setBusyPackageId(null);
      setDeleteDialogOpen(false);
      setDeletingPackage(null);
    }
  }

  return (
    <section className="tab-panel" role="tabpanel" aria-label="Billing packages">
      <div className="admin-filter-bar mb-12">
        <span className="page-subtitle">
          {packages !== null ? `${packages.length} package${packages.length === 1 ? '' : 's'}` : ''}
        </span>
        <span style={{ flex: 1 }} />
        <Button
          size="sm"
          leftIcon={<Package size={13} aria-hidden="true" />}
          onClick={() => { setEditingPackage(null); setPackageModalOpen(true); }}
        >
          New package
        </Button>
      </div>
      {error && <InlineError>{error}</InlineError>}
      {packages === null && !error ? (
        <div className="admin-packages-grid">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} style={{ width: '100%', height: 160 }} />
          ))}
        </div>
      ) : packages?.length === 0 ? (
        <EmptyState
          icon={<Package size={22} />}
          title="No packages"
          description="Create billing packages to define pricing tiers."
        />
      ) : (
        <div className="admin-packages-grid">
          {packages!.map((pkg) => (
            <div key={pkg.id} className="admin-package-card">
              <div className="admin-package-card-head">
                <span className="admin-package-name">{pkg.name}</span>
                <Badge tone={pkg.isActive ? 'success' : 'neutral'}>
                  {pkg.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              {pkg.description && (
                <p className="admin-package-desc">{pkg.description}</p>
              )}
              <div className="admin-package-limits">
                <span className="admin-package-limit">
                  Max members: {pkg.maxMembers === null ? 'Unlimited' : pkg.maxMembers}
                </span>
                <span className="admin-package-limit">
                  Max projects: {pkg.maxProjects === null ? 'Unlimited' : pkg.maxProjects}
                </span>
              </div>
              {pkg.prices.length > 0 && (
                <div className="admin-package-prices">
                  {pkg.prices.map((price) => (
                    <div key={price.id} className="admin-package-price-row">
                      <span className="admin-package-price-duration">
                        {price.durationDays} days
                      </span>
                      <span className="admin-package-price-amount">
                        {formatIdr(price.priceIdr)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="admin-package-actions">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<PencilSimple size={13} aria-hidden="true" />}
                  disabled={busyPackageId === pkg.id}
                  onClick={() => { setEditingPackage(pkg); setPackageModalOpen(true); }}
                >
                  Edit
                </Button>
                <span style={{ flex: 1 }} />
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Power size={13} aria-hidden="true" />}
                  disabled={busyPackageId === pkg.id}
                  onClick={() => void onTogglePackageActive(pkg)}
                >
                  {pkg.isActive ? 'Deactivate' : 'Activate'}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={<Trash size={13} aria-hidden="true" />}
                  disabled={busyPackageId === pkg.id}
                  onClick={() => void onDeletePackage(pkg)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <PackageModal
        open={packageModalOpen}
        pkg={editingPackage}
        onClose={() => { setPackageModalOpen(false); setEditingPackage(null); }}
        onSaved={onPackageSaved}
      />

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        title="Delete package"
        description={`Delete "${deletingPackage?.name ?? ''}"? This cannot be undone.`}
        onConfirm={() => void confirmDeletePackage()}
        onClose={() => { setDeleteDialogOpen(false); setDeletingPackage(null); }}
      />
    </section>
  );
}
