import { useEffect, useState } from 'react';
import { Plus, Trash } from '@phosphor-icons/react';
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
      setError('Name is required');
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
      setError(getErrorMessage(err, isEdit ? 'Failed to update package' : 'Failed to create package'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title={isEdit ? 'Edit package' : 'New package'}
      onClose={onClose}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit(new Event('submit') as unknown as React.FormEvent)} disabled={busy}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create package'}
          </Button>
        </>
      }
    >
      <form className="form-stack" onSubmit={(e) => void handleSubmit(e)}>
        {error && <InlineError>{error}</InlineError>}
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          placeholder="e.g. Pro, Enterprise…"
        />
        <Input
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
        />
        <div className="form-row">
          <Input
            label="Max members"
            type="number"
            value={maxMembers}
            onChange={(e) => setMaxMembers(e.target.value)}
            placeholder="Unlimited"
          />
          <Input
            label="Max projects"
            type="number"
            value={maxProjects}
            onChange={(e) => setMaxProjects(e.target.value)}
            placeholder="Unlimited"
          />
        </div>
        <Input
          label="Sort order"
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
          Active
        </label>

        <div className="form-section">
          <div className="form-section-head">
            <span className="form-section-title">Prices</span>
            <Button type="button" variant="ghost" size="sm" leftIcon={<Plus size={13} />} onClick={addPrice}>
              Add price
            </Button>
          </div>
          {prices.map((p, i) => (
            <div key={i} className="admin-price-row">
              <Input
                label="Duration (days)"
                type="number"
                value={String(p.durationDays)}
                onChange={(e) => updatePrice(i, 'durationDays', Number(e.target.value))}
              />
              <Input
                label="Price (IDR)"
                type="number"
                value={String(p.priceIdr)}
                onChange={(e) => updatePrice(i, 'priceIdr', Number(e.target.value))}
              />
              <Input
                label="Original price (IDR)"
                type="number"
                value={p.originalPriceIdr}
                placeholder="No discount"
                onChange={(e) => updatePrice(i, 'originalPriceIdr', e.target.value)}
              />
              {prices.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removePrice(i)}
                  aria-label="Remove price"
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
