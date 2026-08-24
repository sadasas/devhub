import { useEffect, useRef, useState } from 'react';
import { Trash } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { TEST_CASE_STATUS } from '../../lib/labels';
import { formatRelative } from '../../lib/utils';
import type { State, TestCase, TestCaseStatus } from '../../lib/types';
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
import { SearchableSelect } from '../../components/SearchableSelect';
import { Textarea } from '../../components/Textarea';

interface TestModalProps {
  testId: string | null;
  onClose: () => void;
}

export function TestModal({ testId, onClose }: TestModalProps) {
  const { state, dispatch, canEdit, projectId } = useProject();
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const editSnapshot = useRef<State | null>(null);
  const { t } = useTranslation('tracker');

  useEffect(() => {
    setEditing(false);
    setConfirmOpen(false);
  }, [testId]);

  const test = testId ? state?.testCases.find((t) => t.id === testId) : undefined;
  usePresenceStatus(t('tests.modal.presenceEditing'), test != null);
  if (!state || !test) return null;

  const update = (patch: UpdatePatch<TestCase>) => {
    dispatch({ type: 'testCase/update', id: test.id, patch });
  };

  const remove = () => {
    dispatch({ type: 'testCase/remove', id: test.id });
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

  const linkedTask = test.taskId ? state.tasks.find((t) => t.id === test.taskId) : undefined;
  const linkedIssue = test.issueId ? state.issues.find((i) => i.id === test.issueId) : undefined;

  return (
    <>
    <Modal
      open={testId !== null}
      title={editing ? t('tests.modal.editTitle') : t('tests.modal.viewTitle')}
      onClose={onClose}
      width="md"
      footer={
        <>
          {canEdit && !editing && (
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash size={13} aria-hidden="true" />}
              onClick={() => setConfirmOpen(true)}
            >
              {t('tests.modal.delete')}
            </Button>
          )}
          <span className="flex-1" />
          {editing ? (
            <>
              <Button variant="ghost" onClick={cancelEditing}>
                {t('tests.modal.cancel')}
              </Button>
              <Button variant="primary" onClick={finishEditing}>
                {t('tests.modal.done')}
              </Button>
            </>
          ) : (
            canEdit && (
              <Button variant="primary" onClick={startEditing}>
                {t('tests.modal.edit')}
              </Button>
            )
          )}
        </>
      }
    >
      <div className="form-stack">
        {editing ? (
          <>
            <Input label={t('tests.modal.nameLabel')} value={test.name} onChange={(e) => update({ name: e.target.value })} />
            <div className="field-row">
              <div className="field">
                <label className="field-label" htmlFor="test-status">
                  {t('tests.modal.statusLabel')}
                </label>
                <select
                  id="test-status"
                  className="select"
                  value={test.status}
                  onChange={(e) => update({ status: e.target.value as TestCaseStatus })}
                >
                  <option value="pending">{t('tests.status.pending')}</option>
                  <option value="pass">{t('tests.status.pass')}</option>
                  <option value="fail">{t('tests.status.fail')}</option>
                </select>
              </div>
              <div className="field">
                <SearchableSelect
                  id="test-task"
                  label={t('tests.modal.linkedTaskLabel')}
                  value={test.taskId}
                  options={state.tasks.map((t) => ({ value: t.id, label: t.title }))}
                  onChange={(v) => update({ taskId: v })}
                />
              </div>
            </div>
            <div className="field">
              <SearchableSelect
                id="test-issue"
                label={t('tests.modal.linkedIssueLabel')}
                value={test.issueId}
                options={state.issues.map((i) => ({ value: i.id, label: i.title }))}
                onChange={(v) => update({ issueId: v })}
              />
            </div>
            <Textarea
              label={t('tests.modal.stepsLabel')}
              rows={4}
              value={test.steps}
              onChange={(e) => update({ steps: e.target.value })}
            />
            <Textarea
              label={t('tests.modal.expectedLabel')}
              rows={2}
              value={test.expected}
              onChange={(e) => update({ expected: e.target.value })}
            />
            <p className="field-helper">{t('tests.modal.updated', { time: formatRelative(test.updatedAt) })}</p>
          </>
        ) : (
          <>
            <h3 className="detail-title">{test.name}</h3>
            <DetailList>
              <DetailRow label={t('tests.modal.statusLabel')}>
                <Badge tone={TEST_CASE_STATUS[test.status].tone}>
                  {t(`tests.status.${test.status}`)}
                </Badge>
              </DetailRow>
              <DetailRow label={t('tests.modal.linkedTaskLabel')}>
                {linkedTask ? linkedTask.title : <DetailEmpty />}
              </DetailRow>
              <DetailRow label={t('tests.modal.linkedIssueLabel')}>
                {linkedIssue ? linkedIssue.title : <DetailEmpty />}
              </DetailRow>
              <DetailRow label={t('tests.modal.stepsLabel')}>
                {test.steps.trim() ? test.steps : <DetailEmpty>{t('tests.modal.noSteps')}</DetailEmpty>}
              </DetailRow>
              <DetailRow label={t('tests.modal.expectedRow')}>
                {test.expected.trim() ? test.expected : <DetailEmpty>{t('tests.modal.noExpected')}</DetailEmpty>}
              </DetailRow>
            </DetailList>
            <h4 className="detail-subtitle">{t('tests.modal.activity')}</h4>
            <ActivityList projectId={projectId} entity="testCases" entityId={test.id} />
            <p className="field-helper">{t('tests.modal.updated', { time: formatRelative(test.updatedAt) })}</p>
          </>
        )}
      </div>
    </Modal>
    <ConfirmDeleteDialog
      open={confirmOpen}
      title={t('tests.modal.deleteConfirmTitle')}
      description={t('tests.modal.deleteConfirmBody')}
      onClose={() => setConfirmOpen(false)}
      onConfirm={remove}
    />
    </>
  );
}