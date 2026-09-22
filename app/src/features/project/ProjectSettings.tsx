import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Archive, CaretLeft, Check, Copy, GearSix, GithubLogo, PencilSimple, PlugsConnected, Tag, Trash } from '@phosphor-icons/react';
import type { Project } from '../../lib/types';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Badge } from '../../components/Badge';
import { EditGeneralModal } from './EditGeneralModal';
import { GCalSettings } from '../integrations/GCalSettings';
import { LabelsSection } from './LabelsSection';
import {
  normalizeProjectSettingsSection,
  type ProjectSettingsSection,
} from './projectSettingsSections';

interface ProjectSettingsProps {
  project: Project;
  /** owner/admin boleh edit meta; editor read-only; viewer tak pernah sampai sini. */
  canEditMeta: boolean;
  /** role !== viewer && !archived — untuk koneksi integrasi. */
  canConnect: boolean;
  /** role !== viewer — untuk arsipkan/kembalikan. */
  canArchive: boolean;
  /** owner/admin — untuk hapus. */
  isAdmin: boolean;
  onBack: () => void;
  onRequestArchive: (next: 'archive' | 'restore') => void;
  onRequestDelete: () => void;
}

// Shell pengaturan per-project (?tab=settings&section=general|integrations),
// cermin team settings tapi tanpa route baru: sidebar nav + satu panel.
// Tier-1 primitives reuse: sidebar-item, section-title, settings-row(group),
// profile-panel, btn sizes, InlineError, field-helper.
export function ProjectSettings({ project, canEditMeta, canConnect, canArchive, isAdmin, onBack, onRequestArchive, onRequestDelete }: ProjectSettingsProps) {
  const { t } = useTranslation('project');
  const [searchParams] = useSearchParams();
  const section = normalizeProjectSettingsSection(searchParams.get('section'));
  const base = `/project/${encodeURIComponent(project.id)}?tab=settings`;

  const items: { key: ProjectSettingsSection; icon: React.ReactNode; label: string }[] = [
    { key: 'general', icon: <GearSix size={15} weight="duotone" aria-hidden="true" />, label: t('settings.general', { defaultValue: 'General' }) },
    { key: 'labels', icon: <Tag size={15} weight="duotone" aria-hidden="true" />, label: t('settings.labels', { defaultValue: 'Labels' }) },
    { key: 'integrations', icon: <PlugsConnected size={15} weight="duotone" aria-hidden="true" />, label: t('settings.integrations', { defaultValue: 'Integrations' }) },
    { key: 'danger', icon: <Trash size={15} weight="duotone" aria-hidden="true" />, label: t('settings.danger', { defaultValue: 'Danger' }) },
  ];

  // Pindah fokus ke judul section saat navigasi (kecuali load awal).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document.getElementById(`project-settings-${section}-title`)?.focus({ preventScroll: false });
  }, [section]);

  return (
    <div className="project-settings">
      <nav className="settings-nav project-settings-nav" aria-label={t('settings.title', { defaultValue: 'Project settings' })}>
        <button type="button" className="sidebar-item settings-nav-back" onClick={onBack}>
          <CaretLeft size={15} weight="duotone" aria-hidden="true" />
          <span className="sidebar-item-label">{t('settings.back', { defaultValue: 'Back to project' })}</span>
        </button>
        {items.map((item) => {
          const isActive = item.key === section;
          return (
            <Link
              key={item.key}
              to={`${base}&section=${item.key}`}
              className={isActive ? 'sidebar-item sidebar-item-active settings-nav-item' : 'sidebar-item settings-nav-item'}
              aria-current={isActive ? 'page' : undefined}
            >
              {item.icon}
              <span className="settings-nav-item-text">
                <span className="sidebar-item-label">{item.label}</span>
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="project-settings-panel">
        {section === 'general' ? (
          <GeneralSection project={project} canEditMeta={canEditMeta} />
        ) : section === 'labels' ? (
          <LabelsSection />
        ) : section === 'integrations' ? (
          <IntegrationsSection projectId={project.id} canConnect={canConnect} />
        ) : (
          <DangerSection
            project={project}
            canArchive={canArchive}
            isAdmin={isAdmin}
            onRequestArchive={onRequestArchive}
            onRequestDelete={onRequestDelete}
          />
        )}
      </div>
    </div>
  );
}

function GeneralSection({ project, canEditMeta }: { project: Project; canEditMeta: boolean }) {
  const { t } = useTranslation('project');
  const { copied, copy } = useCopyFeedback();
  const [editOpen, setEditOpen] = useState(false);
  const desc = (project.description ?? '').trim();

  return (
    <div className="profile-panel">
      <div className="narrow-center">
      <section className="dashboard__settings-section" aria-labelledby="project-settings-general-title">
      <div className="dashboard__settings-head">
        <h2 id="project-settings-general-title" tabIndex={-1} className="dashboard__settings-section-title">
          {t('settings.generalTitle', { defaultValue: 'General' })}
        </h2>
        {canEditMeta && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leftIcon={<PencilSimple size={14} aria-hidden="true" />}
            onClick={() => setEditOpen(true)}
            aria-label={t('settings.editGeneral', { defaultValue: 'Edit general' })}
          >
            {t('settings.editGeneral', { defaultValue: 'Edit' })}
          </Button>
        )}
      </div>
      <p className="dashboard__settings-section-desc">
        {t('settings.generalDesc', {
          defaultValue: 'Project name and description. Changes apply to this project.',
        })}
      </p>
      <div className="dashboard__settings-read-name">{project.name}</div>
      <div className="dashboard__settings-id-row">
        <div className="dashboard__settings-id-field">
          <Input label={t('settings.idLabel', { defaultValue: 'Project ID' })} value={project.id} readOnly />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="dashboard__settings-copy"
          leftIcon={copied ? <Check size={14} weight="bold" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          onClick={() => void copy(project.id)}
          aria-live="polite"
          aria-label={copied ? t('settings.copied', { defaultValue: 'Copied' }) : t('settings.copyId', { defaultValue: 'Copy ID' })}
        >
          {copied ? t('settings.copied', { defaultValue: 'Copied' }) : t('settings.copyId', { defaultValue: 'Copy ID' })}
        </Button>
      </div>
      <div className="dashboard__settings-read-meta-block">
        <p className="dashboard__settings-read-key">
          {t('settings.teamLabel', { defaultValue: 'Team' })}
        </p>
        <p className="dashboard__settings-team-status">
          <span>{project.teamName}</span>
          <span aria-hidden="true" className="dashboard__settings-team-status-sep">·</span>
          <span className="sr-only">{t('settings.statusLabel', { defaultValue: 'Status' })}: </span>
          <Badge tone={project.status === 'archived' ? 'warn' : 'success'} dot>
            {project.status === 'archived'
              ? t('settings.statusArchived', { defaultValue: 'Archived' })
              : t('settings.statusActive', { defaultValue: 'Active' })}
          </Badge>
        </p>
      </div>
      <div className="dashboard__settings-read-desc-block">
        <p className="dashboard__settings-read-key">
          {t('settings.descLabel', { defaultValue: 'Description' })}
        </p>
        {desc ? (
          <p className="dashboard__settings-read-desc">{desc}</p>
        ) : (
          <span className="detail-empty">—</span>
        )}
      </div>
      {!canEditMeta && (
        <p className="dashboard__settings-helper">
          {t('settings.readonly', { defaultValue: 'Only owners and admins can edit project settings.' })}
        </p>
      )}
      {editOpen && <EditGeneralModal project={project} onClose={() => setEditOpen(false)} />}
      </section>
      </div>
    </div>
  );
}

function DangerSection({
  project,
  canArchive,
  isAdmin,
  onRequestArchive,
  onRequestDelete,
}: {
  project: Project;
  canArchive: boolean;
  isAdmin: boolean;
  onRequestArchive: (next: 'archive' | 'restore') => void;
  onRequestDelete: () => void;
}) {
  const { t } = useTranslation('project');
  const isArchived = project.status === 'archived';
  return (
    <div className="profile-panel">
      <div className="narrow-center">
      <section
        className="dashboard__settings-section dashboard__settings-section--danger"
        aria-labelledby="project-settings-danger-title"
      >
        <h2 id="project-settings-danger-title" tabIndex={-1} className="dashboard__settings-section-title dashboard__settings-section-title--danger">
          {t('settings.dangerTitle', { defaultValue: 'Danger zone' })}
        </h2>
        <p className="dashboard__settings-section-desc">
          {t('settings.dangerDesc', {
            defaultValue: 'Irreversible and visibility actions for this project.',
          })}
        </p>
        {canArchive && (
          <div className="dashboard__settings-danger-row">
            <div className="dashboard__settings-danger-main">
              <h3 className="dashboard__settings-danger-name">
                {isArchived
                  ? t('settings.dangerRestoreName', { defaultValue: 'Restore project' })
                  : t('settings.dangerArchiveName', { defaultValue: 'Archive project' })}
              </h3>
              <p className="dashboard__settings-danger-copy">
                {isArchived
                  ? t('settings.dangerRestoreCopy', {
                      defaultValue: 'Bring this project back to active. Board and data are untouched.',
                    })
                  : t('settings.dangerArchiveCopy', {
                      defaultValue: 'Hide this project from lists. You can restore it anytime.',
                    })}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="dashboard__settings-danger-btn"
              leftIcon={<Archive size={14} aria-hidden="true" />}
              onClick={() => onRequestArchive(isArchived ? 'restore' : 'archive')}
            >
              {isArchived
                ? t('settings.dangerRestore', { defaultValue: 'Restore' })
                : t('settings.dangerArchive', { defaultValue: 'Archive' })}
            </Button>
          </div>
        )}
        {isAdmin && (
          <div className="dashboard__settings-danger-row dashboard__settings-danger-row--delete">
            <div className="dashboard__settings-danger-main">
              <h3 className="dashboard__settings-danger-name">
                {t('settings.dangerDeleteName', { defaultValue: 'Delete project' })}
              </h3>
              <p className="dashboard__settings-danger-copy">
                {t('settings.dangerDeleteCopy', {
                  defaultValue: 'Permanently delete this project and all its data. This cannot be undone.',
                })}
              </p>
            </div>
            <Button
              type="button"
              variant="danger"
              size="sm"
              className="dashboard__settings-danger-btn"
              leftIcon={<Trash size={14} aria-hidden="true" />}
              onClick={onRequestDelete}
            >
              {t('settings.dangerDelete', { defaultValue: 'Delete' })}
            </Button>
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
function IntegrationsSection({ projectId, canConnect }: { projectId: string; canConnect: boolean }) {
  const { t } = useTranslation('project');
  const { t: tAccount } = useTranslation('account');
  return (
    <div className="profile-panel">
      <div className="narrow-center">
      <section className="dashboard__settings-section" aria-labelledby="project-settings-integrations-title">
      <h2 id="project-settings-integrations-title" tabIndex={-1} className="dashboard__settings-section-title">
        {t('settings.integrationsTitle', { defaultValue: 'Integrations' })}
      </h2>
      <p className="dashboard__settings-section-desc">
        {t('settings.integrationsDesc', {
          defaultValue: 'External connections for this project. Account-level links live in your profile.',
        })}
      </p>
      <GCalSettings projectId={projectId} canEdit={canConnect} bare />
      <h3 className="section-title">
        <GithubLogo size={14} weight="fill" aria-hidden="true" />
        {tAccount('dashboard.team.settingsGithubTitle', { defaultValue: 'GitHub' })}
      </h3>
      <p className="field-helper">
        {tAccount('dashboard.team.settingsGithubSoonDesc', {
          defaultValue: 'Repository linking is coming soon.',
        })}
      </p>
      <ul className="settings-soon-list">
        <li>{tAccount('dashboard.team.settingsGithubSoonItem1')}</li>
        <li>{tAccount('dashboard.team.settingsGithubSoonItem2')}</li>
        <li>{tAccount('dashboard.team.settingsGithubSoonItem3')}</li>
      </ul>
      </section>
      </div>
    </div>
  );
}
