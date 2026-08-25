import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowClockwise, CheckCircle, Package, PencilSimple, Power, Trash } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = (searchParams.get('status') as '' | 'active' | 'inactive') || '';
  const [packages, setPackages] = useState<AdminPackage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyPackageId, setBusyPackageId] = useState<string | null>(null);
  const [packageModalOpen, setPackageModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<AdminPackage | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPackage, setDeletingPackage] = useState<AdminPackage | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const deleteTriggerRef = useRef<HTMLElement | null>(null);
  const latestRequest = useRef(0);

  function updateParam(key: string, value: string | null): void {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  }

  const loadPackages = useCallback(async () => {
    const requestId = ++latestRequest.current;
    try {
      const p = await api.adminListPackages();
      if (latestRequest.current !== requestId) return;
      setPackages(p);
      setError(null);
    } catch (err) {
      if (latestRequest.current !== requestId) return;
      setError(getErrorMessage(err, t('admin.packages.errors.load')));
    } finally {
      if (latestRequest.current === requestId) onSettled?.();
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
      const msg = pkg.isActive ? t('admin.packages.deactivated', { name: pkg.name }) : t('admin.packages.activated', { name: pkg.name });
      setToast(msg);
      window.setTimeout(() => setToast(null), 5000);
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
    deleteTriggerRef.current = document.activeElement as HTMLElement | null;
    setDeletingPackage(pkg);
    setDeleteDialogOpen(true);
  }

  function closeDeleteDialog() {
    setDeleteDialogOpen(false);
    setDeletingPackage(null);
    const trigger = deleteTriggerRef.current;
    if (trigger && document.contains(trigger) && typeof trigger.focus === 'function') {
      window.requestAnimationFrame(() => trigger.focus());
    }
  }

  async function confirmDeletePackage() {
    if (!deletingPackage) return;
    setBusyPackageId(deletingPackage.id);
    setError(null);
    try {
      await api.adminDeletePackage(deletingPackage.id);
      setPackages((prev) => (prev ? prev.filter((p) => p.id !== deletingPackage.id) : prev));
      setToast(t('admin.packages.deleted', { name: deletingPackage.name }));
      window.setTimeout(() => setToast(null), 5000);
      closeDeleteDialog();
    } catch (err) {
      setError(getErrorMessage(err, t('admin.packages.errors.delete')));
      // jangan tutup dialog saat error — biar retry (M5)
    } finally {
      setBusyPackageId(null);
    }
  }

  const filteredPackages = packages
    ? packages.filter((p) => {
        if (statusFilter === 'active') return p.isActive;
        if (statusFilter === 'inactive') return !p.isActive;
        return true;
      })
    : null;

  return (
    <section className="tab-panel" aria-label={t('admin.packages.aria')}>
      <p role="status" aria-live="polite" className="sr-only">
        {packages === null ? t('admin.loading') : t('admin.packages.count', { count: packages.length })}
      </p>
      {toast && (
        <div className="admin-toast" role="status" aria-live="polite" aria-atomic="true">
          <CheckCircle size={14} weight="duotone" aria-hidden="true" />
          {toast}
        </div>
      )}
      <div className="admin-filter-bar mb-12">
        <span className="admin-activity-ranges" role="radiogroup" aria-label={t('admin.packages.filterStatusAria', { defaultValue: 'Filter status' })}>
          <button
            type="button"
            role="radio"
            aria-checked={statusFilter === ''}
            className={`sub-tab ${statusFilter === '' ? 'sub-tab-active' : ''}`}
            onClick={() => updateParam('status', null)}
          >
            {t('admin.packages.allStatuses', { defaultValue: 'Semua' })}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={statusFilter === 'active'}
            className={`sub-tab ${statusFilter === 'active' ? 'sub-tab-active' : ''}`}
            onClick={() => updateParam('status', 'active')}
          >
            {t('admin.packages.active')}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={statusFilter === 'inactive'}
            className={`sub-tab ${statusFilter === 'inactive' ? 'sub-tab-active' : ''}`}
            onClick={() => updateParam('status', 'inactive')}
          >
            {t('admin.packages.inactive')}
          </button>
        </span>
        <span className="page-subtitle admin-filter-count">
          {filteredPackages !== null ? t('admin.packages.count', { count: filteredPackages.length }) : ''}
        </span>
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
          <Button variant="secondary" size="sm" leftIcon={<ArrowClockwise size={12} aria-hidden="true" />} onClick={() => void loadPackages()}>
            {t('admin.retry')}
          </Button>
        </InlineError>
      ) : packages === null ? (
        <div className="admin-packages-grid">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} style={{ width: '100%', height: 160 }} />
          ))}
        </div>
      ) : filteredPackages!.length === 0 ? (
        <EmptyState
          icon={<Package size={22} aria-hidden="true" />}
          title={t('admin.packages.emptyTitle')}
          description={statusFilter ? t('admin.packages.emptyFiltered', { defaultValue: 'Tidak ada paket dengan filter ini.' }) : t('admin.packages.emptyDesc')}
        />
      ) : (
        <div className="admin-packages-grid" role="list">
          {filteredPackages!.map((pkg) => (
            <div key={pkg.id} className="admin-package-card" role="listitem" aria-label={pkg.name}>
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
                <div className="admin-package-prices" role="list" aria-label={t('admin.packages.pricesLabel', { defaultValue: 'Prices' })}>
                  {pkg.prices.map((price) => (
                    <div key={price.id} className="admin-package-price-row" role="listitem">
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
        busy={busyPackageId === deletingPackage?.id}
        onConfirm={() => void confirmDeletePackage()}
        onClose={closeDeleteDialog}
      />
    </section>
  );
}

