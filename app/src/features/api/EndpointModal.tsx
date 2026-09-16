import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { newId, normalizeApiKey, nowIso } from '../../lib/utils';
import type { ApiCollection, ApiMethod } from '../../lib/types';
import { Plus } from '@phosphor-icons/react';
import { Button } from '../../components/Button';
import { InlineError } from '../../components/InlineError';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { SearchableSelect } from '../../components/SearchableSelect';
import { FE_LIMITS } from '../../lib/limits';

interface EndpointModalProps {
  onClose: () => void;
  onCreated: (id: string) => void;
  collections: ApiCollection[];
}

// autoFocus hanya desktop (hover) — di touch, keyboard virtual melonjak (pola Modal).
const AUTO_FOCUS_INPUT = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

export function EndpointModal({ onClose, onCreated, collections }: EndpointModalProps) {
  const { t } = useTranslation('extras');
  const { dispatch, canEdit, state } = useProject();
  usePresenceStatus(t('api.endpointModal.presence'));
  const [name, setName] = useState('');
  const [method, setMethod] = useState<ApiMethod>('GET');
  const [path, setPath] = useState('/');
  const [collectionId, setCollectionId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!canEdit) return;
    if (!name.trim() || !path.trim()) return;
    const clash = (state?.apiEndpoints ?? []).some(
      (e) => normalizeApiKey(e.method, e.path) === normalizeApiKey(method, path.trim()),
    );
    if (clash) {
      setError(t('api.duplicateEndpoint'));
      return;
    }
    const ts = nowIso();
    const id = newId();
    dispatch({
      type: 'apiEndpoint/add',
      endpoint: {
        id,
        createdAt: ts,
        updatedAt: ts,
        collectionId: collectionId ? collectionId : null,
        method,
        path: path.trim(),
        name: name.trim(),
        description: '',
        headers: [],
        params: [],
        body: '',
        responses: [],
      },
    });
    onCreated(id);
  };

  return (
    <Modal
      open
      title={t('api.endpointModal.title')}
      onClose={onClose}
      width="md"
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose}>
            {t('api.endpointModal.cancel')}
          </Button>
          <Button variant="primary" size="md" leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />} onClick={submit} disabled={!canEdit || !name.trim() || !path.trim()}>
            {t('api.endpointModal.create')}
          </Button>
        </>
      }
    >
      <div className="form-stack">
        <Input
          label={t('api.workbench.name')}
          autoFocus={AUTO_FOCUS_INPUT}
          placeholder={t('api.endpointModal.namePlaceholder')}
          value={name}
          maxLength={FE_LIMITS.API_ENDPOINT_NAME}
          required
          showCount
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
        />
        <div className="field-row">
          <div className="field">
            <SearchableSelect
              id="endpoint-method"
              label={t('api.endpointModal.method')}
              value={method}
              allowEmpty={false}
              searchable={false}
              options={(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as ApiMethod[]).map((m) => ({ value: m, label: m }))}
              onChange={(v) => {
                if (v) setMethod(v as ApiMethod);
                if (error) setError(null);
              }}
            />
          </div>
          <div className="field field--grow">
            <label className="field-label" htmlFor="endpoint-path">
              {t('api.endpointModal.path')} <span className="field-required" aria-hidden="true"> *</span>
            </label>
            <input
              id="endpoint-path"
              className="input"
              placeholder="/users/:id"
              value={path}
              maxLength={FE_LIMITS.API_ENDPOINT_PATH}
              required
              onChange={(e) => {
                setPath(e.target.value);
                if (error) setError(null);
              }}
            />
          </div>
        </div>
        {error && <InlineError>{error}</InlineError>}
        <div className="field">
          <SearchableSelect
            id="endpoint-collection"
            label={t('api.endpointModal.collection')}
            value={collectionId || null}
            options={collections.map((c) => ({ value: c.id, label: c.name }))}
            emptyLabel={t('api.endpointModal.noneUngrouped')}
            onChange={(v) => setCollectionId(v ?? '')}
          />
        </div>
      </div>
    </Modal>
  );
}