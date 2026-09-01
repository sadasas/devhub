import { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { AdminPackage } from '../../lib/types';
import { FloppyDisk, Plus, Trash, X } from '@phosphor-icons/react';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { FE_LIMITS } from '../../lib/limits';

interface PackageModalProps {
  open: boolean;
  pkg: AdminPackage | null;
  onClose: () => void;
  onSaved: (pkg: AdminPackage) => void;
}

interface PriceRow {
  id: string;
  durationDays: number;
  priceIdr: number;
  originalPriceIdr: string;
}

function newPriceRow(): PriceRow {
  return { id: crypto.randomUUID(), durationDays: 30, priceIdr: 0, originalPriceIdr: '' };
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
  const [prices, setPrices] = useState<PriceRow[]>([newPriceRow()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (pkg) {
      setName(pkg.name);
      setDescription(pkg.description || '');
      setMaxMembers(pkg.maxMembers === null ? '' : String(pkg.maxMembers));
      setMaxProjects(pkg.maxProjects === null ? '' : String(pkg.maxProjects));
      setSortOrder(String(pkg.sortOrder));
      setIsActive(pkg.isActive);
      setPrices(
        pkg.prices.length > 0
          ? pkg.prices.map((p) => ({
              id: crypto.randomUUID(),
              durationDays: p.durationDays,
              priceIdr: p.priceIdr,
              originalPriceIdr: p.originalPriceIdr != null ? String(p.originalPriceIdr) : '',
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
      setPrices([newPriceRow()]);
    }
    setError(null);
  }, [open, pkg]);

  function updatePrice(index: number, field: keyof PriceRow, value: number | string) {
    setPrices((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  function addPrice() {
    setPrices((prev) => [...prev, newPriceRow()]);
  }

  function removePrice(index: number) {
    setPrices((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('admin.packageModal.errors.nameRequired'));
      return;
    }
    const parsedMembers = maxMembers.trim() === '' ? null : Number(maxMembers);
    if (parsedMembers !== null && (!Number.isFinite(parsedMembers) || parsedMembers < 0)) {
      setError(t('admin.packageModal.errors.maxMembersInvalid', { defaultValue: 'Max members must be 0 or more' }));
      return;
    }
    const parsedProjects = maxProjects.trim() === '' ? null : Number(maxProjects);
    if (parsedProjects !== null && (!Number.isFinite(parsedProjects) || parsedProjects < 0)) {
      setError(t('admin.packageModal.errors.maxProjectsInvalid', { defaultValue: 'Max projects must be 0 or more' }));
      return;
    }
    const parsedSort = Number(sortOrder);
    if (!Number.isFinite(parsedSort)) {
      setError(t('admin.packageModal.errors.sortOrderInvalid', { defaultValue: 'Sort order must be a number' }));
      return;
    }
    for (const pr of prices) {
      if (!Number.isFinite(pr.durationDays) || pr.durationDays <= 0) {
        setError(t('admin.packageModal.errors.durationInvalid', { defaultValue: 'Duration must be > 0' }));
        return;
      }
      if (!Number.isFinite(pr.priceIdr) || pr.priceIdr < 0) {
        setError(t('admin.packageModal.errors.priceInvalid', { defaultValue: 'Price must be 0 or more' }));
        return;
      }
      if (pr.originalPriceIdr.trim() !== '' && (!Number.isFinite(Number(pr.originalPriceIdr)) || Number(pr.originalPriceIdr) < 0)) {
        setError(t('admin.packageModal.errors.originalPriceInvalid', { defaultValue: 'Original price must be 0 or more' }));
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const data = {
        name: name.trim(),
        description: description.trim() || undefined,
        maxMembers: parsedMembers,
        maxProjects: parsedProjects,
        sortOrder: parsedSort,
        isActive,
        prices: prices
          .filter((p) => p.durationDays > 0)
          .map((p) => ({
            durationDays: p.durationDays,
            priceIdr: p.priceIdr,
            originalPriceIdr: p.originalPriceIdr ? Number(p.originalPriceIdr) : null,
          })),
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
      setError(getErrorMessage(err, isEdit ? t('admin.packageModal.errors.update') : t('admin.packageModal.errors.create')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title={isEdit ? t('admin.packageModal.editTitle') : t('admin.packageModal.newTitle')}
      onClose={onClose}
      width="md"
      footer={
        <>
          <Button variant="secondary" leftIcon={<X size={13} aria-hidden="true" />} onClick={onClose} disabled={busy}>
            {t('templates.cancel')}
          </Button>
          <Button type="submit" form="pkg-form" leftIcon={isEdit ? <FloppyDisk size={13} aria-hidden="true" /> : <Plus size={13} weight="bold" aria-hidden="true" />} loading={busy} disabled={busy}>
            {busy ? t('admin.teamPlan.saving') : isEdit ? t('admin.packageModal.saveChanges') : t('admin.packageModal.create')}
          </Button>
        </>
      }
    >
      <form id="pkg-form" className="form-stack" onSubmit={(e) => void handleSubmit(e)}>
        {error && <InlineError>{error}</InlineError>}
        <Input
          label={t('api.workbench.name')}
          value={name}
          maxLength={FE_LIMITS.PACKAGE_NAME}
          showCount
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          placeholder={t('admin.packageModal.namePlaceholder')}
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
            onChange={(e) => setMaxMembers(e.target.value)}
            placeholder={t('common:usage.unlimited')}
          />
          <Input
            label={t('admin.packageModal.maxProjects')}
            type="number"
            min={0}
            max={999999}
            value={maxProjects}
            onChange={(e) => setMaxProjects(e.target.value)}
            placeholder={t('common:usage.unlimited')}
          />
        </div>
        <Input
          label={t('admin.packageModal.sortOrder')}
          type="number"
          min={0}
          max={999}
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
        />
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          {t('admin.packages.active')}
        </label>

        <div className="form-section">
          <div className="form-section-head">
            <span className="form-section-title">{t('admin.packageModal.prices')}</span>
            <Button type="button" variant="ghost" size="sm" leftIcon={<Plus size={13} aria-hidden="true" />} onClick={addPrice}>
              {t('admin.packageModal.addPrice')}
            </Button>
          </div>
          {prices.map((p, i) => (
            <fieldset key={p.id} className="admin-price-row admin-price-row-fieldset">
              <legend className="sr-only">{t('admin.packageModal.priceLegend', { index: i + 1, defaultValue: `Price ${i + 1}` })}</legend>
              <Input
                label={t('admin.packageModal.durationDays')}
                aria-label={t('admin.packageModal.durationDaysWithIndex', { index: i + 1, defaultValue: `Price ${i + 1} - Duration (days)` })}
                type="number"
                min={1}
                max={3650}
                value={String(p.durationDays)}
                onChange={(e) => updatePrice(i, 'durationDays', Number(e.target.value))}
              />
              <Input
                label={t('admin.packageModal.priceIdr')}
                aria-label={t('admin.packageModal.priceIdrWithIndex', { index: i + 1, defaultValue: `Price ${i + 1} - Price IDR` })}
                type="number"
                min={0}
                value={String(p.priceIdr)}
                onChange={(e) => updatePrice(i, 'priceIdr', Number(e.target.value))}
              />
              <Input
                label={t('admin.packageModal.originalPriceIdr')}
                aria-label={t('admin.packageModal.originalPriceIdrWithIndex', { index: i + 1, defaultValue: `Price ${i + 1} - Original Price IDR` })}
                type="number"
                min={0}
                value={p.originalPriceIdr}
                placeholder={t('admin.packageModal.noDiscount')}
                onChange={(e) => updatePrice(i, 'originalPriceIdr', e.target.value)}
              />
              {prices.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  leftIcon={<Trash size={13} aria-hidden="true" />}
                  onClick={() => removePrice(i)}
                  aria-label={t('admin.packageModal.removePriceWithIndex', { index: i + 1, defaultValue: `Remove price ${i + 1}` })}
                >
                  {t('admin.packageModal.removePriceLabel', { defaultValue: 'Remove' })}
                </Button>
              )}
            </fieldset>
          ))}
        </div>
      </form>
    </Modal>
  );
}


