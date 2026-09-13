import { useEffect, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { AdminPackage } from '../../lib/types';
import { FloppyDisk, Plus, Trash, X } from '@phosphor-icons/react';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { Drawer } from '../../components/Drawer';
import { InlineError } from '../../components/InlineError';
import { Input } from '../../components/Input';
import { FE_LIMITS } from '../../lib/limits';
import { formatIdr } from '../../lib/format';

interface PackageModalProps {
  open: boolean;
  pkg: AdminPackage | null;
  onClose: () => void;
  onSaved: (pkg: AdminPackage) => void;
}

interface PriceRow {
  id: string;
  durationDays: string;
  priceIdr: string;
  originalPriceIdr: string;
  /** Baris berasal dari harga nonaktif (soft-deleted) — save akan mengaktifkannya lagi. */
  wasInactive: boolean;
}

interface PriceFieldErrors {
  durationDays?: string;
  priceIdr?: string;
  originalPriceIdr?: string;
}

function newPriceRow(): PriceRow {
  return { id: crypto.randomUUID(), durationDays: '30', priceIdr: '0', originalPriceIdr: '', wasInactive: false };
}

export function PackageModal({ open, pkg, onClose, onSaved }: PackageModalProps) {
  const { t } = useTranslation('extras');
  const isEdit = pkg !== null;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [maxMembers, setMaxMembers] = useState('');
  const [maxProjects, setMaxProjects] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [prices, setPrices] = useState<PriceRow[]>([newPriceRow()]);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [maxMembersError, setMaxMembersError] = useState<string | undefined>(undefined);
  const [maxProjectsError, setMaxProjectsError] = useState<string | undefined>(undefined);
  const [sortOrderError, setSortOrderError] = useState<string | undefined>(undefined);
  const [priceErrors, setPriceErrors] = useState<PriceFieldErrors[]>([]);
  const [pendingRemoveIndex, setPendingRemoveIndex] = useState<number | null>(null);
  const removeTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (pkg) {
      setName(pkg.name);
      setDescription(pkg.description || '');
      setMaxMembers(pkg.maxMembers === null ? '' : String(pkg.maxMembers));
      setMaxProjects(pkg.maxProjects === null ? '' : String(pkg.maxProjects));
      setSortOrder(String(pkg.sortOrder));
      setIsActive(pkg.isActive);
      setIsFeatured(pkg.isFeatured);
      setPrices(
        pkg.prices.length > 0
          ? pkg.prices.map((p) => ({
              id: crypto.randomUUID(),
              durationDays: String(p.durationDays),
              priceIdr: String(p.priceIdr),
              originalPriceIdr: p.originalPriceIdr != null ? String(p.originalPriceIdr) : '',
              wasInactive: p.isActive === false,
            }))
          : [newPriceRow()],
      );
    } else {
      setName('');
      setDescription('');
      setMaxMembers('');
      setMaxProjects('');
      setSortOrder('0');
      setIsActive(true);
      setIsFeatured(false);
      setPrices([newPriceRow()]);
    }
    setSubmitError(null);
    setNameError(undefined);
    setMaxMembersError(undefined);
    setMaxProjectsError(undefined);
    setSortOrderError(undefined);
    setPriceErrors([]);
    setPendingRemoveIndex(null);
  }, [open, pkg]);

  function updatePrice(index: number, field: keyof PriceRow, value: string) {
    setPrices((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
    setPriceErrors((prev) => {
      if (index >= prev.length) return prev;
      const next = [...prev];
      next[index] = { ...next[index] };
      delete (next[index] as Record<string, unknown>)[field];
      return next;
    });
  }

  function addPrice() {
    setPrices((prev) => [...prev, newPriceRow()]);
    setPriceErrors((prev) => [...prev, {}]);
  }

  function openRemoveConfirm(index: number) {
    if (busy) return;
    removeTriggerRef.current = document.activeElement as HTMLElement | null;
    setPendingRemoveIndex(index);
  }

  function closeRemoveConfirm() {
    setPendingRemoveIndex(null);
    const trigger = removeTriggerRef.current;
    if (trigger && document.contains(trigger) && typeof trigger.focus === 'function') {
      window.requestAnimationFrame(() => trigger.focus());
    }
  }

  function confirmRemovePrice() {
    if (pendingRemoveIndex === null || busy) return;
    const idx = pendingRemoveIndex;
    setPrices((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
    setPriceErrors((prev) => prev.filter((_, i) => i !== idx));
    closeRemoveConfirm();
  }

  function savingsHelper(p: PriceRow): string | undefined {
    const price = p.priceIdr.trim() === '' ? NaN : Number(p.priceIdr);
    const original = p.originalPriceIdr.trim() === '' ? NaN : Number(p.originalPriceIdr);
    if (!Number.isFinite(price) || !Number.isFinite(original)) return undefined;
    if (original <= price || original <= 0) return undefined;
    const save = original - price;
    const percent = Math.round((save / original) * 100);
    return t('admin.packageModal.savingsHelper', { amount: formatIdr(save), percent });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    let valid = true;

    if (!name.trim()) {
      setNameError(t('admin.packageModal.errors.nameRequired'));
      valid = false;
    } else {
      setNameError(undefined);
    }

    let parsedMembers: number | null = null;
    if (maxMembers.trim() === '') {
      parsedMembers = null;
      setMaxMembersError(undefined);
    } else {
      const n = Number(maxMembers);
      if (!Number.isFinite(n) || n < 0) {
        setMaxMembersError(t('admin.packageModal.errors.maxMembersInvalid'));
        valid = false;
      } else {
        parsedMembers = n;
        setMaxMembersError(undefined);
      }
    }

    let parsedProjects: number | null = null;
    if (maxProjects.trim() === '') {
      parsedProjects = null;
      setMaxProjectsError(undefined);
    } else {
      const n = Number(maxProjects);
      if (!Number.isFinite(n) || n < 0) {
        setMaxProjectsError(t('admin.packageModal.errors.maxProjectsInvalid'));
        valid = false;
      } else {
        parsedProjects = n;
        setMaxProjectsError(undefined);
      }
    }

    let parsedSort = 0;
    if (sortOrder.trim() === '') {
      setSortOrderError(t('admin.packageModal.errors.sortOrderInvalid'));
      valid = false;
    } else {
      const n = Number(sortOrder);
      if (!Number.isFinite(n)) {
        setSortOrderError(t('admin.packageModal.errors.sortOrderInvalid'));
        valid = false;
      } else {
        parsedSort = n;
        setSortOrderError(undefined);
      }
    }

    const nextPriceErrors: PriceFieldErrors[] = prices.map(() => ({}));
    const parsedPrices: Array<{ durationDays: number; priceIdr: number; originalPriceIdr: number | null }> = [];
    prices.forEach((pr, i) => {
      const rowErr: PriceFieldErrors = {};
      const durRaw = pr.durationDays.trim();
      const priceRaw = pr.priceIdr.trim();
      const origRaw = pr.originalPriceIdr.trim();
      const dur = durRaw === '' ? NaN : Number(durRaw);
      const price = priceRaw === '' ? NaN : Number(priceRaw);
      if (!Number.isFinite(dur) || dur <= 0) {
        rowErr.durationDays = t('admin.packageModal.errors.durationInvalid');
        valid = false;
      }
      if (!Number.isFinite(price) || price < 0) {
        rowErr.priceIdr = t('admin.packageModal.errors.priceInvalid');
        valid = false;
      }
      let orig: number | null = null;
      if (origRaw !== '') {
        const o = Number(origRaw);
        if (!Number.isFinite(o) || o < 0) {
          rowErr.originalPriceIdr = t('admin.packageModal.errors.originalPriceInvalid');
          valid = false;
        } else {
          orig = o;
        }
      }
      nextPriceErrors[i] = rowErr;
      if (!rowErr.durationDays && !rowErr.priceIdr && !rowErr.originalPriceIdr) {
        parsedPrices.push({ durationDays: dur, priceIdr: price, originalPriceIdr: orig });
      }
    });
    setPriceErrors(nextPriceErrors);
    if (!valid) return;

    setBusy(true);
    setSubmitError(null);
    try {
      const data = {
        name: name.trim(),
        description: description.trim() || undefined,
        maxMembers: parsedMembers,
        maxProjects: parsedProjects,
        sortOrder: parsedSort,
        isActive,
        isFeatured,
        prices: parsedPrices.filter((p) => p.durationDays > 0),
      };
      let saved: AdminPackage;
      if (isEdit) {
        saved = await api.adminPatchPackage(pkg!.id, data);
      } else {
        saved = await api.adminCreatePackage(data);
      }
      onSaved(saved);
      onClose();
    } catch (err) {
      setSubmitError(getErrorMessage(err, isEdit ? t('admin.packageModal.errors.update') : t('admin.packageModal.errors.create')));
    } finally {
      setBusy(false);
    }
  }

  const pendingRemoveRow = pendingRemoveIndex !== null ? prices[pendingRemoveIndex] : undefined;

  return (
    <Drawer
      open={open}
      title={isEdit ? t('admin.packageModal.editTitle') : t('admin.packageModal.newTitle')}
      onClose={busy || pendingRemoveIndex !== null ? undefined : onClose}
      footer={
        <>
          <Button variant="ghost" leftIcon={<X size={13} aria-hidden="true" />} onClick={onClose} disabled={busy}>
            {t('templates.cancel')}
          </Button>
          <Button type="submit" form="pkg-form" leftIcon={isEdit ? <FloppyDisk size={13} aria-hidden="true" /> : <Plus size={13} weight="bold" aria-hidden="true" />} loading={busy} disabled={busy}>
            {busy ? t('admin.packageModal.saving') : isEdit ? t('admin.packageModal.saveChanges') : t('admin.packageModal.create')}
          </Button>
        </>
      }
    >
      <form id="pkg-form" className="form-stack" onSubmit={(e) => void handleSubmit(e)}>
        {submitError && <InlineError>{submitError}</InlineError>}
        <Input
          label={t('api.workbench.name')}
          value={name}
          maxLength={FE_LIMITS.PACKAGE_NAME}
          showCount
          onChange={(e) => { setName(e.target.value); if (nameError) setNameError(undefined); }}
          required
          autoFocus
          placeholder={t('admin.packageModal.namePlaceholder')}
          error={nameError}
        />
        <Input
          label={t('api.workbench.description')}
          value={description}
          maxLength={FE_LIMITS.PACKAGE_DESC}
          showCount
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('admin.packageModal.descPlaceholder')}
        />
        <div className="form-row">
          <Input
            label={t('admin.packageModal.maxMembers')}
            type="number"
            min={0}
            max={999999}
            value={maxMembers}
            onChange={(e) => { setMaxMembers(e.target.value); if (maxMembersError) setMaxMembersError(undefined); }}
            placeholder={t('common:usage.unlimited')}
            error={maxMembersError}
          />
          <Input
            label={t('admin.packageModal.maxProjects')}
            type="number"
            min={0}
            max={999999}
            value={maxProjects}
            onChange={(e) => { setMaxProjects(e.target.value); if (maxProjectsError) setMaxProjectsError(undefined); }}
            placeholder={t('common:usage.unlimited')}
            error={maxProjectsError}
          />
        </div>
        <Input
          label={t('admin.packageModal.sortOrder')}
          type="number"
          min={0}
          max={999}
          value={sortOrder}
          onChange={(e) => { setSortOrder(e.target.value); if (sortOrderError) setSortOrderError(undefined); }}
          helper={sortOrderError ? undefined : t('admin.packageModal.sortOrderHelper')}
          error={sortOrderError}
        />
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          {t('admin.packages.active')}
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={isFeatured}
            onChange={(e) => setIsFeatured(e.target.checked)}
          />
          {t('admin.packageModal.featured')}
        </label>

        <div className="form-section">
          <div className="form-section-head">
            <span className="form-section-title">{t('admin.packageModal.prices')}</span>
            <Button type="button" variant="ghost" size="sm" leftIcon={<Plus size={13} aria-hidden="true" />} onClick={addPrice} disabled={busy}>
              {t('admin.packageModal.addPrice')}
            </Button>
          </div>
          {prices.map((p, i) => (
            <fieldset key={p.id} className="admin-price-row admin-price-row-fieldset">
              <legend className="sr-only">{t('admin.packageModal.priceLegend', { index: i + 1, defaultValue: `Price ${i + 1}` })}</legend>
              {p.wasInactive && (
                <span className="admin-price-row-note">
                  <Badge tone="neutral">{t('admin.packages.inactive')}</Badge>
                  <span className="data-row-meta">{t('admin.packageModal.priceReactivateHint')}</span>
                </span>
              )}
              <Input
                label={t('admin.packageModal.durationDays')}
                aria-label={t('admin.packageModal.durationDaysWithIndex', { index: i + 1, defaultValue: `Price ${i + 1} - Duration (days)` })}
                type="number"
                min={1}
                max={3650}
                value={p.durationDays}
                onChange={(e) => updatePrice(i, 'durationDays', e.target.value)}
                error={priceErrors[i]?.durationDays}
              />
              <Input
                label={t('admin.packageModal.priceIdr')}
                aria-label={t('admin.packageModal.priceIdrWithIndex', { index: i + 1, defaultValue: `Price ${i + 1} - Price IDR` })}
                type="number"
                min={0}
                value={p.priceIdr}
                onChange={(e) => updatePrice(i, 'priceIdr', e.target.value)}
                error={priceErrors[i]?.priceIdr}
              />
              <Input
                label={t('admin.packageModal.originalPriceIdr')}
                aria-label={t('admin.packageModal.originalPriceIdrWithIndex', { index: i + 1, defaultValue: `Price ${i + 1} - Original Price IDR` })}
                type="number"
                min={0}
                value={p.originalPriceIdr}
                placeholder={t('admin.packageModal.noDiscount')}
                onChange={(e) => updatePrice(i, 'originalPriceIdr', e.target.value)}
                error={priceErrors[i]?.originalPriceIdr}
                helper={priceErrors[i]?.originalPriceIdr ? undefined : savingsHelper(p)}
              />
              {prices.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  leftIcon={<Trash size={13} aria-hidden="true" />}
                  onClick={() => openRemoveConfirm(i)}
                  disabled={busy}
                  aria-label={t('admin.packageModal.removePriceWithIndex', { index: i + 1, defaultValue: `Remove price ${i + 1}` })}
                >
                  {t('admin.packageModal.removePriceLabel', { defaultValue: 'Remove' })}
                </Button>
              )}
            </fieldset>
          ))}
        </div>
      </form>

      <ConfirmDeleteDialog
        open={pendingRemoveIndex !== null}
        title={t('admin.packageModal.removePriceTitle')}
        description={t('admin.packageModal.removePriceDesc', {
          index: (pendingRemoveIndex ?? 0) + 1,
          days: pendingRemoveRow?.durationDays.trim() || '—',
          price: pendingRemoveRow && pendingRemoveRow.priceIdr.trim() !== '' && Number.isFinite(Number(pendingRemoveRow.priceIdr))
            ? formatIdr(Number(pendingRemoveRow.priceIdr))
            : '—',
        })}
        busy={busy}
        onConfirm={confirmRemovePrice}
        onClose={closeRemoveConfirm}
      />
    </Drawer>
  );
}
