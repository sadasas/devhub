import { useEffect, useRef, useState } from 'react';
import { Check, Monitor, Moon, Sun } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../state/theme-context';
import type { ThemePref } from '../lib/theme';

interface ThemeSwitcherProps {
  triggerClassName?: string;
  up?: boolean;
  variant?: 'dropdown' | 'segmented';
}

const OPTIONS: readonly { code: ThemePref; labelKey: string; Icon: typeof Sun }[] = [
  { code: 'system', labelKey: 'theme.system', Icon: Monitor },
  { code: 'light', labelKey: 'theme.light', Icon: Sun },
  { code: 'dark', labelKey: 'theme.dark', Icon: Moon },
];

export function ThemeSwitcher({
  triggerClassName = 'btn btn-ghost btn-sm',
  up = false,
  variant = 'dropdown',
}: ThemeSwitcherProps) {
  const { t } = useTranslation();
  const { pref, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || variant !== 'dropdown') return;
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
  }, [open, variant]);

  const active = OPTIONS.find((o) => o.code === pref) ?? OPTIONS[0];
  const TriggerIcon = active!.Icon;

  if (variant === 'segmented') {
    return (
      <div className="theme-segmented" role="radiogroup" aria-label={t('theme.menu')}>
        {OPTIONS.map((o) => {
          const Icon = o.Icon;
          const isActive = pref === o.code;
          return (
            <button
              key={o.code}
              type="button"
              className={`theme-segmented-btn${isActive ? ' theme-segmented-active' : ''}`}
              role="radio"
              aria-checked={isActive}
              onClick={() => setTheme(o.code)}
            >
              <Icon size={14} aria-hidden="true" />
              <span>{t(o.labelKey)}</span>
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
        title={t('theme.toggle')}
        aria-label={t('theme.toggle')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <TriggerIcon size={15} aria-hidden="true" />
      </button>
      {open && (
        <div
          className={`sort-menu lang-menu${up ? ' lang-menu-up' : ''}`}
          role="menu"
          aria-label={t('theme.menu')}
        >
          {OPTIONS.map((o) => {
            const Icon = o.Icon;
            const isActive = pref === o.code;
            return (
              <button
                key={o.code}
                type="button"
                className={`sort-menu-row${isActive ? ' sort-menu-row-active' : ''}`}
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => {
                  setTheme(o.code);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
              >
                <Check
                  size={13}
                  weight="bold"
                  aria-hidden="true"
                  className={`lang-row-check${isActive ? '' : ' lang-row-check-off'}`}
                />
                <Icon size={13} aria-hidden="true" style={{ marginRight: 2 }} />
                {t(o.labelKey)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
