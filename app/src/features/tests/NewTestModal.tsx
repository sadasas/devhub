import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { FileText, ListChecks } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { newId, nowIso } from '../../lib/utils';
import type { TestCaseStatus } from '../../lib/types';
import { useProject } from '../../state/project-context';
import { usePresenceStatus } from '../../hooks/usePresenceStatus';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { SearchableSelect } from '../../components/SearchableSelect';
import { MarkdownField } from '../../components/MarkdownField';

interface NewTestModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewTestModal({ open, onClose }: NewTestModalProps) {
  const { state, dispatch } = useProject();
  const { t } = useTranslation(['tracker', 'project']);
  usePresenceStatus(t('tests.newModal.presenceCreating'), open);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<TestCaseStatus>('pending');
  const [taskId, setTaskId] = useState('');
  const [issueId, setIssueId] = useState('');
  const [steps, setSteps] = useState('');
  const [expected, setExpected] = useState('');

  useEffect(() => {
    if (!open) {
      setName('');
      setStatus('pending');
      setTaskId('');
      setIssueId('');
      setSteps('');
      setExpected('');
    }
  }, [open]);

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
      width="lg"
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
          maxLength={300}
          showCount
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
            <span
              style={{
                width: 110,
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
              }}
            >
              <ListChecks size={12} aria-hidden="true" /> {t('tests.newModal.statusLabel')}
            </span>
            <select
              id="new-test-status"
              className="select"
              style={{ width: 160 }}
              value={status}
              onChange={(e) => setStatus(e.target.value as TestCaseStatus)}
            >
              <option value="pending">{t('tests.status.pending')}</option>
              <option value="pass">{t('tests.status.pass')}</option>
              <option value="fail">{t('tests.status.fail')}</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
            <span
              style={{
                width: 110,
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
              }}
            >
              <FileText size={12} aria-hidden="true" /> {t('tests.newModal.linkedTaskLabel')}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <SearchableSelect
                id="new-test-task"
                label=""
                value={taskId || null}
                options={state.tasks.map((t) => ({ value: t.id, label: t.title }))}
                onChange={(v) => setTaskId(v ?? '')}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
            <span
              style={{
                width: 110,
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
              }}
            >
              <FileText size={12} aria-hidden="true" /> {t('tests.newModal.linkedIssueLabel')}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <SearchableSelect
                id="new-test-issue"
                label=""
                value={issueId || null}
                options={state.issues.map((i) => ({ value: i.id, label: i.title }))}
                onChange={(v) => setIssueId(v ?? '')}
              />
            </div>
          </div>

          <MarkdownField
            label={t('tests.newModal.stepsLabel')}
            icon={ListChecks}
            value={steps}
            onChange={setSteps}
            placeholder={t('tests.newModal.stepsPlaceholder')}
            maxLength={10000}
            rows={4}
          />

          <MarkdownField
            label={t('tests.newModal.expectedLabel')}
            icon={FileText}
            value={expected}
            onChange={setExpected}
            placeholder={t('tests.newModal.expectedPlaceholder')}
            maxLength={5000}
            rows={3}
          />
        </div>
      </form>
    </Modal>
  );
}
