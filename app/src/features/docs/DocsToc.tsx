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

function jumpTo(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  });
}

function TocLinks({ items, active }: { items: DocsTocItem[]; active: string }) {
  return (
    <>
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            className={active === item.id ? 'docs-toc-link docs-toc-link-active' : 'docs-toc-link'}
            onClick={(e) => {
              e.preventDefault();
              jumpTo(item.id);
            }}
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
                    onClick={(e) => {
                      e.preventDefault();
                      jumpTo(child.id);
                    }}
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
  return (
    <details className="docs-toc-mobile">
      <summary>{t('docs.onThisPage')}</summary>
      <ul className="docs-toc-list">
        <TocLinks items={items} active="" />
      </ul>
    </details>
  );
}