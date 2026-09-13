import { useCallback, useEffect, useRef, useState } from 'react';
import { DownloadSimple, PencilSimple, Plus, Power, Star, Trash } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { AdminPackage } from '../../lib/types';
import { downloadCsv, toCsv } from '../../lib/csv';
import { ToastStack, useToastStack } from '../../components/ToastStack';
import { AdminTable } from '../../components/AdminTable';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { FilterBar } from '../../components/FilterBar';
import { InlineError } from '../../components/InlineError';
import { RowMenu } from '../../components/RowMenu';
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
  const [toggleDialogOpen, setToggleDialogOpen] = useState(false);
  const [togglingPackage, setTogglingPackage] = useState<AdminPackage | null>(null);
  const [featuredDialogOpen, setFeaturedDialogOpen] = useState(false);
  const [featuringPackage, setFeaturingPackage] = useState<AdminPackage | null>(null);
  // Fase 2: ToastStack global reuse (stacking + auto-dismiss + aria-live)
  const { toasts, pushToast, dismissToast } = useToastStack(5000);
  const deleteTriggerRef = useRef<HTMLElement | null>(null);
  const toggleTriggerRef = useRef<HTMLElement | null>(null);
  const featuredTriggerRef = useRef<HTMLElement | null>(null);
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

  function resetFilters(): void {
    updateParam('status', null);
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

  async function confirmTogglePackageActive() {
    if (!togglingPackage) return;
    const pkg = togglingPackage;
    setBusyPackageId(pkg.id);
    setError(null);
    try {
      await api.adminPatchPackage(pkg.id, { isActive: !pkg.isActive });
      setPackages((prev) =>
        prev ? prev.map((p) => (p.id === pkg.id ? { ...p, isActive: !p.isActive } : p)) : prev,
      );
      const msg = pkg.isActive ? t('admin.packages.deactivated', { name: pkg.name }) : t('admin.packages.activated', { name: pkg.name });
      pushToast(msg);
      closeToggleDialog();
    } catch (err) {
      setError(getErrorMessage(err, t('admin.packages.errors.update')));
      // jangan tutup dialog saat error — biar retry
    } finally {
      setBusyPackageId(null);
    }
  }

  function onToggleClick(pkg: AdminPackage) {
    toggleTriggerRef.current = document.activeElement as HTMLElement | null;
    setTogglingPackage(pkg);
    setToggleDialogOpen(true);
  }

  function closeToggleDialog() {
    setToggleDialogOpen(false);
    setTogglingPackage(null);
    const trigger = toggleTriggerRef.current;
    if (trigger && document.contains(trigger) && typeof trigger.focus === 'function') {
      window.requestAnimationFrame(() => trigger.focus());
    }
  }

  function onPackageSaved(saved: AdminPackage) {
    setPackages((prev) => {
      if (!prev) return [saved];
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        // hanya satu rekomendasi — clear flag paket lain secara lokal
        if (saved.isFeatured) {
          return next.map((p) => (p.id === saved.id ? p : p.isFeatured ? { ...p, isFeatured: false } : p));
        }
        return next;
      }
      return [...prev, saved];
    });
  }

  async function confirmSetFeatured() {
    if (!featuringPackage) return;
    const pkg = featuringPackage;
    setBusyPackageId(pkg.id);
    setError(null);
    try {
      const saved = await api.adminPatchPackage(pkg.id, { isFeatured: true });
      onPackageSaved(saved);
      pushToast(t('admin.packages.featuredSet', { name: pkg.name }));
      closeFeaturedDialog();
    } catch (err) {
      setError(getErrorMessage(err, t('admin.packages.errors.update')));
      // jangan tutup dialog saat error — biar retry
    } finally {
      setBusyPackageId(null);
    }
  }

  function onFeaturedClick(pkg: AdminPackage) {
    featuredTriggerRef.current = document.activeElement as HTMLElement | null;
    setFeaturingPackage(pkg);
    setFeaturedDialogOpen(true);
  }

  function closeFeaturedDialog() {
    setFeaturedDialogOpen(false);
    setFeaturingPackage(null);
    const trigger = featuredTriggerRef.current;
    if (trigger && document.contains(trigger) && typeof trigger.focus === 'function') {
      window.requestAnimationFrame(() => trigger.focus());
    }
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
      pushToast(t('admin.packages.deleted', { name: deletingPackage.name }));
      closeDeleteDialog();
    } catch (err) {
      setError(getErrorMessage(err, t('admin.packages.errors.delete')));
      // jangan tutup dialog saat error — biar retry (M5)
    } finally {
      setBusyPackageId(null);
    }
  }

  function handleExport(): void {
    if (!filteredPackages || filteredPackages.length === 0) return;
    const rows: Array<Record<string, unknown>> = filteredPackages.flatMap(
      (pkg): Array<Record<string, unknown>> =>
        pkg.prices.length > 0
          ? pkg.prices.map((pr) => ({
              name: pkg.name,
              isActive: pkg.isActive ? 'active' : 'inactive',
              maxMembers: pkg.maxMembers ?? '',
              maxProjects: pkg.maxProjects ?? '',
              durationDays: pr.durationDays,
              priceIdr: pr.priceIdr,
            }))
          : [
              {
                name: pkg.name,
                isActive: pkg.isActive ? 'active' : 'inactive',
                maxMembers: pkg.maxMembers ?? '',
                maxProjects: pkg.maxProjects ?? '',
                durationDays: '',
                priceIdr: '',
              },
            ],
    );
    const csv = toCsv(rows,
      [
        { key: 'name', label: 'name' },
        { key: 'isActive', label: 'isActive' },
        { key: 'maxMembers', label: 'maxMembers' },
        { key: 'maxProjects', label: 'maxProjects' },
        { key: 'durationDays', label: 'durationDays' },
        { key: 'priceIdr', label: 'priceIdr' },
      ],
    );
    downloadCsv('admin-packages', csv);
  }

  const filteredPackages = packages
    ? packages.filter((p) => {
        if (statusFilter === 'active') return p.isActive;
        if (statusFilter === 'inactive') return !p.isActive;
        return true;
      })
    : null;

  const isFiltered = statusFilter !== '';

  return (
    <section className="tab-panel" aria-label={t('admin.packages.aria')}>
      <p role="status" aria-live="polite" className="sr-only">
        {packages === null ? t('admin.loading') : t('admin.packages.count', { count: packages.length })}
      </p>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Header kanan: Export sekunder + Paket Baru primer tunggal */}
      <div className="tab-toolbar">
        <span className="tab-toolbar-title">{t('admin.tabs.packages')}</span>
        <span className="tab-toolbar-actions">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<DownloadSimple size={13} aria-hidden="true" />}
            disabled={!filteredPackages || filteredPackages.length === 0}
            onClick={handleExport}
            aria-label={t('admin.export')}
            title={t('admin.export')}
          >
            {t('admin.export')}
          </Button>
          <Button size="sm" leftIcon={<Plus size={13} weight="bold" aria-hidden="true" />} onClick={() => { setEditingPackage(null); setPackageModalOpen(true); }}>
            {t('admin.packages.new')}
          </Button>
        </span>
      </div>

      <FilterBar
        segments={[
          { value: '', label: t('admin.packages.allStatuses', { defaultValue: 'Semua' }) },
          { value: 'active', label: t('admin.packages.active') },
          { value: 'inactive', label: t('admin.packages.inactive') },
        ]}
        selectedSegment={statusFilter}
        onSegmentChange={(v) => updateParam('status', v)}
        segmentsAriaLabel={t('admin.packages.filterStatusAria', { defaultValue: 'Filter status' })}
        countText={filteredPackages !== null ? t('admin.packages.count', { count: filteredPackages.length }) : undefined}
      />

      {error ? (
        <InlineError className="mb-12">
          {error}{' '}
          <Button variant="ghost" size="sm" onClick={() => void loadPackages()}>
            {t('admin.retry')}
          </Button>
        </InlineError>
      ) : packages === null ? (
        <div role="status" aria-busy="true" aria-label="Loading packages">
          <span className="sr-only">Loading packages…</span>
          <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="data-row" style={{ height: 56 }}>
                <Skeleton style={{ width: '40%', height: 14 }} />
                <Skeleton style={{ width: 56, height: 18, borderRadius: 999 }} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <AdminTable<AdminPackage>
          caption={t('admin.packages.aria')}
          columns={[
            {
              key: 'package',
              label: t('admin.packages.colPackage'),
              render: (pkg) => (
                <span className="cell-stack">
                  <span className="data-row-title">
                    <span className="row-title-text">{pkg.name}</span>
                    {pkg.isFeatured && (
                      <Badge tone="accent" dot>
                        {t('admin.packages.featured')}
                      </Badge>
                    )}
                    {pkg.isFree && <Badge tone="neutral">{t('admin.plan.free')}</Badge>}
                  </span>
                  {pkg.description && <span className="data-row-meta">{pkg.description}</span>}
                </span>
              ),
            },
            {
              key: 'limits',
              label: t('admin.packages.colLimits'),
              render: (pkg) => (
                <span className="cell-stack">
                  <span className="data-row-meta tabular">
                    {t('admin.packages.maxMembers', { value: pkg.maxMembers === null ? t('common:usage.unlimited') : pkg.maxMembers })}
                  </span>
                  <span className="data-row-meta tabular">
                    {t('admin.packages.maxProjects', { value: pkg.maxProjects === null ? t('common:usage.unlimited') : pkg.maxProjects })}
                  </span>
                </span>
              ),
            },
            {
              key: 'prices',
              label: t('admin.packages.colPrices'),
              align: 'right',
              numeric: true,
              render: (pkg) =>
                pkg.prices.length > 0 ? (
                  <span className="cell-stack" style={{ alignItems: 'flex-end' }}>
                    {pkg.prices.map((price) => (
                      <span key={price.id} className="data-row-meta tabular" style={{ justifyContent: 'flex-end', opacity: price.isActive ? undefined : 0.65 }}>
                        <span>{t('admin.packages.durationDays', { count: price.durationDays })}</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatIdr(price.priceIdr)}</span>
                        {/* Indikator harga nonaktif (Opsi B: badge netral) — aktif tanpa badge */}
                        {!price.isActive && (
                          <Badge tone="neutral">{t('admin.packages.inactive')}</Badge>
                        )}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="data-row-meta">{t('admin.packages.noPrices')}</span>
                ),
            },
            {
              key: 'status',
              label: t('admin.packages.colStatus'),
              align: 'center',
              render: (pkg) => (
                // Badge nonaktif = neutral dim, bukan danger (Opsi B)
                <Badge tone={pkg.isActive ? 'success' : 'neutral'}>
                  {pkg.isActive ? t('admin.packages.active') : t('admin.packages.inactive')}
                </Badge>
              ),
            },
          ]}
          rows={filteredPackages ?? []}
          getRowId={(pkg) => pkg.id}
          // Opsi B: harga nonaktif = baris dim + badge netral
          getRowDimmed={(pkg) => !pkg.isActive}
          rowMenu={(pkg) => {
            const busy = busyPackageId === pkg.id;
            return (
              <RowMenu
                label={t('admin.table.rowActions')}
                disabled={busy}
                items={[
                  {
                    key: 'edit',
                    label: t('admin.packages.edit'),
                    icon: <PencilSimple size={13} aria-hidden="true" />,
                    disabled: busy,
                    onSelect: () => {
                      setEditingPackage(pkg);
                      setPackageModalOpen(true);
                    },
                  },
                  {
                    key: 'toggle',
                    label: pkg.isActive ? t('admin.packages.deactivate') : t('admin.packages.activate'),
                    icon: <Power size={13} aria-hidden="true" />,
                    disabled: busy,
                    onSelect: () => onToggleClick(pkg),
                  },
                  ...(!pkg.isFeatured && !pkg.isFree
                    ? [
                        {
                          key: 'featured',
                          label: t('admin.packages.setFeatured'),
                          icon: <Star size={13} aria-hidden="true" />,
                          disabled: busy,
                          onSelect: () => onFeaturedClick(pkg),
                        } as const,
                      ]
                    : []),
                  {
                    key: 'delete',
                    label: t('templates.delete'),
                    icon: <Trash size={13} aria-hidden="true" />,
                    danger: true,
                    disabled: busy,
                    onSelect: () => onDeletePackage(pkg),
                  },
                ]}
              />
            );
          }}
          isFiltered={isFiltered}
          emptyFilteredTitle={t('admin.packages.emptyTitle')}
          emptyFilteredDesc={t('admin.packages.emptyFiltered', { defaultValue: 'Tidak ada paket dengan filter ini.' })}
          emptyTotalTitle={t('admin.packages.emptyTitle')}
          emptyTotalDesc={t('admin.packages.emptyDesc')}
          onResetFilters={resetFilters}
        />
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

      <ConfirmDeleteDialog
        open={toggleDialogOpen}
        title={togglingPackage?.isActive ? t('admin.packages.deactivateTitle') : t('admin.packages.activateTitle')}
        description={
          togglingPackage?.isActive
            ? t('admin.packages.deactivateDesc', { name: togglingPackage?.name ?? '' })
            : t('admin.packages.activateDesc', { name: togglingPackage?.name ?? '' })
        }
        confirmLabel={togglingPackage?.isActive ? t('admin.packages.deactivateConfirm') : t('admin.packages.activateConfirm')}
        // Confirm non-destruktif (Activate) = varian non-danger
        tone={togglingPackage?.isActive ? 'danger' : 'default'}
        busy={busyPackageId === togglingPackage?.id}
        onConfirm={() => void confirmTogglePackageActive()}
        onClose={closeToggleDialog}
      />

      <ConfirmDeleteDialog
        open={featuredDialogOpen}
        title={
          packages?.some((p) => p.isFeatured)
            ? t('admin.packages.featuredReplaceTitle')
            : t('admin.packages.featuredSetNewTitle')
        }
        description={
          (() => {
            const current = packages?.find((p) => p.isFeatured);
            if (current && featuringPackage && current.id !== featuringPackage.id) {
              return t('admin.packages.featuredReplaceDesc', { name: featuringPackage?.name ?? '', current: current.name });
            }
            return t('admin.packages.featuredSetNewDesc', { name: featuringPackage?.name ?? '' });
          })()
        }
        confirmLabel={t('admin.packages.setFeatured')}
        tone="default"
        busy={busyPackageId === featuringPackage?.id}
        onConfirm={() => void confirmSetFeatured()}
        onClose={closeFeaturedDialog}
      />
    </section>
  );
}
