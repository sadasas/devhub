import { Hash, Key } from '@phosphor-icons/react';
import { Tooltip } from '../../components/Tooltip';

export interface ColumnFlags {
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  autoincrement?: boolean;
  indexed?: boolean;
}

export type ColumnFlagKind = 'nullable' | 'primary' | 'unique' | 'auto' | 'indexed';

/**
 * Invarian kolom: Primary key ⟹ NOT NULL.
 * - PK ON → Nullable OFF; PK OFF → Nullable dibiarkan.
 * - Nullable ON saat PK aktif → PK OFF; Nullable OFF → PK dibiarkan.
 * - Unique & Auto increment independen (ditulis ke indexes[] / flag oleh caller).
 * Murni, never-throw, deterministik.
 */
export function nextColumnFlags(cur: ColumnFlags, flag: ColumnFlagKind): ColumnFlags {
  try {
    const auto = cur?.autoincrement === true;
    const indexed = cur?.indexed === true;
    const base: ColumnFlags = {
      nullable: cur?.nullable === true,
      primaryKey: cur?.primaryKey === true,
      unique: cur?.unique === true,
      autoincrement: auto,
      indexed,
    };
    if (flag === 'primary') {
      const primaryKey = !base.primaryKey;
      return { ...base, primaryKey, nullable: primaryKey ? false : base.nullable };
    }
    if (flag === 'nullable') {
      const nullable = !base.nullable;
      return { ...base, nullable, primaryKey: nullable ? false : base.primaryKey };
    }
    if (flag === 'auto') {
      return { ...base, autoincrement: !auto };
    }
    if (flag === 'indexed') {
      return { ...base, indexed: !indexed };
    }
    return { ...base, unique: !base.unique };
  } catch {
    return { nullable: true, primaryKey: false, unique: false, autoincrement: false, indexed: false };
  }
}

interface ColumnFlagsToggleProps {
  value: ColumnFlags;
  onChange: (next: ColumnFlags) => void;
  /** Kunci seluruh grup (readOnly/viewer). */
  disabled?: boolean;
  /** Unique butuh nama kolom (aturan existing) — nonaktif + tooltip alasan. */
  uniqueDisabled?: boolean;
  uniqueDisabledTitle?: string;
  /** Auto increment hanya bermakna untuk tipe integer — nonaktif + tooltip alasan. */
  autoDisabled?: boolean;
  autoDisabledTitle?: string;
  /** Index biasa butuh nama kolom — nonaktif + tooltip alasan. */
  indexedDisabled?: boolean;
  indexedDisabledTitle?: string;
  nullableLabel: string;
  primaryLabel: string;
  uniqueLabel: string;
  autoLabel: string;
  indexedLabel: string;
}

/**
 * Lima tombol toggle compact [N] [kunci] [U] [#] [I] pengganti checkbox.
 * N ⟷ PK saling eksklusif (klik PK mematikan N dan sebaliknya);
 * U, auto (#) & indexed (I) independen. Label aksesibel penuh per tombol (tetap terbaca).
 */
export function ColumnFlagsToggle({
  value,
  onChange,
  disabled = false,
  uniqueDisabled = false,
  uniqueDisabledTitle,
  autoDisabled = false,
  autoDisabledTitle,
  indexedDisabled = false,
  indexedDisabledTitle,
  nullableLabel,
  primaryLabel,
  uniqueLabel,
  autoLabel,
  indexedLabel,
}: ColumnFlagsToggleProps) {
  const commit = (flag: ColumnFlagKind) => {
    if (disabled) return;
    if (flag === 'unique' && uniqueDisabled) return;
    if (flag === 'auto' && autoDisabled) return;
    if (flag === 'indexed' && indexedDisabled) return;
    onChange(nextColumnFlags(value, flag));
  };

  return (
    <div className="col-flags" role="group">
      <Tooltip content={nullableLabel} side="top">
      <button
        type="button"
        className="col-flag-btn font-mono"
        aria-pressed={value.nullable}
        aria-label={nullableLabel}
        title={nullableLabel}
        disabled={disabled}
        onClick={() => commit('nullable')}
      >
        <span aria-hidden="true">N</span>
      </button>
      </Tooltip>
      <Tooltip content={primaryLabel} side="top">
      <button
        type="button"
        className="col-flag-btn"
        aria-pressed={value.primaryKey}
        aria-label={primaryLabel}
        title={primaryLabel}
        disabled={disabled}
        onClick={() => commit('primary')}
      >
        <Key size={15} aria-hidden="true" />
      </button>
      </Tooltip>
      <Tooltip content={uniqueDisabled ? (uniqueDisabledTitle ?? uniqueLabel) : uniqueLabel} side="top">
      <button
        type="button"
        className="col-flag-btn font-mono"
        aria-pressed={value.unique}
        aria-label={uniqueLabel}
        title={uniqueDisabled ? (uniqueDisabledTitle ?? uniqueLabel) : uniqueLabel}
        disabled={disabled || uniqueDisabled}
        onClick={() => commit('unique')}
      >
        <span aria-hidden="true">U</span>
      </button>
      </Tooltip>
      <Tooltip content={autoDisabled ? (autoDisabledTitle ?? autoLabel) : autoLabel} side="top">
      <button
        type="button"
        className="col-flag-btn"
        aria-pressed={value.autoincrement === true}
        aria-label={autoLabel}
        title={autoDisabled ? (autoDisabledTitle ?? autoLabel) : autoLabel}
        disabled={disabled || autoDisabled}
        onClick={() => commit('auto')}
      >
        <Hash size={15} aria-hidden="true" />
      </button>
      </Tooltip>
      <Tooltip content={indexedDisabled ? (indexedDisabledTitle ?? indexedLabel) : indexedLabel} side="top">
      <button
        type="button"
        className="col-flag-btn font-mono"
        aria-pressed={value.indexed === true}
        aria-label={indexedLabel}
        title={indexedDisabled ? (indexedDisabledTitle ?? indexedLabel) : indexedLabel}
        disabled={disabled || indexedDisabled}
        onClick={() => commit('indexed')}
      >
        <span aria-hidden="true">I</span>
      </button>
      </Tooltip>
    </div>
  );
}
