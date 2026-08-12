import { useState } from 'react';
import type { FormEvent } from 'react';
import { newId, nowIso } from '../../lib/utils';
import type { IssueSeverity } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Textarea } from '../../components/Textarea';

interface NewIssueModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewIssueModal({ open, onClose }: NewIssueModalProps) {
  const { dispatch } = useProject();
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<IssueSeverity>('medium');
  const [description, setDescription] = useState('');
  const [reproduction, setReproduction] = useState('');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const ts = nowIso();
    dispatch({
      type: 'issue/add',
      issue: {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        title: title.trim(),
        severity,
        status: 'open',
        description: description.trim(),
        reproduction: reproduction.trim(),
        linkedTaskId: null,
      },
    });
    setTitle('');
    setSeverity('medium');
    setDescription('');
    setReproduction('');
    onClose();
  }

  return (
    <Modal
      open={open}
      title="New issue"
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="new-issue-form" disabled={!title.trim()}>
            Log issue
          </Button>
        </>
      }
    >
      <form id="new-issue-form" className="form-stack" onSubmit={onSubmit} noValidate>
        <Input
          label="Title"
          required
          autoFocus
          placeholder="What's broken?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="field">
          <label className="field-label" htmlFor="new-issue-severity">
            Severity
          </label>
          <select
            id="new-issue-severity"
            className="select"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as IssueSeverity)}
          >
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <Textarea
          label="Description"
          rows={3}
          placeholder="What's broken, where, and why — optional"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Textarea
          label="Reproduction steps"
          rows={3}
          placeholder="Steps to reproduce, expected vs actual — optional"
          value={reproduction}
          onChange={(e) => setReproduction(e.target.value)}
        />
      </form>
    </Modal>
  );
}
