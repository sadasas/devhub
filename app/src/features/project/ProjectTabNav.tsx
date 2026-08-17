import type { ReactNode } from 'react';

export interface ProjectTabItem {
  id: string;
  label: string;
  icon: ReactNode;
}

export interface ProjectTabNavProps {
  tabs: ProjectTabItem[];
  active: string;
  onSelect: (id: string) => void;
  unread: Record<string, number>;
}

export function ProjectTabNav({ tabs, active, onSelect, unread }: ProjectTabNavProps) {
  return (
    <nav className="tabs" role="tablist" aria-label="Project sections">
      {tabs.map((t) => {
        const count = unread[t.id] ?? 0;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`project-tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls="project-tabpanel"
            className={`tab ${active === t.id ? 'tab-active' : ''}`}
            onClick={() => onSelect(t.id)}
          >
            {t.icon}
            {t.label}
            {count > 0 && (
              <span
                className="tab-badge"
                aria-label={`${count} unread`}
                title={`${count} unread`}
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
