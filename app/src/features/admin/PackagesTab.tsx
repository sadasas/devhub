import { useCallback, useEffect, useState } from 'react';
import { Package, PencilSimple, Power, Trash } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { AdminPackage } from '../../lib/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { Skeleton } from '../../components/Skeleton';
import { formatIdr } from '../../lib/format';
import { PackageModal } from './PackageModal';

interface PackagesTabProps {
  refreshKey: number;
  onSettled?: () => void;
}

export function PackagesTab({ refreshKey, onSettled }: PackagesTabProps) {
  const { t } = useTranslation('extras');
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
      setError(getErrorMessage(err, t('admin.packages.errors.load')));
    } finally {
      onSettled?.();
    }
  }, [t, onSettled]);

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
      setError(getErrorMessage(err, t('admin.packages.errors.update')));
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
      setError(getErrorMessage(err, t('admin.packages.errors.delete')));
    } finally {
      setBusyPackageId(null);
      setDeleteDialogOpen(false);
      setDeletingPackage(null);
    }
  }

  return (
    <section className="tab-panel" aria-label={t('admin.packages.aria')}>
      <p role="status" aria-live="polite" className="sr-only">
        {packages === null ? t('admin.loading') : t('admin.packages.count', { count: packages.length })}
      </p>
      <div className="admin-filter-bar mb-12">
        <span className="page-subtitle admin-filter-count">
          {packages !== null ? t('admin.packages.count', { count: packages.length }) : ''}
        </span>
        <span className="admin-filter-spacer" />
        <Button
          size="sm"
          leftIcon={<Package size={13} aria-hidden="true" />}
          onClick={() => { setEditingPackage(null); setPackageModalOpen(true); }}
        >
          {t('admin.packages.new')}
        </Button>
      </div>
      {error ? (
        <InlineError className="mb-12">
          {error}{' '}
          <Button variant="ghost" size="sm" onClick={() => void loadPackages()}>
            {t('admin.retry')}
          </Button>
        </InlineError>
      ) : packages === null ? (
        <div className="admin-packages-grid">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} style={{ width: '100%', height: 160 }} />
          ))}
        </div>
      ) : packages.length === 0 ? (
        <EmptyState
          icon={<Package size={22} />}
          title={t('admin.packages.emptyTitle')}
          description={t('admin.packages.emptyDesc')}
        />
      ) : (
        <div className="admin-packages-grid">
          {packages.map((pkg) => (
            <div key={pkg.id} className="admin-package-card">
              <div className="admin-package-card-head">
                <span className="admin-package-name">{pkg.name}</span>
                <Badge tone={pkg.isActive ? 'success' : 'neutral'}>
                  {pkg.isActive ? t('admin.packages.active') : t('admin.packages.inactive')}
                </Badge>
              </div>
              {pkg.description && (
                <p className="admin-package-desc">{pkg.description}</p>
              )}
              <div className="admin-package-limits">
                <span className="admin-package-limit">
                  {t('admin.packages.maxMembers', { value: pkg.maxMembers === null ? t('common:usage.unlimited') : pkg.maxMembers })}
                </span>
                <span className="admin-package-limit">
                  {t('admin.packages.maxProjects', { value: pkg.maxProjects === null ? t('common:usage.unlimited') : pkg.maxProjects })}
                </span>
              </div>
              {pkg.prices.length > 0 && (
                <div className="admin-package-prices">
                  {pkg.prices.map((price) => (
                    <div key={price.id} className="admin-package-price-row">
                      <span className="admin-package-price-duration">
                        {t('admin.packages.durationDays', { count: price.durationDays })}
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
                  {t('admin.packages.edit')}
                </Button>
                <span className="admin-filter-spacer" />
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Power size={13} aria-hidden="true" />}
                  disabled={busyPackageId === pkg.id}
                  onClick={() => void onTogglePackageActive(pkg)}
                >
                  {pkg.isActive ? t('admin.packages.deactivate') : t('admin.packages.activate')}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={<Trash size={13} aria-hidden="true" />}
                  disabled={busyPackageId === pkg.id}
                  onClick={() => void onDeletePackage(pkg)}
                >
                  {t('templates.delete')}
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
        title={t('admin.packages.deleteTitle')}
        description={t('admin.packages.deleteDesc', { name: deletingPackage?.name ?? '' })}
        onConfirm={() => void confirmDeletePackage()}
        onClose={() => { setDeleteDialogOpen(false); setDeletingPackage(null); }}
      />
    </section>
  );
}
