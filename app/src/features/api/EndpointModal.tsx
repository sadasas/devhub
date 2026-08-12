import { useState } from 'react';
import { useProject } from '../../state/project-context';
import { newId, nowIso } from '../../lib/utils';
import type { ApiCollection, ApiMethod } from '../../lib/types';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';

interface EndpointModalProps {
  onClose: () => void;
  onCreated: (id: string) => void;
  collections: ApiCollection[];
}

export function EndpointModal({ onClose, onCreated, collections }: EndpointModalProps) {
  const { dispatch } = useProject();
  const [name, setName] = useState('');
  const [method, setMethod] = useState<ApiMethod>('GET');
  const [path, setPath] = useState('/');
  const [collectionId, setCollectionId] = useState('');

  const submit = () => {
    if (!name.trim() || !path.trim()) return;
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
      title="New endpoint"
      onClose={onClose}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!name.trim() || !path.trim()}>
            Create endpoint
          </Button>
        </>
      }
    >
      <div className="form-stack">
        <Input
          label="Name"
          autoFocus
          placeholder="e.g. List users"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="field-row">
          <div className="field">
            <label className="field-label" htmlFor="endpoint-method">
              Method
            </label>
            <select
              id="endpoint-method"
              className="select"
              value={method}
              onChange={(e) => setMethod(e.target.value as ApiMethod)}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
              <option value="OPTIONS">OPTIONS</option>
            </select>
          </div>
          <div className="field field--grow">
            <label className="field-label" htmlFor="endpoint-path">
              Path
            </label>
            <input
              id="endpoint-path"
              className="input"
              placeholder="/users/:id"
              value={path}
              onChange={(e) => setPath(e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="endpoint-collection">
            Collection
          </label>
          <select
            id="endpoint-collection"
            className="select"
            value={collectionId}
            onChange={(e) => setCollectionId(e.target.value)}
          >
            <option value="">None (ungrouped)</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}