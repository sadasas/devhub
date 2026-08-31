import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { newId, nowIso } from '../../lib/utils';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { SearchableSelect } from '../../components/SearchableSelect';
import { Textarea } from '../../components/Textarea';

interface SaveVersionModalProps {
  open: boolean;
  onClose: () => void;
}

export function SaveVersionModal({ open, onClose }: SaveVersionModalProps) {
  const { t } = useTranslation('project');
  const { state, dispatch } = useProject();
  usePresenceStatus('Snapshotting schema', open);
  const [version, setVersion] = useState('');
  const [notes, setNotes] = useState('');
  const [milestoneId, setMilestoneId] = useState<string | null>(null);

  if (!state) return null;
  const snapshot = { tables: state.tables, relations: state.relations };

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!version.trim()) return;
    const ts = nowIso();
    dispatch({
      type: 'schemaVersion/add',
      version: {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        version: version.trim(),
        appliedAt: ts,
        notes: notes.trim(),
        snapshot,
        milestoneId: milestoneId ?? null,
      },
    });
    setVersion('');
    setNotes('');
    setMilestoneId(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      title={t('schema.saveVersionModal.title')}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('schema.saveVersionModal.cancel')}
          </Button>
          <Button type="submit" form="save-version-form" disabled={!version.trim()}>
            {t('schema.saveVersionModal.submit')}
          </Button>
        </>
      }
    >
      <form id="save-version-form" className="form-stack" onSubmit={onSubmit} noValidate>
        <Input
          label={t('schema.saveVersionModal.versionLabel')}
          required
          autoFocus
          placeholder={t('schema.saveVersionModal.versionPlaceholder')}
          value={version}
          onChange={(e) => setVersion(e.target.value)}
        />
        <Textarea
          label={t('schema.saveVersionModal.notesLabel')}
          rows={3}
          placeholder={t('schema.saveVersionModal.notesPlaceholder')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <SearchableSelect
          id="schema-version-milestone"
          label={t('schema.saveVersionModal.milestoneLabel', { defaultValue: 'Milestone' })}
          value={milestoneId}
          options={(state.milestones ?? []).map((m) => ({ value: m.id, label: m.name }))}
          onChange={setMilestoneId}
          placeholder={t('schema.saveVersionModal.milestonePlaceholder', { defaultValue: 'No milestone (optional)' })}
          emptyLabel={t('schema.saveVersionModal.milestonePlaceholder', { defaultValue: 'No milestone (optional)' })}
        />
      </form>
    </Modal>
  );
}
