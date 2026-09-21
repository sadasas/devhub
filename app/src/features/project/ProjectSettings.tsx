import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Archive, CaretLeft, Check, Copy, FloppyDisk, GearSix, GithubLogo, PlugsConnected, Tag, Trash } from '@phosphor-icons/react';
import type { Project } from '../../lib/types';
import { useProjects } from '../../state/projects-context';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';
import { getErrorMessage } from '../../lib/errors';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Textarea } from '../../components/Textarea';
import { InlineError } from '../../components/InlineError';
import { Badge } from '../../components/Badge';
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
  const { update } = useProjects();
  const { copied, copy } = useCopyFeedback();
  const [nameDraft, setNameDraft] = useState(project.name);
  const [descDraft, setDescDraft] = useState(project.description ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(0);

  // Reset draft saat project berganti / tersimpan dari luar.
  useEffect(() => {
    setNameDraft(project.name);
    setDescDraft(project.description ?? '');
    setSaveError(null);
  }, [project.id, project.name, project.description]);

  const nameTrimmed = nameDraft.trim();
  const descTrimmed = descDraft.trim();
  const dirty = nameTrimmed !== project.name.trim() || descTrimmed !== (project.description ?? '').trim();
  const canSave = canEditMeta && dirty && nameTrimmed.length > 0 && nameTrimmed.length <= 300 && !saving;

  const handleSave = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      await update(project.id, { name: nameTrimmed, description: descTrimmed });
      setSavedTick((n) => n + 1);
    } catch (err) {
      setSaveError(getErrorMessage(err, t('settings.saveError', { defaultValue: 'Failed to save project settings.' })));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-panel">
      <div className="narrow-center">
      <h2 id="project-settings-general-title" tabIndex={-1} className="dashboard__settings-section-title">
        {t('settings.generalTitle', { defaultValue: 'General' })}
      </h2>
      <p className="dashboard__settings-section-desc">
        {t('settings.generalDesc', {
          defaultValue: 'Project name and description. Changes apply to this project.',
        })}
      </p>
      <form
        className="dashboard__settings-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (canSave) void handleSave();
        }}
      >
        <div className="dashboard__settings-field">
          <Input
            id="project-settings-name"
            label={t('settings.nameLabel', { defaultValue: 'Project name' })}
            required
            value={nameDraft}
            maxLength={300}
            onChange={(e) => setNameDraft(e.target.value)}
            disabled={!canEditMeta}
            autoComplete="off"
          />
        </div>
        <div className="dashboard__settings-field">
          <Textarea
            id="project-settings-desc"
            label={t('settings.descLabel', { defaultValue: 'Description' })}
            value={descDraft}
            rows={3}
            maxLength={5000}
            showCount
            disabled={!canEditMeta}
            onChange={(e) => setDescDraft(e.target.value)}
          />
        </div>
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
        <dl className="settings-rows">
          <div className="settings-row-group">
            <div className="settings-row">
              <dt>{t('settings.teamLabel', { defaultValue: 'Team' })}</dt>
              <dd>{project.teamName}</dd>
            </div>
          </div>
          <div className="settings-row-group">
            <div className="settings-row">
              <dt>{t('settings.statusLabel', { defaultValue: 'Status' })}</dt>
              <dd>
                <Badge tone={project.status === 'archived' ? 'warn' : 'success'} dot>
                  {project.status === 'archived'
                    ? t('settings.statusArchived', { defaultValue: 'Archived' })
                    : t('settings.statusActive', { defaultValue: 'Active' })}
                </Badge>
              </dd>
            </div>
          </div>
        </dl>
        {saveError && <InlineError>{saveError}</InlineError>}
        {canEditMeta ? (
          <div className="dashboard__settings-save-row">
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="dashboard__settings-save"
              leftIcon={<FloppyDisk size={14} aria-hidden="true" />}
              loading={saving}
              disabled={!canSave}
            >
              {t('settings.save', { defaultValue: 'Save changes' })}
            </Button>
            {dirty && nameTrimmed.length > 0 && (
              <span className="dashboard__settings-unsaved" role="status">
                {t('settings.unsaved', { defaultValue: 'You have unsaved changes.' })}
              </span>
            )}
            {savedTick > 0 && !dirty && !saveError && (
              <span className="dashboard__settings-unsaved" role="status">
                {t('settings.saved', { defaultValue: 'Saved.' })}
              </span>
            )}
          </div>
        ) : (
          <p className="dashboard__settings-helper">
            {t('settings.readonly', { defaultValue: 'Only owners and admins can edit project settings.' })}
          </p>
        )}
      </form>
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
      </div>
    </div>
  );
}
