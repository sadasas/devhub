import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { newId, nowIso } from '../../lib/utils';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';

interface CollectionModalProps {
  onClose: () => void;
  onCreated: (id: string) => void;
}

export function CollectionModal({ onClose, onCreated }: CollectionModalProps) {
  const { t } = useTranslation('extras');
  const { dispatch, state } = useProject();
  usePresenceStatus(t('api.collectionModal.presence'));
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (state?.apiCollections.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(t('api.collectionModal.duplicate'));
      return;
    }
    const ts = nowIso();
    const id = newId();
    dispatch({
      type: 'apiCollection/add',
      collection: {
        id,
        createdAt: ts,
        updatedAt: ts,
        name: trimmed,
        description: description.trim(),
      },
    });
    onCreated(id);
  };

  return (
    <Modal
      open
      title={t('api.collectionModal.title')}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('api.collectionModal.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={!name.trim()}>
            {t('api.collectionModal.create')}
          </Button>
        </>
      }
    >
      <div className="form-stack">
        <Input
          label={t('api.workbench.name')}
          autoFocus
          placeholder={t('api.collectionModal.namePlaceholder')}
          value={name}
          error={error ?? undefined}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
        />
        <Textarea
          label={t('api.workbench.description')}
          rows={3}
          placeholder={t('api.collection.descPlaceholder')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
    </Modal>
  );
}