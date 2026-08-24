import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('project');
  return (
    <nav className="tabs" role="tablist" aria-label={t('tabs.navAria')}>
      {tabs.map((tab) => {
        const count = unread[tab.id] ?? 0;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`project-tab-${tab.id}`}
            aria-selected={active === tab.id}
            aria-controls="project-tabpanel"
            className={`tab ${active === tab.id ? 'tab-active' : ''}`}
            onClick={() => onSelect(tab.id)}
          >
            {tab.icon}
            {tab.label}
            {count > 0 && (
              <span
                className="tab-badge"
                aria-label={t('tabs.unreadBadge', { count })}
                title={t('tabs.unreadBadge', { count })}
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
