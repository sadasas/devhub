import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { newId, nowIso } from '../../lib/utils';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';

interface NewTableModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewTableModal({ open, onClose }: NewTableModalProps) {
  const { t } = useTranslation('project');
  const { dispatch } = useProject();
  usePresenceStatus('Creating table', open);
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const ts = nowIso();
    dispatch({
      type: 'table/add',
      table: {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        name: name.trim(),
        comment: comment.trim(),
        columns: [],
        indexes: [],
      },
    });
    setName('');
    setComment('');
    onClose();
  }

  return (
    <Modal
      open={open}
      title={t('schema.newTableModal.title')}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('schema.newTableModal.cancel')}
          </Button>
          <Button type="submit" form="new-table-form" disabled={!name.trim()}>
            {t('schema.newTableModal.submit')}
          </Button>
        </>
      }
    >
      <form id="new-table-form" className="form-stack" onSubmit={onSubmit} noValidate>
        <Input
          label={t('schema.newTableModal.nameLabel')}
          required
          autoFocus
          placeholder={t('schema.newTableModal.namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Textarea
          label={t('schema.newTableModal.commentLabel')}
          rows={2}
          placeholder={t('schema.newTableModal.commentPlaceholder')}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </form>
    </Modal>
  );
}
