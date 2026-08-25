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
  unread: Record<string, number | { new: number; deleted: number; total: number }>;
}

export function ProjectTabNav({ tabs, active, onSelect, unread }: ProjectTabNavProps) {
  const { t } = useTranslation('project');
  return (
    <nav className="tabs" role="tablist" aria-label={t('tabs.navAria')}>
      {tabs.map((tab) => {
        const raw = unread[tab.id];
        const c = typeof raw === 'number' ? { new: raw, deleted: 0, total: raw } : raw;
        const total = c?.total ?? 0;
        const newCount = c?.new ?? 0;
        const delCount = c?.deleted ?? 0;
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
            {total > 0 && (
              <span className="tab-badge-split" aria-label={`${newCount} new, ${delCount} deleted in ${tab.label}`} title={`${newCount} new · ${delCount} deleted`}>
                {newCount > 0 && (
                  <span className="tab-badge tab-badge-new" aria-hidden="true">
                    {newCount > 99 ? '99+' : newCount}
                  </span>
                )}
                {delCount > 0 && (
                  <span className="tab-badge tab-badge-deleted" aria-hidden="true">
                    {delCount > 99 ? '99+' : delCount}
                  </span>
                )}
                {newCount === 0 && delCount === 0 && (
                  <span className="tab-badge" aria-hidden="true">
                    {total > 99 ? '99+' : total}
                  </span>
                )}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
