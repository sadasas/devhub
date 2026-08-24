import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Bug, ChalkboardSimple, Check, Columns, Gauge, LinkSimple, Rocket, Stack, Warning } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import {} from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import type { Project, PublicTab } from '../../lib/types';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';
import { useProjects } from '../../state/projects-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { Modal } from '../../components/Modal';

const ALL_TABS: PublicTab[] = ['board', 'issues', 'milestones', 'stack', 'about', 'whiteboard'];

const TAB_META: { id: PublicTab; icon: ReactNode }[] = [
  { id: 'board', icon: <Columns size={16} aria-hidden="true" /> },
  { id: 'issues', icon: <Bug size={16} aria-hidden="true" /> },
  { id: 'milestones', icon: <Rocket size={16} aria-hidden="true" /> },
  { id: 'stack', icon: <Stack size={16} aria-hidden="true" /> },
  { id: 'about', icon: <Gauge size={16} aria-hidden="true" /> },
  { id: 'whiteboard', icon: <ChalkboardSimple size={16} aria-hidden="true" /> },
];

interface ShareModalProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

export function ShareModal({ projectId, open, onClose }: ShareModalProps) {
  const { t } = useTranslation('project');
  const { projects, update } = useProjects();
  usePresenceStatus('Sharing project', open);
  const project: Project | undefined = projects?.find((p) => p.id === projectId);
  const { copied, copy } = useCopyFeedback();
  const [vis, setVis] = useState<'private' | 'public'>('private');
  const [tabs, setTabs] = useState<PublicTab[]>(ALL_TABS);
  const [startVis, setStartVis] = useState<'private' | 'public'>('private');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !project) return;
    setVis(project.visibility);
    setStartVis(project.visibility);
    setTabs(project.tabs.length > 0 ? project.tabs : ALL_TABS);
    setError(null);
  }, [open, project]);

  const showWarn = vis === 'private' && startVis === 'public';
  const publicUrl = `${window.location.origin}/p/${projectId}`;

  async function save(patch: { visibility?: 'private' | 'public'; publicTabs?: PublicTab[] }) {
    if (!project || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await update(projectId, patch);
      if (patch.visibility !== undefined) setStartVis(patch.visibility);
      if (patch.visibility === undefined) setVis(updated.visibility);
    } catch (err) {
      setError(getErrorMessage(err, t('errors.saveShareFailed')));
    } finally {
      setSaving(false);
    }
  }

  function onSelectVisibility(next: 'private' | 'public') {
    if (next === vis) return;
    setVis(next);
    void save({ visibility: next });
  }

  function onToggleTab(id: PublicTab) {
    const next = tabs.includes(id) ? tabs.filter((t) => t !== id) : [...tabs, id];
    if (next.length === 0) return;
    setTabs(next);
    void save({ publicTabs: next });
  }

  return (
    <Modal
      open={open}
      title={t('share.title')}
      onClose={onClose}
      width="sm"
      footer={
        <Button variant="ghost" onClick={onClose}>
          {t('share.close')}
        </Button>
      }
    >
      <div className="share-body">
        <div className="segmented" role="group" aria-label={t('share.groupAria')}>
          <button
            type="button"
            className={`segment${vis === 'private' ? ' segment-active' : ''}`}
            aria-pressed={vis === 'private'}
            disabled={saving}
            onClick={() => onSelectVisibility('private')}
          >
            {t('share.private')}
          </button>
          <button
            type="button"
            className={`segment${vis === 'public' ? ' segment-active' : ''}`}
            aria-pressed={vis === 'public'}
            disabled={saving}
            onClick={() => onSelectVisibility('public')}
          >
            {t('share.public')}
          </button>
        </div>
        <p className="share-vis-copy">
          {vis === 'private'
            ? t('share.visCopyPrivate')
            : t('share.visCopyPublic')}
        </p>
        {showWarn && (
          <p className="share-warn" role="status">
            <Warning size={13} aria-hidden="true" />
            {t('share.warn')}
          </p>
        )}

        {vis === 'public' && (
          <>
            <fieldset className="share-tabs">
              <legend className="field-label">{t('share.legend')}</legend>
              {TAB_META.map((tab) => {
                const isLastChecked = tabs.length === 1 && tabs.includes(tab.id);
                return (
                  <label
                    key={tab.id}
                    className={`share-tab-row${saving ? ' share-tab-row-disabled' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={tabs.includes(tab.id)}
                      disabled={saving || isLastChecked}
                      title={isLastChecked ? t('share.lastCheckedTitle') : undefined}
                      onChange={() => onToggleTab(tab.id)}
                    />
                    <span className="share-tab-icon">{tab.icon}</span>
                    <span className="share-tab-text">
                      <span className="share-tab-label">{t(`share.tab.${tab.id}.label`)}</span>
                      <span className="share-tab-desc">{t(`share.tab.${tab.id}.description`)}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <div className="field share-link-field">
              <span className="field-label">{t('share.linkLabel')}</span>
              <div className="share-link-row">
                <input
                  className="input share-link-input font-mono"
                  readOnly
                  aria-label={t('share.linkLabel')}
                  value={publicUrl}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="share-link-copy"
                  leftIcon={
                    copied ? (
                      <Check size={12} weight="bold" aria-hidden="true" />
                    ) : (
                      <LinkSimple size={12} aria-hidden="true" />
                    )
                  }
                  onClick={() => void copy(publicUrl)}
                >
                  {copied ? t('actions.copied') : t('actions.copy')}
                </Button>
              </div>
            </div>
          </>
        )}

        {error && <InlineError>{error}</InlineError>}
      </div>
    </Modal>
  );
}