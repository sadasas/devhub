import { useEffect, useState } from 'react';

export interface DocsTocItem {
  id: string;
  label: string;
}

export function DocsToc({ items }: { items: DocsTocItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? '');

  useEffect(() => {
    setActive(items.length > 0 ? items[0]!.id : '');
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: '-88px 0px -70% 0px', threshold: 0 },
    );
    for (const item of items) {
      const el = document.getElementById(item.id);
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
                document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}