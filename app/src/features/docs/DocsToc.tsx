import * as React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface DocsTocItem {
  id: string;
  label: string;
  children?: DocsTocItem[];
}

function flatten(items: DocsTocItem[]): string[] {
  return items.flatMap((item) => [item.id, ...flatten(item.children ?? [])]);
}

function focusSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  // ensure target is focusable
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  // smooth scroll respecting reduced-motion
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  // keep URL hash in sync without triggering jump
  try {
    const url = new URL(window.location.href);
    url.hash = id;
    window.history.pushState(null, '', url.toString());
  } catch {
    window.location.hash = id;
  }
  // focus for a11y after scroll
  requestAnimationFrame(() => {
    el.focus({ preventScroll: true });
  });
}

function TocLinks({ items, active, onNavigate }: { items: DocsTocItem[]; active: string; onNavigate?: (id: string) => void }) {
  const handleClick = (_e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    // allow native anchor navigation, but enhance with focus + pushState
    // do not preventDefault fully — let hash update natively, then focus
    onNavigate?.(id);
    // delay focus to after native hash scroll
    window.setTimeout(() => focusSection(id), 0);
  };

  return (
    <>
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            className={active === item.id ? 'docs-toc-link docs-toc-link-active' : 'docs-toc-link'}
            aria-current={active === item.id ? 'location' : undefined}
            onClick={(e) => handleClick(e, item.id)}
          >
            {item.label}
          </a>
          {item.children && item.children.length > 0 && (
            <ul className="docs-toc-children">
              {item.children.map((child) => (
                <li key={child.id}>
                  <a
                    href={`#${child.id}`}
                    className={active === child.id ? 'docs-toc-link docs-toc-link-active' : 'docs-toc-link'}
                    aria-current={active === child.id ? 'location' : undefined}
                    onClick={(e) => handleClick(e, child.id)}
                  >
                    {child.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </>
  );
}

export function DocsToc({ items }: { items: DocsTocItem[] }) {
  const { t } = useTranslation('extras');
  const firstId = flatten(items)[0] ?? '';
  const [active, setActive] = useState(firstId);

  useEffect(() => {
    const ids = flatten(items);
    setActive(ids[0] ?? '');
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: '-88px 0px -70% 0px', threshold: 0 },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav className="docs-toc" aria-label={t('docs.tocAria')}>
      <p className="docs-toc-title">{t('docs.onThisPage')}</p>
      <ul className="docs-toc-list">
        <TocLinks items={items} active={active} />
      </ul>
    </nav>
  );
}

/** Collapsible "On this page" for narrow viewports — hidden on desktop via CSS. */
export function DocsTocMobile({ items }: { items: DocsTocItem[] }) {
  const { t } = useTranslation('extras');
  const detailsRef = React.useRef<HTMLDetailsElement>(null);

  const handleNavigate = (id: string) => {
    // auto-close mobile toc after navigation
    requestAnimationFrame(() => {
      if (detailsRef.current?.hasAttribute('open')) {
        detailsRef.current.removeAttribute('open');
      }
    });
    // also focusSection is handled in TocLinks, but ensure close
    void id;
  };

  return (
    <details ref={detailsRef} className="docs-toc-mobile">
      <summary>{t('docs.onThisPage')}</summary>
      <ul className="docs-toc-list">
        <TocLinks items={items} active="" onNavigate={handleNavigate} />
      </ul>
    </details>
  );
}
