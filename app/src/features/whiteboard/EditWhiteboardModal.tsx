import { useState } from 'react';
import { Check } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { LIMITS } from '../../lib/limits';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';
import type { Whiteboard } from '../../lib/types';

// autoFocus hanya desktop (hover) — di touch, keyboard virtual melonjak (pola Modal).
const AUTO_FOCUS_INPUT = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

interface EditWhiteboardModalProps {
  board: Whiteboard;
  onClose: () => void;
}

/** Edit judul + deskripsi board saja (elemen kanvas tidak tersentuh). */
export function EditWhiteboardModal({ board, onClose }: EditWhiteboardModalProps) {
  const { t } = useTranslation('extras');
  const { dispatch, canEdit } = useProject();
  usePresenceStatus(t('whiteboard.editModal.presence'));
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description);

  const submit = () => {
    if (!canEdit) return;
    if (!name.trim()) return;
    dispatch({
      type: 'whiteboard/update',
      id: board.id,
      patch: { name: name.trim(), description: description.trim() },
    });
    onClose();
  };

  return (
    <Modal
      open
      title={t('whiteboard.editModal.title')}
      onClose={onClose}
      width="md"
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose}>
            {t('whiteboard.editModal.cancel')}
          </Button>
          <Button variant="primary" size="md" leftIcon={<Check size={14} weight="bold" aria-hidden="true" />} onClick={submit} disabled={!canEdit || !name.trim()}>
            {t('whiteboard.editModal.save')}
          </Button>
        </>
      }
    >
      <div className="form-stack">
        <Input
          label={t('whiteboard.editModal.name')}
          required
          autoFocus={AUTO_FOCUS_INPUT}
          maxLength={LIMITS.WHITEBOARD_NAME}
          showCount
          placeholder={t('whiteboard.editModal.namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Textarea
          label={t('whiteboard.editModal.description')}
          rows={3}
          maxLength={LIMITS.WHITEBOARD_DESCRIPTION}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
    </Modal>
  );
}
