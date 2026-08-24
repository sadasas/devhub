import { useEffect, useRef, useState } from 'react';
import { Trash } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { TECH_CATEGORY, TECH_STATUS } from '../../lib/labels';
import { formatRelative } from '../../lib/utils';
import type { State, TechEntry, TechEntryCategory, TechStatus } from '../../lib/types';
import type { UpdatePatch } from '../../state/project-context';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { Badge } from '../../components/Badge';
import { ActivityList } from '../../components/ActivityList';
import { Button } from '../../components/Button';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { DetailEmpty, DetailList, DetailRow } from '../../components/DetailList';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';

interface TechModalProps {
  entryId: string | null;
  onClose: () => void;
}

export function TechModal({ entryId, onClose }: TechModalProps) {
  const { t } = useTranslation('project');
  const { state, dispatch, canEdit, projectId } = useProject();
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const editSnapshot = useRef<State | null>(null);

  useEffect(() => {
    setEditing(false);
    setConfirmOpen(false);
  }, [entryId]);

  const entry = entryId ? state?.techEntries.find((t) => t.id === entryId) : undefined;
  usePresenceStatus('Editing tech entry', entry != null);
  if (!state || !entry) return null;

  const update = (patch: UpdatePatch<TechEntry>) => {
    dispatch({ type: 'tech/update', id: entry.id, patch });
  };

  const remove = () => {
    dispatch({ type: 'tech/remove', id: entry.id });
    onClose();
  };

  const startEditing = () => {
    editSnapshot.current = structuredClone(state);
    setEditing(true);
  };

  const cancelEditing = () => {
    if (editSnapshot.current) {
      dispatch({ type: 'replace', state: editSnapshot.current });
      editSnapshot.current = null;
    }
    setEditing(false);
  };

  const finishEditing = () => {
    editSnapshot.current = null;
    setEditing(false);
    onClose();
  };

  return (
    <>
    <Modal
      open={entryId !== null}
      title={editing ? t('stack.techModal.editTitle') : t('stack.techModal.viewTitle')}
      onClose={onClose}
      width="sm"
      footer={
        <>
          {canEdit && !editing && (
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash size={13} aria-hidden="true" />}
              onClick={() => setConfirmOpen(true)}
            >
              {t('stack.techModal.delete')}
            </Button>
          )}
          <span className="flex-1" />
          {editing ? (
            <>
              <Button variant="ghost" onClick={cancelEditing}>
                {t('stack.techModal.cancel')}
              </Button>
              <Button variant="primary" onClick={finishEditing}>
                {t('stack.techModal.done')}
              </Button>
            </>
          ) : (
            canEdit && (
              <Button variant="primary" onClick={startEditing}>
                {t('stack.techModal.edit')}
              </Button>
            )
          )}
        </>
      }
    >
      <div className="form-stack">
        {editing ? (
          <>
            <Input label={t('stack.techModal.nameLabel')} value={entry.name} onChange={(e) => update({ name: e.target.value })} />
            <Input
              label={t('stack.techModal.versionLabel')}
              value={entry.version}
              placeholder={t('stack.techModal.versionPlaceholder')}
              onChange={(e) => update({ version: e.target.value })}
            />
            <div className="field-row">
              <div className="field">
                <label className="field-label" htmlFor="tech-category">
                  {t('stack.techModal.categoryLabel')}
                </label>
                <select
                  id="tech-category"
                  className="select"
                  value={entry.category}
                  onChange={(e) => update({ category: e.target.value as TechEntryCategory })}
                >
                  <option value="frontend">{t('stack.optionCategory.frontend')}</option>
                  <option value="backend">{t('stack.optionCategory.backend')}</option>
                  <option value="database">{t('stack.optionCategory.database')}</option>
                  <option value="tooling">{t('stack.optionCategory.tooling')}</option>
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="tech-status">
                  {t('stack.techModal.statusLabel')}
                </label>
                <select
                  id="tech-status"
                  className="select"
                  value={entry.status}
                  onChange={(e) => update({ status: e.target.value as TechStatus })}
                >
                  <option value="current">{t('stack.optionStatus.current')}</option>
                  <option value="updateAvailable">{t('stack.optionStatus.updateAvailable')}</option>
                  <option value="majorUpgrade">{t('stack.optionStatus.majorUpgrade')}</option>
                </select>
              </div>
            </div>
            <Textarea
              label={t('stack.techModal.notesLabel')}
              rows={3}
              value={entry.notes}
              onChange={(e) => update({ notes: e.target.value })}
            />
            <p className="field-helper">{t('stack.techModal.updated', { time: formatRelative(entry.updatedAt) })}</p>
          </>
        ) : (
          <>
            <h3 className="detail-title">{entry.name}</h3>
            <DetailList>
              <DetailRow label={t('stack.techModal.categoryLabel')}>
                <Badge tone={TECH_CATEGORY[entry.category].tone}>
                  {t(`stack.category.${entry.category}`)}
                </Badge>
              </DetailRow>
              <DetailRow label={t('stack.techModal.statusLabel')}>
                <Badge tone={TECH_STATUS[entry.status].tone}>
                  {t(`stack.statusBadge.${entry.status}`)}
                </Badge>
              </DetailRow>
              <DetailRow label={t('stack.techModal.versionLabel')}>
                <span className="font-mono">{entry.version.trim() ? entry.version : <DetailEmpty />}</span>
              </DetailRow>
              <DetailRow label={t('stack.techModal.notesLabel')}>
                {entry.notes.trim() ? entry.notes : <DetailEmpty>{t('stack.techModal.noNotes')}</DetailEmpty>}
              </DetailRow>
            </DetailList>
            <h4 className="detail-subtitle">{t('stack.techModal.activity')}</h4>
            <ActivityList projectId={projectId} entity="techEntries" entityId={entry.id} />
            <p className="field-helper">{t('stack.techModal.updated', { time: formatRelative(entry.updatedAt) })}</p>
          </>
        )}
      </div>
    </Modal>
    <ConfirmDeleteDialog
      open={confirmOpen}
      title={t('stack.techModal.deleteConfirmTitle')}
      description={t('stack.techModal.deleteConfirmBody')}
      onClose={() => setConfirmOpen(false)}
      onConfirm={remove}
    />
    </>
  );
}