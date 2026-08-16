import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Bug, ChalkboardSimple, Check, Columns, Info, LinkSimple, Rocket, Stack, Warning } from '@phosphor-icons/react';
import { ApiError } from '../../lib/api';
import type { Project, PublicTab } from '../../lib/types';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';
import { useProjects } from '../../state/projects-context';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { Modal } from '../../components/Modal';

const ALL_TABS: PublicTab[] = ['board', 'issues', 'milestones', 'stack', 'about', 'whiteboard'];

const TAB_META: { id: PublicTab; label: string; icon: ReactNode; description: string }[] = [
  { id: 'board', label: 'Board', icon: <Columns size={16} aria-hidden="true" />, description: 'Kanban board with tasks' },
  { id: 'issues', label: 'Issues', icon: <Bug size={16} aria-hidden="true" />, description: 'Bug and issue tracker' },
  { id: 'milestones', label: 'Milestones', icon: <Rocket size={16} aria-hidden="true" />, description: 'Releases and version history' },
  { id: 'stack', label: 'Stack', icon: <Stack size={16} aria-hidden="true" />, description: 'Tech stack ledger' },
  { id: 'about', label: 'About', icon: <Info size={16} aria-hidden="true" />, description: 'PRD and project summary' },
  { id: 'whiteboard', label: 'Whiteboard', icon: <ChalkboardSimple size={16} aria-hidden="true" />, description: 'Whiteboard boards' },
];

interface ShareModalProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

export function ShareModal({ projectId, open, onClose }: ShareModalProps) {
  const { projects, update } = useProjects();
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
      setError(err instanceof ApiError ? err.message : 'Failed to save sharing settings.');
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
      title="Share project"
      onClose={onClose}
      width="sm"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="share-body">
        <div className="segmented" role="group" aria-label="Who can see this project">
          <button
            type="button"
            className={`segment${vis === 'private' ? ' segment-active' : ''}`}
            aria-pressed={vis === 'private'}
            disabled={saving}
            onClick={() => onSelectVisibility('private')}
          >
            Private
          </button>
          <button
            type="button"
            className={`segment${vis === 'public' ? ' segment-active' : ''}`}
            aria-pressed={vis === 'public'}
            disabled={saving}
            onClick={() => onSelectVisibility('public')}
          >
            Public
          </button>
        </div>
        <p className="share-vis-copy">
          {vis === 'private'
            ? 'Hanya member team yang bisa melihat project ini.'
            : 'Siapa pun dengan link ini bisa melihat tab yang kamu centang di bawah.'}
        </p>
        {showWarn && (
          <p className="share-warn" role="status">
            <Warning size={13} aria-hidden="true" />
            Link lama langsung nonaktif.
          </p>
        )}

        {vis === 'public' && (
          <>
            <fieldset className="share-tabs">
              <legend className="field-label">Tab yang dibagikan</legend>
              {TAB_META.map((t) => {
                const isLastChecked = tabs.length === 1 && tabs.includes(t.id);
                return (
                  <label
                    key={t.id}
                    className={`share-tab-row${saving ? ' share-tab-row-disabled' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={tabs.includes(t.id)}
                      disabled={saving || isLastChecked}
                      title={isLastChecked ? 'Setidaknya satu tab harus tetap publik' : undefined}
                      onChange={() => onToggleTab(t.id)}
                    />
                    <span className="share-tab-icon">{t.icon}</span>
                    <span className="share-tab-text">
                      <span className="share-tab-label">{t.label}</span>
                      <span className="share-tab-desc">{t.description}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <div className="field share-link-field">
              <span className="field-label">Link publik</span>
              <div className="share-link-row">
                <input
                  className="input share-link-input font-mono"
                  readOnly
                  aria-label="Link publik"
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
                  {copied ? 'Copied' : 'Copy'}
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