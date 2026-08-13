import { useEffect, useState } from 'react';

export interface DocsTocItem {
  id: string;
  label: string;
  children?: DocsTocItem[];
}

function flatten(items: DocsTocItem[]): string[] {
  return items.flatMap((item) => [item.id, ...flatten(item.children ?? [])]);
}

export function DocsToc({ items }: { items: DocsTocItem[] }) {
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
    <nav className="docs-toc" aria-label="On this page">
      <p className="docs-toc-title">On this page</p>
      <ul className="docs-toc-list">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={active === item.id ? 'docs-toc-link docs-toc-link-active' : 'docs-toc-link'}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(item.id)?.scrollIntoView({
                  behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                  block: 'start',
                });
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
                        document.getElementById(child.id)?.scrollIntoView({
                          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                          block: 'start',
                        });
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
      </ul>
    </nav>
  );
}
