import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { newId, nowIso } from '../../lib/utils';
import type { TestCaseStatus } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { SearchableSelect } from '../../components/SearchableSelect';
import { Textarea } from '../../components/Textarea';

interface NewTestModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewTestModal({ open, onClose }: NewTestModalProps) {
  const { state, dispatch } = useProject();
  const { t } = useTranslation('tracker');
  usePresenceStatus(t('tests.newModal.presenceCreating'), open);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<TestCaseStatus>('pending');
  const [taskId, setTaskId] = useState('');
  const [issueId, setIssueId] = useState('');
  const [steps, setSteps] = useState('');
  const [expected, setExpected] = useState('');

  if (!state) return null;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const ts = nowIso();
    dispatch({
      type: 'testCase/add',
      testCase: {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        name: name.trim(),
        status,
        taskId: taskId || null,
        issueId: issueId || null,
        steps: steps.trim(),
        expected: expected.trim(),
      },
    });
    setName('');
    setStatus('pending');
    setTaskId('');
    setIssueId('');
    setSteps('');
    setExpected('');
    onClose();
  }

  return (
    <Modal
      open={open}
      title={t('tests.newModal.title')}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('tests.newModal.cancel')}
          </Button>
          <Button type="submit" form="new-test-form" disabled={!name.trim()}>
            {t('tests.newModal.submit')}
          </Button>
        </>
      }
    >
      <form id="new-test-form" className="form-stack" onSubmit={onSubmit} noValidate>
        <Input
          label={t('tests.newModal.nameLabel')}
          required
          autoFocus
          placeholder={t('tests.newModal.namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="field">
          <label className="field-label" htmlFor="new-test-status">
            {t('tests.newModal.statusLabel')}
          </label>
          <select
            id="new-test-status"
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value as TestCaseStatus)}
          >
            <option value="pending">{t('tests.status.pending')}</option>
            <option value="pass">{t('tests.status.pass')}</option>
            <option value="fail">{t('tests.status.fail')}</option>
          </select>
        </div>
        <div className="field">
          <SearchableSelect
            id="new-test-task"
            label={t('tests.newModal.linkedTaskLabel')}
            value={taskId || null}
            options={state.tasks.map((t) => ({ value: t.id, label: t.title }))}
            onChange={(v) => setTaskId(v ?? '')}
          />
        </div>
        <div className="field">
          <SearchableSelect
            id="new-test-issue"
            label={t('tests.newModal.linkedIssueLabel')}
            value={issueId || null}
            options={state.issues.map((i) => ({ value: i.id, label: i.title }))}
            onChange={(v) => setIssueId(v ?? '')}
          />
        </div>
        <Textarea
          label={t('tests.newModal.stepsLabel')}
          rows={3}
          placeholder={t('tests.newModal.stepsPlaceholder')}
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
        />
        <Textarea
          label={t('tests.newModal.expectedLabel')}
          rows={2}
          placeholder={t('tests.newModal.expectedPlaceholder')}
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
        />
      </form>
    </Modal>
  );
}
