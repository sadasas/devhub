import { useEffect, useState } from 'react';
import { Plus, Trash } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { AdminPackage } from '../../lib/types';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';

interface PackageModalProps {
  open: boolean;
  pkg: AdminPackage | null;
  onClose: () => void;
  onSaved: (pkg: AdminPackage) => void;
}

interface PriceRow {
  durationDays: number;
  priceIdr: number;
  originalPriceIdr: string;
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
  const [prices, setPrices] = useState<PriceRow[]>([{ durationDays: 30, priceIdr: 0, originalPriceIdr: '' }]);
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
              durationDays: p.durationDays,
              priceIdr: p.priceIdr,
              originalPriceIdr: p.originalPriceIdr != null ? String(p.originalPriceIdr) : '',
            }))
          : [{ durationDays: 30, priceIdr: 0, originalPriceIdr: '' }],
      );
    } else {
      setName('');
      setDescription('');
      setMaxMembers('');
      setMaxProjects('');
      setSortOrder('0');
      setIsActive(true);
      setPrices([{ durationDays: 30, priceIdr: 0, originalPriceIdr: '' }]);
    }
    setError(null);
  }, [open, pkg]);

  function updatePrice(index: number, field: keyof PriceRow, value: number | string) {
    setPrices((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  function addPrice() {
    setPrices((prev) => [...prev, { durationDays: 30, priceIdr: 0, originalPriceIdr: '' }]);
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
    setBusy(true);
    setError(null);
    try {
      const data = {
        name: name.trim(),
        description: description.trim() || undefined,
        maxMembers: maxMembers ? Number(maxMembers) : null,
        maxProjects: maxProjects ? Number(maxProjects) : null,
        sortOrder: Number(sortOrder),
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
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('templates.cancel')}
          </Button>
          <Button
            loading={busy}
            disabled={busy}
            onClick={() => void handleSubmit(new Event('submit') as unknown as React.FormEvent)}
          >
            {busy ? t('admin.teamPlan.saving') : isEdit ? t('admin.packageModal.saveChanges') : t('admin.packageModal.create')}
          </Button>
        </>
      }
    >
      <form className="form-stack" onSubmit={(e) => void handleSubmit(e)}>
        {error && <InlineError>{error}</InlineError>}
        <Input
          label={t('api.workbench.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          placeholder={t('admin.packageModal.namePlaceholder')}
        />
        <Input
          label={t('api.workbench.description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('admin.packageModal.descPlaceholder')}
        />
        <div className="form-row">
          <Input
            label={t('admin.packageModal.maxMembers')}
            type="number"
            value={maxMembers}
            onChange={(e) => setMaxMembers(e.target.value)}
            placeholder={t('common:usage.unlimited')}
          />
          <Input
            label={t('admin.packageModal.maxProjects')}
            type="number"
            value={maxProjects}
            onChange={(e) => setMaxProjects(e.target.value)}
            placeholder={t('common:usage.unlimited')}
          />
        </div>
        <Input
          label={t('admin.packageModal.sortOrder')}
          type="number"
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
            <Button type="button" variant="ghost" size="sm" leftIcon={<Plus size={13} />} onClick={addPrice}>
              {t('admin.packageModal.addPrice')}
            </Button>
          </div>
          {prices.map((p, i) => (
            <div key={i} className="admin-price-row">
              <Input
                label={t('admin.packageModal.durationDays')}
                type="number"
                value={String(p.durationDays)}
                onChange={(e) => updatePrice(i, 'durationDays', Number(e.target.value))}
              />
              <Input
                label={t('admin.packageModal.priceIdr')}
                type="number"
                value={String(p.priceIdr)}
                onChange={(e) => updatePrice(i, 'priceIdr', Number(e.target.value))}
              />
              <Input
                label={t('admin.packageModal.originalPriceIdr')}
                type="number"
                value={p.originalPriceIdr}
                placeholder={t('admin.packageModal.noDiscount')}
                onChange={(e) => updatePrice(i, 'originalPriceIdr', e.target.value)}
              />
              {prices.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removePrice(i)}
                  aria-label={t('admin.packageModal.removePrice')}
                >
                  <Trash size={13} />
                </Button>
              )}
            </div>
          ))}
        </div>
      </form>
    </Modal>
  );
}
