import { MagnifyingGlass, X } from '@phosphor-icons/react';
import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { FE_LIMITS } from '../lib/limits';

export type SearchFieldSize = 'sm' | 'md' | 'lg';
export type SearchFieldVariant = 'boxed' | 'underline';

interface SearchFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'size' | 'type' | 'children'> {
  /** Teks saat ini (controlled). */
  value: string;
  /** Dipanggil dengan nilai baru — dipakai untuk mengetik DAN tombol clear. */
  onChange: (value: string) => void;
  placeholder: string;
  /** Label aksesibel input (diwariskan dari masing-masing pemakai agar test/i18n tak berubah). */
  ariaLabel: string;
  /** Label aksesibel tombol clear. */
  clearLabel: string;
  /** sm 32px (sidebar/nav), md 36px, lg 44px (toolbar/modal). */
  size?: SearchFieldSize;
  /** boxed default; underline khusus modal palette. */
  variant?: SearchFieldVariant;
  /** Perataan teks — default left; settings nav mengoper 'center' (warisan, jangan diubah global). */
  align?: 'left' | 'center';
  /** Tampilkan tombol X saat ada value. Default true. */
  showClear?: boolean;
  maxLength?: number;
  type?: 'search' | 'text';
  inputRef?: Ref<HTMLInputElement>;
  /** Slot tambahan di kanan (mis. hint ⌘K). */
  hint?: ReactNode;
}

/**
 * SearchField — satu-satunya pola search input di aplikasi.
 * Struktur seragam: wrapper (ikon + input borderless + tombol X + slot hint).
 * Wrapper pemilik TUNGGAL ring fokus (:focus-within); input mematikan
 * ring global agar tidak ada garis menumpuk (global :focus-visible + ring
 * input + ring wrapper = 3-4 garis, bug 2026-10).
 * Menggantikan 9 pola inline: settings-nav, sidebar-filter, api-sidebar
 * (ApiPage + Docs), members-search, welcome-search, palette-input,
 * wb-moresearch, wb-refsearch. FocusRadio dikecualikan (form submit + aksi).
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  clearLabel,
  size = 'sm',
  variant = 'boxed',
  align = 'left',
  showClear = true,
  maxLength = FE_LIMITS.SEARCH,
  type = 'search',
  inputRef,
  hint,
  className = '',
  ...rest
}: SearchFieldProps) {
  return (
    <div
      className={`search-field search-field--${size} search-field--${variant} ${className}`}
      data-align={align}
    >
      <MagnifyingGlass size={14} aria-hidden="true" className="search-field-icon" />
      <input
        ref={inputRef}
        type={type}
        className="search-field-input"
        placeholder={placeholder}
        aria-label={ariaLabel}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
      {showClear && value && (
        <button type="button" className="search-field-clear" aria-label={clearLabel} onClick={() => onChange('')}>
          <X size={12} weight="bold" aria-hidden="true" />
        </button>
      )}
      {hint}
    </div>
  );
}
