import { useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchableSelect } from '../../components/SearchableSelect';
import { FE_LIMITS } from '../../lib/limits';
import { POSTGRES_TYPES, matchPgType } from './postgres-types';

/** Nilai khusus opsi "Custom…" di daftar combobox tipe kolom. */
export const COLUMN_TYPE_CUSTOM = '__custom__';

interface ColumnTypeComboboxProps {
  /** Id unik per baris grid (mis. `col-type-${columnId}`). Diteruskan ke SearchableSelect. */
  id: string;
  /** Nilai kontrak data: tetap string apa adanya (mis. '', 'TEXT', 'varchar(255)', 'CIRCLE'). */
  value: string;
  onChange: (next: string) => void;
  /** Accessible name untuk trigger (mis. t('schema.table.typeAria', { name })). */
  ariaLabel: string;
  /** Accessible name untuk input bebas saat mode custom aktif. */
  customAriaLabel: string;
  placeholder?: string;
  customPlaceholder?: string;
}

/**
 * U6: combobox tipe kolom untuk grid NewTableModal + TableModal.
 * - Daftar B1 (POSTGRES_TYPES) + hint group label i18n + opsi terakhir Custom…
 * - Nilai existing tak-terdaftar (CIRCLE/domain/varchar(255)) → mode custom aktif,
 *   input bebas menampilkan nilai jujur apa adanya.
 * - Nilai kosong → placeholder, tak memilih apa-apa, input bebas tersembunyi.
 * - Kontrak data tak berubah (tetap string), maxLength COLUMN_TYPE tetap.
 * - Keyboard/a11y milik SearchableSelect dipertahankan apa adanya.
 */
export function ColumnTypeCombobox({
  id,
  value,
  onChange,
  ariaLabel,
  customAriaLabel,
  placeholder,
  customPlaceholder,
}: ColumnTypeComboboxProps) {
  const { t } = useTranslation('project');
  const [customOpen, setCustomOpen] = useState(false);

  const trimmed = value.trim();
  // PAKAI matchPgType B1: case-insensitive + strip param. Exact (tanpa param,
  // case-insensitive) = terdaftar; selain itu (varchar(255)/CIRCLE/domain) = custom.
  const matched = matchPgType(value);
  const isKnownExact =
    matched !== null && trimmed.toUpperCase() === matched.name && !trimmed.includes('(');
  const isUnknown = trimmed !== '' && !isKnownExact;
  const effectiveCustom = customOpen || isUnknown;

  const resolvedPlaceholder = placeholder ?? t('schema.table.typePlaceholder');
  const resolvedCustomPlaceholder = customPlaceholder ?? t('schema.table.typeCustomPlaceholder');

  const options = useMemo(
    () => [
      ...POSTGRES_TYPES.map((entry) => ({
        value: entry.name,
        label: entry.name,
        hint: t(`schema.table.typeGroup.${entry.group}`),
      })),
      { value: COLUMN_TYPE_CUSTOM, label: t('schema.table.typeCustomOption') },
    ],
    [t],
  );

  const selectValue =
    trimmed === '' && !customOpen ? null : effectiveCustom ? COLUMN_TYPE_CUSTOM : (matched?.name ?? null);

  const handleSelect = (next: string | null) => {
    if (next === null) {
      setCustomOpen(false);
      onChange('');
    } else if (next === COLUMN_TYPE_CUSTOM) {
      // Tampilkan kembali input bebas; nilai tersimpan tidak diubah sampai user mengetik.
      setCustomOpen(true);
    } else {
      setCustomOpen(false);
      onChange(next);
    }
  };

  const handleCustomChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value.slice(0, FE_LIMITS.COLUMN_TYPE);
    // Nilai kosong → kembali ke placeholder + tak memilih apa-apa.
    if (next === '') setCustomOpen(false);
    onChange(next);
  };

  return (
    <div className="col-type-combo">
      <SearchableSelect
        id={id}
        ariaLabel={ariaLabel}
        value={selectValue}
        options={options}
        placeholder={resolvedPlaceholder}
        allowEmpty={false}
        onChange={handleSelect}
      />
      {effectiveCustom && (
        <input
          className="input"
          aria-label={customAriaLabel}
          placeholder={resolvedCustomPlaceholder}
          value={value}
          maxLength={FE_LIMITS.COLUMN_TYPE}
          onChange={handleCustomChange}
        />
      )}
    </div>
  );
}
