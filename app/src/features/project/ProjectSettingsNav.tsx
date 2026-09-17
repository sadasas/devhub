import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CaretLeft, GearSix, PlugsConnected, Trash } from '@phosphor-icons/react';
import {
  normalizeProjectSettingsSection,
  normalizeProjectTabId,
  type ProjectSettingsSection,
} from './projectSettingsSections';

interface ProjectSettingsNavProps {
  projectId: string;
  projectTo: string;
  /** Dipanggil saat user memilih section — drawer mobile memakainya untuk menutup. */
  onSelect?: () => void;
}

// Nav settings per-project yang MENGGANTIKAN isi sidebar utama saat
// ?tab=settings (single-sidebar rule, cermin SettingsNav team):
// back ke tab terakhir (?from=) + section General/Integrations/Danger.
// Links membawa ?section=; panel settings me-render section yang cocok,
// jadi nav ini tak menyimpan state seleksi selain URL.
export function ProjectSettingsNav({ projectId, projectTo, onSelect }: ProjectSettingsNavProps) {
  const { t } = useTranslation('project');
  const [searchParams] = useSearchParams();
  const active = normalizeProjectSettingsSection(searchParams.get('section'));
  const from = normalizeProjectTabId(searchParams.get('from'));

  const items: { key: ProjectSettingsSection; icon: React.ReactNode; label: string }[] = [
    { key: 'general', icon: <GearSix size={15} weight="duotone" aria-hidden="true" />, label: t('settings.general', { defaultValue: 'General' }) },
    { key: 'integrations', icon: <PlugsConnected size={15} weight="duotone" aria-hidden="true" />, label: t('settings.integrations', { defaultValue: 'Integrations' }) },
    { key: 'danger', icon: <Trash size={15} weight="duotone" aria-hidden="true" />, label: t('settings.danger', { defaultValue: 'Danger' }) },
  ];
  const base = `/project/${encodeURIComponent(projectId)}?tab=settings&from=${from}`;

  return (
    <nav className="settings-nav" aria-label={t('settings.title', { defaultValue: 'Project settings' })}>
      <Link to={projectTo} className="sidebar-item settings-nav-back" onClick={onSelect}>
        <CaretLeft size={15} weight="duotone" aria-hidden="true" />
        <span className="sidebar-item-label">{t('settings.back', { defaultValue: 'Back to project' })}</span>
      </Link>
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <Link
            key={item.key}
            to={`${base}&section=${item.key}`}
            className={isActive ? 'sidebar-item sidebar-item-active settings-nav-item' : 'sidebar-item settings-nav-item'}
            aria-current={isActive ? 'page' : undefined}
            onClick={onSelect}
          >
            {item.icon}
            <span className="settings-nav-item-text">
              <span className="sidebar-item-label">{item.label}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
