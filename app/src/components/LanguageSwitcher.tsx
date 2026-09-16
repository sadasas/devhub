import { useEffect, useRef, useState } from 'react';
import { Check, Globe } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, useAppLocale } from '../i18n/useAppLocale';

interface LanguageSwitcherProps {
  triggerClassName?: string;
  up?: boolean;
  variant?: 'dropdown' | 'segmented';
}

export function LanguageSwitcher({ triggerClassName = 'btn btn-ghost btn-sm', up = false, variant = 'dropdown' }: LanguageSwitcherProps) {
  const { t } = useTranslation();
  const { lang, setLang } = useAppLocale();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (variant === 'segmented') {
    return (
      <div className="theme-segmented" role="radiogroup" aria-label={t('language.menu')}>
        {LANGUAGES.map((l) => {
          const isActive = lang === l.code;
          return (
            <button
              key={l.code}
              type="button"
              className={`theme-segmented-btn${isActive ? ' theme-segmented-active' : ''}`}
              role="radio"
              aria-checked={isActive}
              onClick={() => setLang(l.code)}
            >
              <span>{l.nativeName}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="sort-control" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        title={t('language.toggle')}
        aria-label={t('language.toggle')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Globe size={15} aria-hidden="true" />
      </button>
      {open && variant === 'dropdown' && (
        <div
          className={`sort-menu lang-menu${up ? ' lang-menu-up' : ''}`}
          role="menu"
          aria-label={t('language.menu')}
        >
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              className={`sort-menu-row${lang === l.code ? ' sort-menu-row-active' : ''}`}
              role="menuitemradio"
              aria-checked={lang === l.code}
              onClick={() => {
                setLang(l.code);
                setOpen(false);
                triggerRef.current?.focus();
              }}
            >
              <Check
                size={13}
                weight="bold"
                aria-hidden="true"
                className={`lang-row-check${lang === l.code ? '' : ' lang-row-check-off'}`}
              />
              {l.nativeName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
